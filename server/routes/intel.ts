import type { Express, Request } from "express";
import { storage } from "../storage";
import { supabase } from "../supabase";
import { insertIntelDocSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import multer from "multer";
import { isAuthenticated } from "../auth";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
});

function getUserId(req: Request): string | undefined {
    return (req.user as any)?.id;
}

async function attachSignedUrls(docs: any[]) {
    return Promise.all(docs.map(async (doc) => {
        if (!doc.filePath) return doc;
        const { data } = await supabase.storage.from("intel-docs").createSignedUrl(doc.filePath, 60 * 60);
        return { ...doc, fileUrl: data?.signedUrl || null };
    }));
}

async function attachProofUrl<T extends { proofFilePath?: string | null }>(item: T) {
    if (!item.proofFilePath) return { ...item, proofFileUrl: null };
    const { data } = await supabase.storage.from("intel-docs").createSignedUrl(item.proofFilePath, 60 * 60);
    return { ...item, proofFileUrl: data?.signedUrl || null };
}

async function canEditStepProof(step: any, userId?: string) {
    if (!userId) return false;
    if (step.compositeId) {
        const composite = await storage.getCompositeWorkflowWithItems(step.compositeId);
        if (!composite) return false;
        if (composite.ownerId && composite.ownerId !== userId) return false;
        return true;
    }
    if (step.workflowId) {
        const workflow = await storage.getWorkflow(step.workflowId);
        if (!workflow) return false;
        if (!workflow.ownerId || workflow.ownerId === userId) return true;
        const shares = await storage.getWorkflowShares(step.workflowId);
        return shares.some((share: any) => share.sharedWithUserId === userId && share.permission === "edit");
    }
    return false;
}

