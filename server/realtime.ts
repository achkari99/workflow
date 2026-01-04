import { Server as HttpServer, ServerResponse } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { sessionMiddleware } from "./auth";
import { storage } from "./storage";

type SessionMap = Map<number, Set<WebSocket>>;

const sessionSockets: SessionMap = new Map();

export function setupRealtime(httpServer: HttpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const res = new ServerResponse(req);
    const pending: string[] = [];
    let ready = false;

    const handleMessage = async (raw: string) => {
      try {
        const message = JSON.parse(raw);
        if (message.type === "session:subscribe" && typeof message.sessionId === "number") {
          const userId = (req as any).session?.passport?.user;
          if (!userId) {
            ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
            return;
          }
          const session = await storage.getCompositeWorkflowSession(message.sessionId);
          if (!session) {
            ws.send(JSON.stringify({ type: "error", message: "Session not found" }));
            return;
          }
          const hasAccess =
            session.ownerId === userId ||
            session.members?.some((member: any) => member.userId === userId);
          if (!hasAccess) {
            ws.send(JSON.stringify({ type: "error", message: "Forbidden" }));
            return;
          }
          const current = sessionSockets.get(message.sessionId) || new Set();
          current.add(ws);
          sessionSockets.set(message.sessionId, current);
          ws.send(JSON.stringify({ type: "session:subscribed", sessionId: message.sessionId }));
        }
      } catch {
        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
      }
    };

    ws.on("message", (raw) => {
      const text = raw.toString();
      if (!ready) {
        pending.push(text);
        return;
      }
      void handleMessage(text);
    });

    sessionMiddleware(req as any, res as any, () => {
      ready = true;
      if (pending.length) {
        const backlog = [...pending];
        pending.length = 0;
        backlog.forEach((item) => {
          void handleMessage(item);
        });
      }
    });

    ws.on("close", () => {
      for (const [sessionId, sockets] of sessionSockets.entries()) {
        if (sockets.has(ws)) {
          sockets.delete(ws);
        }
        if (sockets.size === 0) {
          sessionSockets.delete(sessionId);
        }
      }
    });
  });
}

export function broadcastSession(sessionId: number, payload: unknown) {
  const sockets = sessionSockets.get(sessionId);
  if (!sockets) return;
  const message = JSON.stringify(payload);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }
}
