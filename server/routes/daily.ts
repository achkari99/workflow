import type { Express, Request } from "express";
import { storage } from "../storage";
import { insertDailyTaskSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { isAuthenticated } from "../auth";

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.id;
}

export function registerDailyRoutes(app: Express) {
  app.get("/api/daily", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const tasks = await storage.getDailyTasksByUser(userId);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch daily tasks" });
    }
  });

  app.post("/api/daily", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const validation = insertDailyTaskSchema.safeParse({ ...req.body, userId });
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const task = await storage.createDailyTask(validation.data);
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to create daily task" });
    }
  });

  app.patch("/api/daily/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getDailyTasksByUser(userId);
      const task = existing.find((item) => item.id === id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      const updatePayload: Record<string, any> = {};
      if (typeof req.body.title === "string") updatePayload.title = req.body.title;
      if (typeof req.body.priority === "string") updatePayload.priority = req.body.priority;
      if (typeof req.body.isCompleted === "boolean") updatePayload.isCompleted = req.body.isCompleted;
      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      const updated = await storage.updateDailyTask(id, updatePayload);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update daily task" });
    }
  });

  app.delete("/api/daily/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const id = parseInt(req.params.id);
      const existing = await storage.getDailyTasksByUser(userId);
      const task = existing.find((item) => item.id === id);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      await storage.deleteDailyTask(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete daily task" });
    }
  });
}
