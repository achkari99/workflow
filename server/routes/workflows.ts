import type { Express, Request } from "express";
import { storage } from "../storage";
import { insertWorkflowSchema, insertStepSchema, insertApprovalSchema, insertWorkflowShareSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { isAuthenticated } from "../auth";

function getUserId(req: Request): string | undefined {
    return (req.user as any)?.id;
}

export function registerWorkflowRoutes(app: Express) {
    app.get("/api/workflows", isAuthenticated, async (req, res) => {
        try {
            const userId = getUserId(req);
            const workflows = await storage.getWorkflows(userId);
            res.json(workflows);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch workflows" });
        }
    });

    app.get("/api/workflows/active", isAuthenticated, async (req, res) => {
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

    app.get("/api/workflows/:id", isAuthenticated, async (req, res) => {
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

    app.post("/api/workflows", isAuthenticated, async (req, res) => {
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

    app.patch("/api/workflows/:id", isAuthenticated, async (req, res) => {
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

    app.delete("/api/workflows/:id", isAuthenticated, async (req, res) => {
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

    app.post("/api/workflows/:id/set-active", isAuthenticated, async (req, res) => {
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

    app.post("/api/workflows/:id/advance", isAuthenticated, async (req, res) => {
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

    app.get("/api/workflows/:id/steps", isAuthenticated, async (req, res) => {
        try {
            const workflowId = parseInt(req.params.id);
            const steps = await storage.getStepsByWorkflow(workflowId);
            res.json(steps);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch steps" });
        }
    });

    app.get("/api/workflows/:id/activities", isAuthenticated, async (req, res) => {
        try {
            const workflowId = parseInt(req.params.id);
            const activities = await storage.getActivitiesByWorkflow(workflowId);
            res.json(activities);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch activities" });
        }
    });

    app.post("/api/steps", isAuthenticated, async (req, res) => {
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

    app.patch("/api/steps/:id", isAuthenticated, async (req, res) => {
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

    app.post("/api/steps/:id/complete", isAuthenticated, async (req, res) => {
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

    app.post("/api/steps/:id/start", isAuthenticated, async (req, res) => {
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

    app.post("/api/steps/:id/request-approval", isAuthenticated, async (req, res) => {
        try {
            const stepId = parseInt(req.params.id);
            await storage.updateStep(stepId, { status: "pending_approval" });
            const approval = await storage.createApproval({ stepId, status: "pending" });
            res.status(201).json(approval);
        } catch (error) {
            res.status(500).json({ error: "Failed to request approval" });
        }
    });

    app.get("/api/approvals/:id", isAuthenticated, async (req, res) => {
        try {
            const stepId = parseInt(req.params.id);
            const approvals = await storage.getApprovalsByStep(stepId);
            res.json(approvals);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch approvals" });
        }
    });

    app.patch("/api/approvals/:id", isAuthenticated, async (req, res) => {
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

    app.get("/api/workflows/:id/shares", isAuthenticated, async (req, res) => {
        try {
            const workflowId = parseInt(req.params.id);
            const shares = await storage.getWorkflowShares(workflowId);
            res.json(shares);
        } catch (error) {
            res.status(500).json({ error: "Failed to fetch shares" });
        }
    });

    app.post("/api/workflows/:id/share", isAuthenticated, async (req, res) => {
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

    app.delete("/api/shares/:id", isAuthenticated, async (req, res) => {
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
}
