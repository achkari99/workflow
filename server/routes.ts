import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkflowSchema, insertStepSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/workflows", async (req, res) => {
    try {
      const workflows = await storage.getWorkflows();
      res.json(workflows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflows" });
    }
  });

  app.get("/api/workflows/active", async (req, res) => {
    try {
      const workflow = await storage.getActiveWorkflow();
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
      const workflow = await storage.getWorkflow(id);
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
      const validation = insertWorkflowSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const workflow = await storage.createWorkflow(validation.data);
      res.status(201).json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to create workflow" });
    }
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.updateWorkflow(id, req.body);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to update workflow" });
    }
  });

  app.post("/api/workflows/:id/set-active", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.setActiveWorkflow(id);
      const workflow = await storage.getWorkflow(id);
      res.json(workflow);
    } catch (error) {
      res.status(500).json({ error: "Failed to set active workflow" });
    }
  });

  app.post("/api/workflows/:id/advance", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const workflow = await storage.advanceWorkflowStep(id);
      if (!workflow) {
        return res.status(404).json({ error: "Workflow not found" });
      }
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

  app.post("/api/seed", async (req, res) => {
    try {
      const existingWorkflows = await storage.getWorkflows();
      if (existingWorkflows.length > 0) {
        return res.json({ message: "Database already seeded" });
      }

      const workflow1 = await storage.createWorkflow({
        name: "Core Platform Launch",
        description: "Lock the Scope",
        totalSteps: 8,
        currentStep: 3,
        isActive: true,
      });

      await storage.createWorkflow({
        name: "Q4 Analytics Review",
        description: "Review quarterly metrics",
        totalSteps: 5,
        currentStep: 1,
        isActive: false,
      });

      await storage.createWorkflow({
        name: "Design System Update",
        description: "Modernize component library",
        totalSteps: 6,
        currentStep: 2,
        isActive: false,
      });

      res.json({ message: "Database seeded successfully", activeWorkflow: workflow1 });
    } catch (error) {
      res.status(500).json({ error: "Failed to seed database" });
    }
  });

  return httpServer;
}
