import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkflowSchema, insertStepSchema, insertApprovalSchema, insertIntelDocSchema, insertWorkflowShareSchema, insertCompositeWorkflowSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

function getUserId(req: Request): string | undefined {
  return (req as any).user?.claims?.sub;
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
      
      for (let i = 1; i <= workflow.totalSteps; i++) {
        await storage.createStep({
          workflowId: workflow.id,
          stepNumber: i,
          name: `Step ${i}`,
          description: `Complete step ${i}`,
          status: i === 1 ? "active" : "locked",
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
      const workflow = await storage.advanceWorkflowStep(id);
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
      res.json(step);
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
      const step = await storage.completeStep(id);
      if (!step) {
        return res.status(404).json({ error: "Step not found" });
      }
      res.json(step);
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
      res.json(docs);
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
      res.status(500).json({ error: "Failed to fetch composite workflow" });
    }
  });

  app.post("/api/composites", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { name, description, workflowIds = [] } = req.body;
      
      const validation = insertCompositeWorkflowSchema.safeParse({
        name,
        description,
        ownerId: userId,
      });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      
      const composite = await storage.createCompositeWorkflow(validation.data);

      for (let i = 0; i < workflowIds.length; i++) {
        await storage.addWorkflowToComposite({
          compositeId: composite.id,
          workflowId: workflowIds[i],
          orderIndex: i,
        });
      }

      res.status(201).json(composite);
    } catch (error) {
      res.status(500).json({ error: "Failed to create composite workflow" });
    }
  });

  app.post("/api/composites/:id/workflows", async (req, res) => {
    try {
      const compositeId = parseInt(req.params.id);
      const { workflowId, orderIndex = 0 } = req.body;
      
      const item = await storage.addWorkflowToComposite({
        compositeId,
        workflowId,
        orderIndex,
      });
      res.status(201).json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to add workflow to composite" });
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
