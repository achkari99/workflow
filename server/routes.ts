import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { registerWorkflowRoutes } from "./routes/workflows";
import { registerIntelRoutes } from "./routes/intel";
import { registerCompositeRoutes } from "./routes/composites";
import { registerRootRoutes } from "./routes/root";
import { registerNoteRoutes } from "./routes/notes";
import { registerAudioRoutes } from "./routes/audio";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication first
  await setupAuth(app);

  // Register modular routes
  registerWorkflowRoutes(app);
  registerIntelRoutes(app);
  registerCompositeRoutes(app);
  registerRootRoutes(app);
  registerNoteRoutes(app);
  registerAudioRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
