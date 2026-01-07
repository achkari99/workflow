import type { Express, Request } from "express";
import { storage } from "../storage";
import { insertNoteSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { isAuthenticated } from "../auth";

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.id;
}

export function registerNoteRoutes(app: Express) {
  app.get("/api/notes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const notes = await storage.getNotesByUser(userId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const validation = insertNoteSchema.safeParse({ ...req.body, userId });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const note = await storage.createNote(validation.data);
      res.status(201).json(note);
    } catch (error) {
      res.status(500).json({ error: "Failed to create note" });
    }
  });

  app.patch("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getNotesByUser(userId);
      const note = existing.find((item) => item.id === id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      const updatePayload: Record<string, any> = {};
      if (typeof req.body.title === "string") updatePayload.title = req.body.title;
      if (typeof req.body.content === "string" || req.body.content === null) {
        updatePayload.content = req.body.content;
      }
      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      const updated = await storage.updateNote(id, updatePayload);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getNotesByUser(userId);
      const note = existing.find((item) => item.id === id);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }
      await storage.deleteNote(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete note" });
    }
  });
}
