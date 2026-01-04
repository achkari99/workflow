import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { broadcastSession } from "./realtime";
import {
  insertWorkflowSchema,
  insertStepSchema,
  insertApprovalSchema,
  insertIntelDocSchema,
  insertWorkflowShareSchema,
  insertCompositeWorkflowSchema,
  insertCompositeWorkflowSessionSchema,
  insertCompositeWorkflowSessionMemberSchema,
  insertCompositeWorkflowSessionAssignmentSchema,
  insertCompositeWorkflowSessionAssignmentDelegateSchema,
  insertCompositeWorkflowSessionLaneDelegateSchema,
  insertCompositeWorkflowSessionIntelDocSchema,
  insertCompositeWorkflowSessionMessageSchema,
} from "@shared/schema";
import { fromError } from "zod-validation-error";
import { supabase } from "./supabase";

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.id;
}

async function getSessionMember(sessionId: number, userId?: string) {
  if (!userId) return undefined;
  const members = await storage.getCompositeWorkflowSessionMembers(sessionId);
  return members.find((m) => m.userId === userId);
}

function ensureSessionPermission(member: any | undefined, ownerId: string | null, userId: string | undefined, permission: keyof typeof member) {
  if (!userId) return false;
  if (ownerId && ownerId === userId) return true;
  if (!member) return false;
  return !!member[permission];
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.get("/api/workflows", async (req, res) => {
    try {
      const userId = getUserId(req);
      const workflows = await storage.getWorkflows(userId);
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/active", async (req, res) => {
    try {
      const userId = getUserId(req);
      const workflow = await storage.getActiveWorkflow(userId);
      if (!workflow) {
        return res.status(404).json({ error: "No active workflow found" });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active workflow" });
    }
  });

  app.get("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.getWorkflowWithSteps(id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow" });
    }
  });

  app.post("/api/workflows", async (req, res) => {
    try {
      const userId = getUserId(req);
      const validation = insertWorkflowSchema.safeParse({ ...req.body, ownerId: userId });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const workflow = await storage.createWorkflow(validation.data);

      const proofConfig = Array.isArray(req.body.proofConfig) ? req.body.proofConfig : [];
      for (let i = 1; i <= workflow.totalSteps; i++) {
        const proof = proofConfig[i - 1] || {};
        const proofRequired = !!proof.proofRequired;
        await storage.createStep({
          workflowId: workflow.id,
          stepNumber: i,
          name: `Step ${i}`,
          description: `Complete phase ${i}`,
          status: i === 1 ? "active" : "locked",
          proofRequired,
          proofTitle: proofRequired ? proof.proofTitle || null : null,
          proofDescription: proofRequired ? proof.proofDescription || null : null,
        });
      }

      await storage.createActivity({
        workflowId: workflow.id,
        action: "workflow_created",
        description: `Workflow "${workflow.name}" created`,
      });

      res.status(201).json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to create workflow" });
    }
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const existing = await storage.getWorkflow(id);
      if (!existing) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      if (existing.ownerId && existing.ownerId !== userId) {
        return res.status(403).json({ error: "You can only edit workflows you own" });
      }
      const workflow = await storage.updateWorkflow(id, req.body);
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to update workflow" });
    }
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const existing = await storage.getWorkflow(id);
      if (!existing) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      if (existing.ownerId && existing.ownerId !== userId) {
        return res.status(403).json({ error: "You can only delete workflows you own" });
      }
      await storage.deleteWorkflow(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete workflow" });
    }
  });

  app.post("/api/workflows/:id/set-active", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      await storage.setActiveWorkflow(id, userId);
      const workflow = await storage.getWorkflow(id);
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to set active workflow" });
    }
  });

  app.post("/api/workflows/:id/advance", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const existing = await storage.getWorkflow(id);
      if (!existing) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      if (existing.ownerId && existing.ownerId !== userId) {
        const shares = await storage.getWorkflowShares(id);
        const hasEditAccess = shares.some(s => s.sharedWithUserId === userId && s.permission === "edit");
        if (!hasEditAccess) {
          return res.status(403).json({ error: "You don't have permission to advance this workflow" });
        }
      }
      const { stepId } = req.body;
      const workflow = await storage.advanceWorkflowStep(id, stepId);
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to advance workflow" });
    }
  });

  app.get("/api/workflows/:id/steps", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const steps = await storage.getStepsByWorkflow(workflowId);
      res.json(steps);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch steps" });
    }
  });

  app.get("/api/workflows/:id/activities", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const activities = await storage.getActivitiesByWorkflow(workflowId);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  app.get("/api/steps/:id", async (req, res) => {
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

  app.post("/api/steps", async (req, res) => {
    try {
      const validation = insertStepSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const step = await storage.createStep(validation.data);
      res.status(201).json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to create step" });
    }
  });

  app.patch("/api/steps/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const step = await storage.updateStep(id, req.body);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to update step" });
    }
  });

  app.post("/api/steps/:id/complete", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const step = await storage.getStep(id);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      if (step.proofRequired && !step.proofContent && !step.proofFilePath) {
        return res.status(400).json({ error: "Proof required before completion" });
      }
      const completed = await storage.completeStep(id);
      if (!completed) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(completed);
    } catch (error) {
      res.status(500).json({ error: "Failed to complete step" });
    }
  });

  app.post("/api/steps/:id/start", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const step = await storage.updateStep(id, { status: "in_progress" });
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(step);
    } catch (error) {
      res.status(500).json({ error: "Failed to start step" });
    }
  });

  app.post("/api/steps/:id/request-approval", async (req, res) => {
    try {
      const stepId = parseInt(req.params.id);
      await storage.updateStep(stepId, { status: "pending_approval" });
      const approval = await storage.createApproval({ stepId, status: "pending" });
      res.status(201).json(approval);
    } catch (error) {
      res.status(500).json({ error: "Failed to request approval" });
    }
  });

  app.get("/api/steps/:id/intel", async (req, res) => {
    try {
      const stepId = parseInt(req.params.id);
      const docs = await storage.getIntelDocsByStep(stepId);
      const docsWithUrls = await attachSignedUrls(docs);
      res.json(docsWithUrls);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch intel docs" });
    }
  });

  app.post("/api/steps/:id/intel", async (req, res) => {
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

  app.post("/api/steps/:id/intel/upload", upload.single("file"), async (req, res) => {
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
      for (const key of ["proofRequired", "proofTitle", "proofDescription"]) {
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

  app.get("/api/approvals/:id", async (req, res) => {
    try {
      const stepId = parseInt(req.params.id);
      const approvals = await storage.getApprovalsByStep(stepId);
      res.json(approvals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch approvals" });
    }
  });

  app.patch("/api/approvals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const approval = await storage.updateApproval(id, req.body);
      if (!approval) {
        return res.status(404).json({ error: "Approval not found" });
      }
      res.json(approval);
    } catch (error) {
      res.status(500).json({ error: "Failed to update approval" });
    }
  });

  app.get("/api/workflows/:id/shares", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const shares = await storage.getWorkflowShares(workflowId);
      res.json(shares);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch shares" });
    }
  });

  app.post("/api/workflows/:id/share", async (req, res) => {
    try {
      const workflowId = parseInt(req.params.id);
      const currentUserId = getUserId(req);
      const workflow = await storage.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      if (workflow.ownerId && workflow.ownerId !== currentUserId) {
        return res.status(403).json({ error: "You can only share workflows you own" });
      }
      const validation = insertWorkflowShareSchema.safeParse({
        workflowId,
        sharedWithUserId: req.body.userId,
        permission: req.body.permission || "view",
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const share = await storage.shareWorkflow(validation.data);
      res.status(201).json(share);
    } catch (error) {
      res.status(500).json({ error: "Failed to share workflow" });
    }
  });

  app.delete("/api/shares/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const share = await storage.getShare(id);
      if (!share) {
        return res.status(404).json({ error: "Share not found" });
      }
      const workflow = await storage.getWorkflow(share.workflowId);
      if (workflow?.ownerId && workflow.ownerId !== userId) {
        return res.status(403).json({ error: "You can only remove shares from workflows you own" });
      }
      await storage.removeShare(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove share" });
    }
  });

  app.get("/api/users/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }
      const users = await storage.searchUsers(query);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/composites", async (req, res) => {
    try {
      const userId = getUserId(req);
      const composites = await storage.getCompositeWorkflows(userId);
      res.json(composites);
    } catch (error) {
      console.error("Failed to fetch composite workflows:", error);
      res.status(500).json({ error: "Failed to fetch composite workflows" });
    }
  });

  app.get("/api/composites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const composite = await storage.getCompositeWorkflowWithItems(id);
      if (!composite) {
        return res.status(404).json({ error: "Composite workflow not found" });
      }
      res.json(composite);
    } catch (error) {
      console.error("Failed to fetch composite workflow item:", error);
      res.status(500).json({ error: "Failed to fetch composite workflow" });
    }
  });

  app.post("/api/composites", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { name, description, stepIds = [] } = req.body;

      console.log("Creating composite mission:", { name, stepIds });

      const validation = insertCompositeWorkflowSchema.safeParse({
        name,
        description,
        ownerId: userId,
      });
      if (!validation.success) {
        console.error("Validation failed:", validation.error);
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }

      const composite = await storage.createCompositeWorkflow(validation.data);
      console.log("Composite mission base created:", composite.id);

      for (let i = 0; i < stepIds.length; i++) {
        await storage.cloneStepToComposite(composite.id, stepIds[i], i);
      }

      console.log("Steps successfully integrated into mission.");
      res.status(201).json(composite);
    } catch (error) {
      console.error("Full stack trace for composite failure:", error);
      res.status(500).json({ error: "Failed to create composite workflow" });
    }
  });

  app.post("/api/composites/:id/copy", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sourceId = parseInt(req.params.id);
      const { name, description, targetUserId } = req.body || {};
      const source = await storage.getCompositeWorkflowWithItems(sourceId);
      if (!source) {
        return res.status(404).json({ error: "Composite workflow not found" });
      }
      if (source.ownerId && source.ownerId !== userId) {
        return res.status(403).json({ error: "You can only share composites you own" });
      }
      const targetOwnerId = targetUserId || userId;
      const composite = await storage.cloneCompositeForUser(sourceId, targetOwnerId, name, description);
      res.status(201).json(composite);
    } catch (error) {
      console.error("Failed to copy composite workflow:", error);
      res.status(500).json({ error: "Failed to copy composite workflow" });
    }
  });

  app.post("/api/composites/:id/steps", async (req, res) => {
    try {
      const compositeId = parseInt(req.params.id);
      const { stepId, orderIndex = 0 } = req.body;

      const item = await storage.cloneStepToComposite(compositeId, stepId, orderIndex);
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add step to composite" });
    }
  });

  app.post("/api/composite-sessions", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const composite = await storage.getCompositeWorkflowWithItems(req.body.compositeId);
      if (!composite) {
        return res.status(404).json({ error: "Composite workflow not found" });
      }
      if (composite.ownerId && composite.ownerId !== userId) {
        return res.status(403).json({ error: "You can only create sessions for composites you own" });
      }
      const validation = insertCompositeWorkflowSessionSchema.safeParse({
        compositeId: req.body.compositeId,
        ownerId: userId,
        name: req.body.name,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }

      const session = await storage.createCompositeWorkflowSession(validation.data);
      for (const step of composite.steps) {
        await storage.createCompositeWorkflowSessionStep({
          sessionId: session.id,
          stepId: step.id,
          isCompleted: false,
          completedAt: null,
          proofRequired: step.proofRequired || false,
          proofTitle: step.proofTitle,
          proofDescription: step.proofDescription,
          proofContent: step.proofContent,
          proofFilePath: step.proofFilePath,
          proofFileName: step.proofFileName,
          proofMimeType: step.proofMimeType,
          proofFileSize: step.proofFileSize,
          proofSubmittedAt: step.proofSubmittedAt,
          proofSubmittedByUserId: step.proofSubmittedByUserId,
        });
      }
      await storage.addCompositeWorkflowSessionMember({
        sessionId: session.id,
        userId,
        canEditSteps: true,
        canManageAssignments: true,
        canManageSharing: true,
        canEditIntel: true,
        canEditProof: true,
        canChat: true,
        allowLaneDelegation: false,
        laneColor: req.body.laneColor || "#84cc16",
      });

      res.status(201).json(session);
    } catch (error) {
      console.error("Failed to create composite session:", error);
      res.status(500).json({ error: "Failed to create composite session" });
    }
  });

  app.get("/api/composite-sessions", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessions = await storage.getCompositeWorkflowSessionsForUser(userId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.get("/api/composite-sessions/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (session.ownerId !== userId && !member) {
        return res.status(403).json({ error: "You don't have access to this session" });
      }
      const intelDocsWithUrls = await attachSignedUrls(session.intelDocs || []);
      const sessionStepsWithProof = await Promise.all(
        (session.sessionSteps || []).map((step: any) => attachProofUrl(step))
      );
      res.json({ ...session, intelDocs: intelDocsWithUrls, sessionSteps: sessionStepsWithProof });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.delete("/api/composite-sessions/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      const canManage = ensureSessionPermission(member, session.ownerId || null, userId, "canManageSharing");
      if (session.ownerId !== userId && !canManage) {
        return res.status(403).json({ error: "You don't have permission to delete this session" });
      }
      await storage.deleteCompositeWorkflowSession(sessionId);
      broadcastSession(sessionId, { type: "session:deleted", sessionId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete session" });
    }
  });

  app.post("/api/composite-sessions/:id/members", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const requester = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(requester, session.ownerId || null, userId, "canManageSharing")) {
        return res.status(403).json({ error: "You don't have permission to manage sharing" });
      }
      const validation = insertCompositeWorkflowSessionMemberSchema.safeParse({
        sessionId,
        userId: req.body.userId,
        canEditSteps: !!req.body.canEditSteps,
        canManageAssignments: !!req.body.canManageAssignments,
        canManageSharing: !!req.body.canManageSharing,
        canEditIntel: !!req.body.canEditIntel,
        canEditProof: !!req.body.canEditProof,
        canChat: !!req.body.canChat,
        allowLaneDelegation: !!req.body.allowLaneDelegation,
        laneColor: req.body.laneColor || "#38bdf8",
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const newMember = await storage.addCompositeWorkflowSessionMember(validation.data);
      broadcastSession(sessionId, { type: "session:member_added", sessionId, member: newMember });
      res.status(201).json(newMember);
    } catch (error) {
      res.status(500).json({ error: "Failed to add session member" });
    }
  });

  app.patch("/api/composite-sessions/:sessionId/members/:memberId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const memberId = parseInt(req.params.memberId);
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canManageSharing")) {
        return res.status(403).json({ error: "You don't have permission to manage sharing" });
      }
      const updated = await storage.updateCompositeWorkflowSessionMember(memberId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Member not found" });
      }
      broadcastSession(sessionId, { type: "session:member_updated", sessionId, member: updated });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update session member" });
    }
  });

  app.delete("/api/composite-sessions/:sessionId/members/:memberId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const memberId = parseInt(req.params.memberId);
      const sessionId = parseInt(req.params.sessionId);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canManageSharing")) {
        return res.status(403).json({ error: "You don't have permission to manage sharing" });
      }
      const target = session.members.find((m: any) => m.id === memberId);
      if (!target) {
        return res.status(404).json({ error: "Member not found" });
      }
      if (target.userId === session.ownerId) {
        return res.status(400).json({ error: "Cannot remove the session owner" });
      }
      const removed = await storage.removeCompositeWorkflowSessionMember(memberId);
      if (!removed) {
        return res.status(404).json({ error: "Member not found" });
      }
      broadcastSession(sessionId, { type: "session:member_removed", sessionId, memberId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove session member" });
    }
  });

  app.post("/api/composite-sessions/:id/assignments", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canManageAssignments")) {
        return res.status(403).json({ error: "You don't have permission to manage assignments" });
      }
      const validation = insertCompositeWorkflowSessionAssignmentSchema.safeParse({
        sessionId,
        stepId: req.body.stepId,
        assigneeUserId: req.body.assigneeUserId,
        allowDelegation: !!req.body.allowDelegation,
        allowDelegationToEveryone: !!req.body.allowDelegationToEveryone,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const assignment = await storage.assignCompositeWorkflowSessionStep(validation.data);
      broadcastSession(sessionId, { type: "session:assignment_added", sessionId, assignment });
      res.status(201).json(assignment);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign step" });
    }
  });

  app.patch("/api/composite-sessions/:id/assignments/:assignmentId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const assignmentId = parseInt(req.params.assignmentId);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canManageAssignments")) {
        return res.status(403).json({ error: "You don't have permission to manage assignments" });
      }
      const updated = await storage.updateCompositeWorkflowSessionAssignment(assignmentId, {
        allowDelegation: req.body.allowDelegation,
        allowDelegationToEveryone: req.body.allowDelegationToEveryone,
      });
      if (!updated) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      broadcastSession(sessionId, { type: "session:assignment_updated", sessionId, assignment: updated });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update assignment" });
    }
  });

  app.post("/api/composite-sessions/:id/assignments/:assignmentId/delegates", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const assignmentId = parseInt(req.params.assignmentId);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const assignment = session.assignments.find((a: any) => a.id === assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      const canManage = ensureSessionPermission(member, session.ownerId || null, userId, "canManageAssignments");
      if (assignment.assigneeUserId !== userId && !canManage) {
        return res.status(403).json({ error: "You don't have permission to add delegates" });
      }
      const validation = insertCompositeWorkflowSessionAssignmentDelegateSchema.safeParse({
        assignmentId,
        delegateUserId: req.body.userId,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const created = await storage.addCompositeWorkflowSessionAssignmentDelegate(validation.data);
      broadcastSession(sessionId, { type: "session:assignment_delegate_added", sessionId, assignmentId, delegate: created });
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to add assignment delegate" });
    }
  });

  app.delete("/api/composite-sessions/:id/assignments/:assignmentId/delegates/:delegateId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const assignmentId = parseInt(req.params.assignmentId);
      const delegateId = parseInt(req.params.delegateId);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const assignment = session.assignments.find((a: any) => a.id === assignmentId);
      if (!assignment) {
        return res.status(404).json({ error: "Assignment not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      const canManage = ensureSessionPermission(member, session.ownerId || null, userId, "canManageAssignments");
      if (assignment.assigneeUserId !== userId && !canManage) {
        return res.status(403).json({ error: "You don't have permission to remove delegates" });
      }
      const removed = await storage.removeCompositeWorkflowSessionAssignmentDelegate(delegateId);
      if (!removed || removed.assignmentId !== assignmentId) {
        return res.status(404).json({ error: "Delegate not found" });
      }
      broadcastSession(sessionId, { type: "session:assignment_delegate_removed", sessionId, assignmentId, delegateId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove assignment delegate" });
    }
  });

  app.delete("/api/composite-sessions/:id/assignments/:assignmentId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canManageAssignments")) {
        return res.status(403).json({ error: "You don't have permission to manage assignments" });
      }
      const assignmentId = parseInt(req.params.assignmentId);
      await storage.removeCompositeWorkflowSessionAssignment(assignmentId);
      broadcastSession(sessionId, { type: "session:assignment_removed", sessionId, assignmentId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove assignment" });
    }
  });

  app.post("/api/composite-sessions/:id/lane-delegates", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const ownerUserId = req.body.ownerUserId;
      const member = await getSessionMember(sessionId, userId);
      const canManage = ensureSessionPermission(member, session.ownerId || null, userId, "canManageAssignments");
      if (ownerUserId !== userId && !canManage) {
        return res.status(403).json({ error: "You don't have permission to manage this lane" });
      }
      const validation = insertCompositeWorkflowSessionLaneDelegateSchema.safeParse({
        sessionId,
        ownerUserId,
        delegateUserId: req.body.userId,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const created = await storage.addCompositeWorkflowSessionLaneDelegate(validation.data);
      broadcastSession(sessionId, { type: "session:lane_delegate_added", sessionId, delegate: created });
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: "Failed to add lane delegate" });
    }
  });

  app.delete("/api/composite-sessions/:id/lane-delegates/:delegateId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const delegateId = parseInt(req.params.delegateId);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      const canManage = ensureSessionPermission(member, session.ownerId || null, userId, "canManageAssignments");
      const delegate = await storage.removeCompositeWorkflowSessionLaneDelegate(delegateId);
      if (!delegate) {
        return res.status(404).json({ error: "Delegate not found" });
      }
      if (delegate.ownerUserId !== userId && !canManage) {
        return res.status(403).json({ error: "You don't have permission to manage this lane" });
      }
      broadcastSession(sessionId, { type: "session:lane_delegate_removed", sessionId, delegateId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove lane delegate" });
    }
  });

  app.patch("/api/composite-sessions/:id/steps/:sessionStepId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (session.ownerId !== userId && !member) {
        return res.status(403).json({ error: "You don't have access to this session" });
      }
      const sessionStepId = parseInt(req.params.sessionStepId);
      const sessionStep = session.sessionSteps.find((step: any) => step.id === sessionStepId);
      if (!sessionStep) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const compositeSteps = session.composite?.steps || [];
      const stepsById = new Map(session.sessionSteps.map((s: any) => [s.stepId, s]));

      const assignmentsForStep = session.assignments.filter((a: any) => a.stepId === sessionStep.stepId);

      const getNextIncompleteForAssignee = (assigneeId: string) => {
        const assigned = new Set(
          session.assignments.filter((a: any) => a.assigneeUserId === assigneeId).map((a: any) => a.stepId)
        );
        for (const step of compositeSteps) {
          if (!assigned.has(step.id)) continue;
          const sessionState = stepsById.get(step.id);
          if (sessionState && !sessionState.isCompleted) {
            return step.id;
          }
        }
        return null;
      };

      const canCompleteAsAssignee = assignmentsForStep.some((a: any) => {
        if (a.assigneeUserId !== userId) return false;
        return getNextIncompleteForAssignee(userId) === sessionStep.stepId;
      });

      const canCompleteAsDelegate = assignmentsForStep.some((a: any) => {
        if (a.assigneeUserId === userId) return false;
        if (!a.allowDelegation) return false;
        if (a.allowDelegationToEveryone) {
          return getNextIncompleteForAssignee(a.assigneeUserId) === sessionStep.stepId;
        }
        const delegates = Array.isArray(a.delegates) ? a.delegates : [];
        const hasAssignmentDelegates = delegates.length > 0;
        const isAssignmentDelegate = delegates.some((d: any) => d.delegateUserId === userId);
        if (hasAssignmentDelegates && !isAssignmentDelegate) return false;
        if (!hasAssignmentDelegates) {
          const assigneeMember = session.members.find((m: any) => m.userId === a.assigneeUserId);
          const laneDelegates = Array.isArray(assigneeMember?.laneDelegates) ? assigneeMember.laneDelegates : [];
          const isLaneDelegate = laneDelegates.some((d: any) => d.delegateUserId === userId);
          if (!isLaneDelegate) return false;
        }
        return getNextIncompleteForAssignee(a.assigneeUserId) === sessionStep.stepId;
      });

      const canComplete = canCompleteAsAssignee || canCompleteAsDelegate;

      if (req.body.isCompleted && !sessionStep.isCompleted) {
        if (sessionStep.proofRequired && !sessionStep.proofContent && !sessionStep.proofFilePath) {
          return res.status(400).json({ error: "Proof required before completion" });
        }
        if (!canComplete) {
          return res.status(403).json({ error: "You don't have permission to complete this step" });
        }
        const updated = await storage.updateCompositeWorkflowSessionStep(sessionStepId, {
          isCompleted: true,
          completedAt: new Date(),
          completedByUserId: userId,
        });
        // Session completion should not mutate the source composite step.
        broadcastSession(sessionId, {
          type: "session:step_completed",
          sessionId,
          stepId: sessionStep.stepId,
          sessionStepId,
        });
        return res.json(updated);
      }

      const updated = await storage.updateCompositeWorkflowSessionStep(sessionStepId, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Session step not found" });
      }
      broadcastSession(sessionId, { type: "session:step_updated", sessionId, sessionStepId, stepId: sessionStep.stepId });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update session step" });
    }
  });

  app.patch("/api/composite-sessions/:id/steps/:sessionStepId/content", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditSteps")) {
        return res.status(403).json({ error: "You don't have permission to edit steps" });
      }
      const sessionStepId = parseInt(req.params.sessionStepId);
      const sessionStep = session.sessionSteps.find((step: any) => step.id === sessionStepId);
      if (!sessionStep) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const updatePayload: Record<string, any> = {};
      for (const key of ["name", "description", "objective", "instructions"]) {
        if (req.body[key] !== undefined) {
          updatePayload[key] = req.body[key];
        }
      }
      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      const updated = await storage.updateStep(sessionStep.stepId, updatePayload);
      if (!updated) {
        return res.status(404).json({ error: "Step not found" });
      }
      broadcastSession(sessionId, { type: "session:step_content_updated", sessionId, stepId: sessionStep.stepId });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update step content" });
    }
  });

  app.patch("/api/composite-sessions/:id/steps/:sessionStepId/proof-config", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditProof")) {
        return res.status(403).json({ error: "You don't have permission to edit proofs" });
      }
      const sessionStepId = parseInt(req.params.sessionStepId);
      const sessionStep = session.sessionSteps.find((step: any) => step.id === sessionStepId);
      if (!sessionStep) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const updatePayload: Record<string, any> = {};
      for (const key of ["proofRequired", "proofTitle", "proofDescription"]) {
        if (req.body[key] !== undefined) {
          updatePayload[key] = req.body[key];
        }
      }
      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      const updated = await storage.updateCompositeWorkflowSessionStep(sessionStepId, updatePayload);
      if (!updated) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const withUrl = await attachProofUrl(updated);
      broadcastSession(sessionId, { type: "session:proof_config_updated", sessionId, sessionStepId });
      res.json(withUrl);
    } catch (error) {
      res.status(500).json({ error: "Failed to update proof config" });
    }
  });

  app.patch("/api/composite-sessions/:id/steps/:sessionStepId/proof", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditProof")) {
        return res.status(403).json({ error: "You don't have permission to edit proofs" });
      }
      const sessionStepId = parseInt(req.params.sessionStepId);
      const sessionStep = session.sessionSteps.find((step: any) => step.id === sessionStepId);
      if (!sessionStep) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const updatePayload: Record<string, any> = {};
      if (req.body.content !== undefined) {
        updatePayload.proofContent = req.body.content;
      }
      updatePayload.proofSubmittedAt = new Date();
      updatePayload.proofSubmittedByUserId = userId;
      const updated = await storage.updateCompositeWorkflowSessionStep(sessionStepId, updatePayload);
      if (!updated) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const withUrl = await attachProofUrl(updated);
      broadcastSession(sessionId, { type: "session:proof_submitted", sessionId, sessionStepId });
      res.json(withUrl);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit proof" });
    }
  });

  app.post("/api/composite-sessions/:id/steps/:sessionStepId/proof/upload", upload.single("file"), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditProof")) {
        return res.status(403).json({ error: "You don't have permission to edit proofs" });
      }
      const sessionStepId = parseInt(req.params.sessionStepId);
      const sessionStep = session.sessionSteps.find((step: any) => step.id === sessionStepId);
      if (!sessionStep) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "File is required" });
      }
      const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
      const objectPath = `${sessionId}/proofs/${sessionStep.stepId}/${Date.now()}-${safeName}`;
      if (sessionStep.proofFilePath) {
        await supabase.storage.from("intel-docs").remove([sessionStep.proofFilePath]);
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
      const updated = await storage.updateCompositeWorkflowSessionStep(sessionStepId, updatePayload);
      if (!updated) {
        return res.status(404).json({ error: "Session step not found" });
      }
      const withUrl = await attachProofUrl(updated);
      broadcastSession(sessionId, { type: "session:proof_submitted", sessionId, sessionStepId });
      res.status(201).json(withUrl);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload proof" });
    }
  });

  app.delete("/api/composite-sessions/:id/steps/:sessionStepId/proof", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditProof")) {
        return res.status(403).json({ error: "You don't have permission to edit proofs" });
      }
      const sessionStepId = parseInt(req.params.sessionStepId);
      const sessionStep = session.sessionSteps.find((step: any) => step.id === sessionStepId);
      if (!sessionStep) {
        return res.status(404).json({ error: "Session step not found" });
      }
      if (sessionStep.proofFilePath) {
        await supabase.storage.from("intel-docs").remove([sessionStep.proofFilePath]);
      }
      const updated = await storage.updateCompositeWorkflowSessionStep(sessionStepId, {
        proofContent: null,
        proofFilePath: null,
        proofFileName: null,
        proofMimeType: null,
        proofFileSize: null,
        proofSubmittedAt: null,
        proofSubmittedByUserId: null,
      });
      broadcastSession(sessionId, { type: "session:proof_deleted", sessionId, sessionStepId });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete proof" });
    }
  });

  app.post("/api/composite-sessions/:id/intel", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditIntel")) {
        return res.status(403).json({ error: "You don't have permission to edit intel" });
      }
      const validation = insertCompositeWorkflowSessionIntelDocSchema.safeParse({
        sessionId,
        stepId: req.body.stepId,
        title: req.body.title,
        content: req.body.content,
        docType: req.body.docType,
        filePath: req.body.filePath,
        fileName: req.body.fileName,
        mimeType: req.body.mimeType,
        fileSize: req.body.fileSize,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const doc = await storage.addCompositeWorkflowSessionIntelDoc(validation.data);
      broadcastSession(sessionId, { type: "session:intel_added", sessionId, doc });
      res.status(201).json(doc);
    } catch (error) {
      res.status(500).json({ error: "Failed to add session intel doc" });
    }
  });

  app.get("/api/composite-sessions/:id/intel", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (session.ownerId !== userId && !member) {
        return res.status(403).json({ error: "You don't have access to this session" });
      }
      const docs = await storage.getCompositeWorkflowSessionIntelDocs(sessionId);
      const docsWithUrls = await attachSignedUrls(docs);
      res.json(docsWithUrls);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch session intel docs" });
    }
  });

  app.post("/api/composite-sessions/:id/intel/upload", upload.single("file"), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditIntel")) {
        return res.status(403).json({ error: "You don't have permission to edit intel" });
      }
      const { title, docType, stepId } = req.body;
      const file = req.file;
      if (!title || !file || !stepId) {
        return res.status(400).json({ error: "Title, step, and file are required" });
      }

      const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
      const objectPath = `${sessionId}/steps/${stepId}/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage.from("intel-docs").upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });
      if (error) {
        console.error("Supabase upload error:", error);
        return res.status(500).json({ error: "Failed to upload file", details: error.message });
      }

      const validation = insertCompositeWorkflowSessionIntelDocSchema.safeParse({
        sessionId,
        stepId: parseInt(stepId, 10),
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
      const doc = await storage.addCompositeWorkflowSessionIntelDoc(validation.data);
      const [docWithUrl] = await attachSignedUrls([doc]);
      broadcastSession(sessionId, { type: "session:intel_added", sessionId, doc: docWithUrl });
      res.status(201).json(docWithUrl);
    } catch (error) {
      res.status(500).json({ error: "Failed to upload session intel doc" });
    }
  });

  app.delete("/api/composite-sessions/:id/intel/:docId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canEditIntel")) {
        return res.status(403).json({ error: "You don't have permission to edit intel" });
      }
      const docId = parseInt(req.params.docId);
      const existingDoc = await storage.getCompositeWorkflowSessionIntelDoc(docId);
      if (!existingDoc || existingDoc.sessionId !== sessionId) {
        return res.status(404).json({ error: "Intel doc not found" });
      }
      const removed = await storage.removeCompositeWorkflowSessionIntelDoc(docId);
      if (existingDoc.filePath) {
        await supabase.storage.from("intel-docs").remove([existingDoc.filePath]);
      }
      broadcastSession(sessionId, { type: "session:intel_removed", sessionId, docId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove session intel doc" });
    }
  });

  app.get("/api/composite-sessions/:id/messages", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (session.ownerId !== userId && !member) {
        return res.status(403).json({ error: "You don't have access to this session" });
      }
      const messages = await storage.getCompositeWorkflowSessionMessages(sessionId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/composite-sessions/:id/messages", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (!ensureSessionPermission(member, session.ownerId || null, userId, "canChat")) {
        return res.status(403).json({ error: "You don't have permission to chat" });
      }
      const validation = insertCompositeWorkflowSessionMessageSchema.safeParse({
        sessionId,
        userId,
        content: req.body.content,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const message = await storage.addCompositeWorkflowSessionMessage(validation.data);
      const memberUser = session.members?.find((member: any) => member.userId === userId)?.user || null;
      const payload = {
        ...message,
        user: memberUser,
        reads: [],
      };
      broadcastSession(sessionId, { type: "session:chat_message", sessionId, message: payload });
      res.status(201).json(payload);
    } catch (error) {
      res.status(500).json({ error: "Failed to send chat message" });
    }
  });

  app.post("/api/composite-sessions/:id/messages/read", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (session.ownerId !== userId && !member) {
        return res.status(403).json({ error: "You don't have access to this session" });
      }
      const messageIds: number[] = Array.isArray(req.body.messageIds)
        ? req.body.messageIds.map((id: any) => parseInt(id, 10)).filter((id: number) => !Number.isNaN(id))
        : [];
      if (!messageIds.length) {
        return res.status(400).json({ error: "No message ids provided" });
      }
      const messages = await storage.getCompositeWorkflowSessionMessages(sessionId);
      const validIds = new Set(messages.map((message) => message.id));
      const reads = [];
      for (const messageId of messageIds) {
        if (!validIds.has(messageId)) continue;
        const read = await storage.addCompositeWorkflowSessionMessageRead({ messageId, userId });
        if (read) reads.push(read);
      }
      broadcastSession(sessionId, { type: "session:chat_read", sessionId, userId, messageIds });
      res.json({ success: true, reads });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark messages read" });
    }
  });

  app.delete("/api/composite-sessions/:id/messages/:messageId", async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const sessionId = parseInt(req.params.id);
      const messageId = parseInt(req.params.messageId);
      const session = await storage.getCompositeWorkflowSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      const member = await getSessionMember(sessionId, userId);
      if (session.ownerId !== userId && !member) {
        return res.status(403).json({ error: "You don't have access to this session" });
      }
      const messages = await storage.getCompositeWorkflowSessionMessages(sessionId);
      const target = messages.find((message) => message.id === messageId);
      if (!target) {
        return res.status(404).json({ error: "Message not found" });
      }
      if (target.userId !== userId && session.ownerId !== userId) {
        return res.status(403).json({ error: "You don't have permission to delete this message" });
      }
      await storage.removeCompositeWorkflowSessionMessage(messageId);
      broadcastSession(sessionId, { type: "session:chat_deleted", sessionId, messageId });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  app.delete("/api/composites/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userId = getUserId(req);
      const composite = await storage.getCompositeWorkflowWithItems(id);
      if (!composite) {
        return res.status(404).json({ error: "Composite workflow not found" });
      }
      if (composite.ownerId && composite.ownerId !== userId) {
        return res.status(403).json({ error: "You can only delete composite workflows you own" });
      }
      await storage.deleteCompositeWorkflow(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete composite workflow" });
    }
  });

  app.post("/api/seed", async (req, res) => {
    try {
      const existingWorkflows = await storage.getWorkflows();
      if (existingWorkflows.length > 0) {
        return res.json({ message: "Database already seeded" });
      }

      const workflow1 = await storage.createWorkflow({
        name: "Core Platform Launch",
        description: "Deploy production-ready platform with all core features",
        totalSteps: 8,
        currentStep: 3,
        isActive: true,
        status: "active",
        priority: "critical",
      });

      const stepData1 = [
        { name: "Discovery & Requirements", description: "Gather stakeholder requirements and define scope", objective: "Document all requirements and success criteria", instructions: "1. Meet with stakeholders\n2. Document requirements\n3. Get sign-off", status: "completed" },
        { name: "Architecture Design", description: "Design system architecture and data models", objective: "Create technical architecture documentation", instructions: "1. Design database schema\n2. Define API contracts\n3. Review with team", status: "completed" },
        { name: "Core Development", description: "Build core platform features", objective: "Implement MVP features", instructions: "1. Set up development environment\n2. Implement core features\n3. Write unit tests", status: "active" },
        { name: "Integration Testing", description: "Test all integrations and data flows", objective: "Ensure all systems work together", instructions: "1. Write integration tests\n2. Test API endpoints\n3. Validate data flows", status: "locked", requiresApproval: true },
        { name: "Security Audit", description: "Conduct security review and penetration testing", objective: "Identify and fix security vulnerabilities", instructions: "1. Run security scans\n2. Fix critical issues\n3. Document findings", status: "locked" },
        { name: "Performance Optimization", description: "Optimize for speed and scalability", objective: "Meet performance benchmarks", instructions: "1. Profile application\n2. Optimize bottlenecks\n3. Load testing", status: "locked" },
        { name: "Staging Deployment", description: "Deploy to staging environment", objective: "Successful staging deployment", instructions: "1. Configure staging\n2. Deploy application\n3. Smoke testing", status: "locked", requiresApproval: true },
        { name: "Production Launch", description: "Go live with production deployment", objective: "Successful production launch", instructions: "1. Final review\n2. Deploy to production\n3. Monitor metrics", status: "locked", requiresApproval: true },
      ];

      for (let i = 0; i < stepData1.length; i++) {
        const step = await storage.createStep({
          workflowId: workflow1.id,
          stepNumber: i + 1,
          ...stepData1[i],
          isCompleted: stepData1[i].status === "completed",
        });

        if (i === 2) {
          await storage.createIntelDoc({
            stepId: step.id,
            title: "Development Guidelines",
            content: "Follow our coding standards and ensure all code is reviewed before merging. Use feature branches and write meaningful commit messages.",
            docType: "guideline",
          });
          await storage.createIntelDoc({
            stepId: step.id,
            title: "API Documentation",
            content: "Refer to the API design document for endpoint specifications and authentication requirements.",
            docType: "reference",
          });
        }
      }

      const workflow2 = await storage.createWorkflow({
        name: "Q4 Analytics Dashboard",
        description: "Build comprehensive analytics dashboard for quarterly metrics",
        totalSteps: 5,
        currentStep: 1,
        isActive: false,
        status: "active",
        priority: "high",
      });

      const stepData2 = [
        { name: "Data Source Integration", description: "Connect all data sources", status: "active" },
        { name: "Dashboard Design", description: "Design dashboard layouts and visualizations", status: "locked" },
        { name: "Report Builder", description: "Create customizable report builder", status: "locked" },
        { name: "User Testing", description: "Conduct user testing sessions", status: "locked", requiresApproval: true },
        { name: "Launch", description: "Deploy analytics dashboard", status: "locked" },
      ];

      for (let i = 0; i < stepData2.length; i++) {
        await storage.createStep({
          workflowId: workflow2.id,
          stepNumber: i + 1,
          name: stepData2[i].name,
          description: stepData2[i].description,
          status: stepData2[i].status,
          requiresApproval: stepData2[i].requiresApproval || false,
        });
      }

      const workflow3 = await storage.createWorkflow({
        name: "Mobile App Redesign",
        description: "Complete redesign of mobile application UI/UX",
        totalSteps: 6,
        currentStep: 2,
        isActive: false,
        status: "active",
        priority: "medium",
      });

      const stepData3 = [
        { name: "User Research", description: "Conduct user research and interviews", status: "completed" },
        { name: "Wireframing", description: "Create low-fidelity wireframes", status: "active" },
        { name: "Visual Design", description: "Create high-fidelity mockups", status: "locked" },
        { name: "Prototyping", description: "Build interactive prototype", status: "locked" },
        { name: "Development Handoff", description: "Prepare design specs for development", status: "locked", requiresApproval: true },
        { name: "QA & Launch", description: "Quality assurance and launch", status: "locked" },
      ];

      for (let i = 0; i < stepData3.length; i++) {
        await storage.createStep({
          workflowId: workflow3.id,
          stepNumber: i + 1,
          name: stepData3[i].name,
          description: stepData3[i].description,
          status: stepData3[i].status,
          isCompleted: stepData3[i].status === "completed",
          requiresApproval: stepData3[i].requiresApproval || false,
        });
      }

      await storage.createActivity({
        workflowId: workflow1.id,
        action: "workflow_started",
        description: "Core Platform Launch workflow initiated",
      });

      res.json({ message: "Database seeded successfully", activeWorkflow: workflow1 });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  return httpServer;
}
