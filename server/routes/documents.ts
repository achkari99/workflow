import type { Express, Request } from "express";
import multer from "multer";
import {
  insertDocumentFolderSchema,
  insertDocumentItemSchema,
  insertDocumentProjectSchema,
} from "@shared/schema";
import { fromError } from "zod-validation-error";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { supabase } from "../supabase";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const DOCUMENTS_BUCKET = "intel-docs";

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.id;
}

async function getOwnedProject(projectId: number, userId: string) {
  const project = await storage.getDocumentProject(projectId);
  return project?.userId === userId ? project : undefined;
}

async function attachSignedUrls(items: any[]) {
  return Promise.all(
    items.map(async (item) => {
      if (item.itemType !== "file" || !item.filePath) {
        return { ...item, fileUrl: null };
      }
      const { data } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(item.filePath, 60 * 60);
      return { ...item, fileUrl: data?.signedUrl || null };
    }),
  );
}

async function removeStoredFiles(paths: Array<string | null>) {
  const validPaths = paths.filter((path): path is string => Boolean(path));
  if (validPaths.length > 0) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove(validPaths);
  }
}

export function registerDocumentRoutes(app: Express) {
  app.get("/api/documents/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      res.json(await storage.getDocumentProjectsByUser(userId));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document projects" });
    }
  });

  app.post("/api/documents/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const validation = insertDocumentProjectSchema.safeParse({
        userId,
        name: req.body.name,
        description: req.body.description || null,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      res.status(201).json(await storage.createDocumentProject(validation.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to create document project" });
    }
  });

  app.patch("/api/documents/projects/:projectId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const projectId = Number(req.params.projectId);
      const project = await getOwnedProject(projectId, userId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const updates: Record<string, string | null> = {};
      if (typeof req.body.name === "string" && req.body.name.trim()) {
        updates.name = req.body.name.trim();
      }
      if (typeof req.body.description === "string" || req.body.description === null) {
        updates.description = req.body.description?.trim() || null;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      res.json(await storage.updateDocumentProject(projectId, updates));
    } catch (error) {
      res.status(500).json({ error: "Failed to update document project" });
    }
  });

  app.delete("/api/documents/projects/:projectId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const projectId = Number(req.params.projectId);
      const project = await getOwnedProject(projectId, userId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const files = await storage.getDocumentFileItemsByProject(projectId);
      await storage.deleteDocumentProject(projectId);
      await removeStoredFiles(files.map((file) => file.filePath));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document project" });
    }
  });

  app.get("/api/documents/projects/:projectId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const projectId = Number(req.params.projectId);
      const project = await getOwnedProject(projectId, userId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const folderId =
        typeof req.query.folderId === "string" && req.query.folderId !== ""
          ? Number(req.query.folderId)
          : null;
      if (folderId !== null) {
        const folder = await storage.getDocumentFolder(folderId);
        if (!folder || folder.projectId !== projectId) {
          return res.status(404).json({ error: "Folder not found" });
        }
      }
      const [folders, items] = await Promise.all([
        storage.getDocumentFoldersByProject(projectId),
        storage.getDocumentItems(projectId, folderId),
      ]);
      res.json({
        project,
        folders,
        items: await attachSignedUrls(items),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch document project" });
    }
  });

  app.post("/api/documents/projects/:projectId/folders", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const projectId = Number(req.params.projectId);
      const project = await getOwnedProject(projectId, userId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const parentFolderId = Number.isInteger(req.body.parentFolderId)
        ? req.body.parentFolderId
        : null;
      if (parentFolderId !== null) {
        const parent = await storage.getDocumentFolder(parentFolderId);
        if (!parent || parent.projectId !== projectId) {
          return res.status(400).json({ error: "Invalid parent folder" });
        }
      }
      const validation = insertDocumentFolderSchema.safeParse({
        projectId,
        parentFolderId,
        name: req.body.name,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      res.status(201).json(await storage.createDocumentFolder(validation.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to create folder" });
    }
  });

  app.delete("/api/documents/folders/:folderId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const folderId = Number(req.params.folderId);
      const folder = await storage.getDocumentFolder(folderId);
      if (!folder) return res.status(404).json({ error: "Folder not found" });
      const project = await getOwnedProject(folder.projectId, userId);
      if (!project) return res.status(404).json({ error: "Folder not found" });

      const [folders, files] = await Promise.all([
        storage.getDocumentFoldersByProject(project.id),
        storage.getDocumentFileItemsByProject(project.id),
      ]);
      const folderIds = new Set<number>([folderId]);
      let foundChild = true;
      while (foundChild) {
        foundChild = false;
        for (const candidate of folders) {
          if (
            candidate.parentFolderId !== null &&
            folderIds.has(candidate.parentFolderId) &&
            !folderIds.has(candidate.id)
          ) {
            folderIds.add(candidate.id);
            foundChild = true;
          }
        }
      }
      await storage.deleteDocumentFolder(folderId);
      await removeStoredFiles(
        files
          .filter((file) => file.folderId !== null && folderIds.has(file.folderId))
          .map((file) => file.filePath),
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Document folder deletion failed:", error);
      res.status(500).json({
        error: "Failed to delete folder",
        details: error instanceof Error ? error.message : undefined,
      });
    }
  });

  app.post("/api/documents/projects/:projectId/notes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const projectId = Number(req.params.projectId);
      const project = await getOwnedProject(projectId, userId);
      if (!project) return res.status(404).json({ error: "Project not found" });
      const folderId = Number.isInteger(req.body.folderId) ? req.body.folderId : null;
      if (folderId !== null) {
        const folder = await storage.getDocumentFolder(folderId);
        if (!folder || folder.projectId !== projectId) {
          return res.status(400).json({ error: "Invalid folder" });
        }
      }
      const validation = insertDocumentItemSchema.safeParse({
        projectId,
        folderId,
        itemType: "note",
        title: req.body.title,
        content: req.body.content || null,
        filePath: null,
        fileName: null,
        mimeType: null,
        fileSize: null,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      res.status(201).json(await storage.createDocumentItem(validation.data));
    } catch (error) {
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.post(
    "/api/documents/projects/:projectId/files",
    isAuthenticated,
    upload.single("file"),
    async (req, res) => {
      try {
        const userId = getUserId(req);
        if (!userId) return res.status(401).json({ error: "Unauthorized" });
        const projectId = Number(req.params.projectId);
        const project = await getOwnedProject(projectId, userId);
        if (!project) return res.status(404).json({ error: "Project not found" });
        const file = req.file;
        if (!file) return res.status(400).json({ error: "File is required" });
        const folderId =
          typeof req.body.folderId === "string" && req.body.folderId
            ? Number(req.body.folderId)
            : null;
        if (folderId !== null) {
          const folder = await storage.getDocumentFolder(folderId);
          if (!folder || folder.projectId !== projectId) {
            return res.status(400).json({ error: "Invalid folder" });
          }
        }
        const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
        const objectPath = `${userId}/documents/${projectId}/${Date.now()}-${safeName}`;
        const { error } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(objectPath, file.buffer, {
            contentType: file.mimetype || "application/octet-stream",
            upsert: false,
          });
        if (error) {
          return res.status(500).json({ error: "Failed to upload file", details: error.message });
        }
        const validation = insertDocumentItemSchema.safeParse({
          projectId,
          folderId,
          itemType: "file",
          title:
            typeof req.body.title === "string" && req.body.title.trim()
              ? req.body.title.trim()
              : file.originalname,
          content: null,
          filePath: objectPath,
          fileName: file.originalname,
          mimeType: file.mimetype || "application/octet-stream",
          fileSize: file.size,
        });
        if (!validation.success) {
          await removeStoredFiles([objectPath]);
          return res.status(400).json({ error: fromError(validation.error).toString() });
        }
        const item = await storage.createDocumentItem(validation.data);
        const [withUrl] = await attachSignedUrls([item]);
        res.status(201).json(withUrl);
      } catch (error) {
        res.status(500).json({ error: "Failed to upload file" });
      }
    },
  );

  app.patch("/api/documents/items/:itemId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const itemId = Number(req.params.itemId);
      const item = await storage.getDocumentItem(itemId);
      if (!item || item.itemType !== "note") {
        return res.status(404).json({ error: "Note not found" });
      }
      const project = await getOwnedProject(item.projectId, userId);
      if (!project) return res.status(404).json({ error: "Note not found" });
      const updates: Record<string, string | null> = {};
      if (typeof req.body.title === "string" && req.body.title.trim()) {
        updates.title = req.body.title.trim();
      }
      if (typeof req.body.content === "string" || req.body.content === null) {
        updates.content = req.body.content?.trim() || null;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      res.json(await storage.updateDocumentItem(itemId, updates));
    } catch (error) {
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/documents/items/:itemId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      const itemId = Number(req.params.itemId);
      const item = await storage.getDocumentItem(itemId);
      if (!item) return res.status(404).json({ error: "Item not found" });
      const project = await getOwnedProject(item.projectId, userId);
      if (!project) return res.status(404).json({ error: "Item not found" });
      await storage.deleteDocumentItem(itemId);
      await removeStoredFiles([item.filePath]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete item" });
    }
  });
}