export function registerIntelRoutes(app: Express) {
    app.get("/api/steps/:id", isAuthenticated, async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const step = await storage.getStepWithDetails(id);
            if (!step) {
                return res.status(404).json({ error: "Step not found" });
            }
            const intelDocsWithUrls = await attachSignedUrls(step.intelDocs);
            const stepWithProof = await attachProofUrl(step);
            res.json({ ...stepWithProof, intelDocs: intelDocsWithUrls });
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch step" });
        }
    });

    app.get("/api/steps/:id/intel", isAuthenticated, async (req, res) => {
        try {
            const stepId = parseInt(req.params.id);
            const docs = await storage.getIntelDocsByStep(stepId);
            const docsWithUrls = await attachSignedUrls(docs);
            res.json(docsWithUrls);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch intel docs" });
        }
    });

    app.post("/api/steps/:id/intel", isAuthenticated, async (req, res) => {
        try {
            const stepId = parseInt(req.params.id);
            const validation = insertIntelDocSchema.safeParse({ ...req.body, stepId });
            if (!validation.success) {
                return res.status(400).json({ error: fromError(validation.error).toString() });
            }
            const doc = await storage.createIntelDoc(validation.data);
            res.status(201).json(doc);
        } catch (error) {
            res.status(500).json({ error: "Failed to create intel doc" });
        }
    });

    app.post("/api/steps/:id/intel/upload", isAuthenticated, upload.single("file"), async (req, res) => {
        try {
            const stepId = parseInt(req.params.id);
            const { title, docType } = req.body;
            const file = req.file;
            if (!title || !file) {
                return res.status(400).json({ error: "Title and file are required" });
            }

            const userId = getUserId(req) || "anonymous";
            const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
            const objectPath = `${userId}/steps/${stepId}/${Date.now()}-${safeName}`;

            const { data: uploadData, error } = await supabase.storage.from("intel-docs").upload(objectPath, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });

            if (error) {
                console.error("Supabase upload error:", error);
                return res.status(500).json({ error: "Failed to upload file", details: error.message });
            }

            const validation = insertIntelDocSchema.safeParse({
                stepId,
                title,
                content: `Attached file: ${file.originalname}`,
                docType: docType || "note",
                filePath: objectPath,
                fileName: file.originalname,
                mimeType: file.mimetype,
                fileSize: file.size,
            });

            if (!validation.success) {
                return res.status(400).json({ error: fromError(validation.error).toString() });
            }

            const doc = await storage.createIntelDoc(validation.data);
            const [docWithUrl] = await attachSignedUrls([doc]);
            res.status(201).json(docWithUrl);
        } catch (error) {
            res.status(500).json({ error: "Failed to upload intel doc" });
        }
    });

    app.patch("/api/steps/:id/proof-config", async (req, res) => {
        try {
            const userId = getUserId(req);
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const stepId = parseInt(req.params.id);
            const step = await storage.getStep(stepId);
            if (!step) {
                return res.status(404).json({ error: "Step not found" });
            }
            const canEdit = await canEditStepProof(step, userId);
            if (!canEdit) {
                return res.status(403).json({ error: "You don't have permission to edit proofs" });
            }
            const updatePayload: Record<string, any> = {};
            for (const key of ["proofRequired"]) {
                if (req.body[key] !== undefined) {
                    updatePayload[key] = req.body[key];
                }
            }
            if (Object.keys(updatePayload).length === 0) {
                return res.status(400).json({ error: "No updates provided" });
            }
            const updated = await storage.updateStep(stepId, updatePayload);
            if (!updated) {
                return res.status(404).json({ error: "Step not found" });
            }
            res.json(updated);
        } catch (error) {
            res.status(500).json({ error: "Failed to update proof config" });
        }
    });

    app.patch("/api/steps/:id/proof", async (req, res) => {
        try {
            const userId = getUserId(req);
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const stepId = parseInt(req.params.id);
            const step = await storage.getStep(stepId);
            if (!step) {
                return res.status(404).json({ error: "Step not found" });
            }
            const canEdit = await canEditStepProof(step, userId);
            if (!canEdit) {
                return res.status(403).json({ error: "You don't have permission to edit proofs" });
            }
            const updatePayload: Record<string, any> = {};
            if (req.body.content !== undefined) {
                updatePayload.proofContent = req.body.content;
            }
            updatePayload.proofSubmittedAt = new Date();
            updatePayload.proofSubmittedByUserId = userId;
            const updated = await storage.updateStep(stepId, updatePayload);
            if (!updated) {
                return res.status(404).json({ error: "Step not found" });
            }
            const withUrl = await attachProofUrl(updated);
            res.json(withUrl);
        } catch (error) {
            res.status(500).json({ error: "Failed to submit proof" });
        }
    });

    app.post("/api/steps/:id/proof/upload", upload.single("file"), async (req, res) => {
        try {
            const userId = getUserId(req);
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const stepId = parseInt(req.params.id);
            const step = await storage.getStep(stepId);
            if (!step) {
                return res.status(404).json({ error: "Step not found" });
            }
            const canEdit = await canEditStepProof(step, userId);
            if (!canEdit) {
                return res.status(403).json({ error: "You don't have permission to edit proofs" });
            }
            const file = req.file;
            if (!file) {
                return res.status(400).json({ error: "File is required" });
            }
            const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
            const objectPath = `${userId}/proofs/steps/${stepId}/${Date.now()}-${safeName}`;
            if (step.proofFilePath) {
                await supabase.storage.from("intel-docs").remove([step.proofFilePath]);
            }
            const { error } = await supabase.storage.from("intel-docs").upload(objectPath, file.buffer, {
                contentType: file.mimetype,
                upsert: false,
            });
            if (error) {
                return res.status(500).json({ error: "Failed to upload proof file", details: error.message });
            }
            const updatePayload: Record<string, any> = {
                proofFilePath: objectPath,
                proofFileName: file.originalname,
                proofMimeType: file.mimetype,
                proofFileSize: file.size,
                proofSubmittedAt: new Date(),
                proofSubmittedByUserId: userId,
            };
            if (req.body.content !== undefined) {
                updatePayload.proofContent = req.body.content;
            }
            const updated = await storage.updateStep(stepId, updatePayload);
            if (!updated) {
                return res.status(404).json({ error: "Step not found" });
            }
            const withUrl = await attachProofUrl(updated);
            res.status(201).json(withUrl);
        } catch (error) {
            res.status(500).json({ error: "Failed to upload proof" });
        }
    });

    app.delete("/api/steps/:id/proof", async (req, res) => {
        try {
            const userId = getUserId(req);
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const stepId = parseInt(req.params.id);
            const step = await storage.getStep(stepId);
            if (!step) {
                return res.status(404).json({ error: "Step not found" });
            }
            const canEdit = await canEditStepProof(step, userId);
            if (!canEdit) {
                return res.status(403).json({ error: "You don't have permission to edit proofs" });
            }
            if (step.proofFilePath) {
                await supabase.storage.from("intel-docs").remove([step.proofFilePath]);
            }
            const updated = await storage.updateStep(stepId, {
                proofContent: null,
                proofFilePath: null,
                proofFileName: null,
                proofMimeType: null,
                proofFileSize: null,
                proofSubmittedAt: null,
                proofSubmittedByUserId: null,
            });
            res.json(updated);
        } catch (error) {
            res.status(500).json({ error: "Failed to delete proof" });
        }
    });
}
