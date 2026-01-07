import type { Express, Request } from "express";
import multer from "multer";
import { storage } from "../storage";
import { supabase } from "../supabase";
import { insertAudioTrackSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { isAuthenticated } from "../auth";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

const AUDIO_BUCKET = "intel-docs";

function getUserId(req: Request): string | undefined {
  return (req.user as any)?.id;
}

async function attachSignedUrls(tracks: any[]) {
  return Promise.all(
    tracks.map(async (track) => {
      const { data } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(track.filePath, 60 * 60);
      return { ...track, fileUrl: data?.signedUrl || null };
    })
  );
}

export function registerAudioRoutes(app: Express) {
  app.get("/api/audio", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const tracks = await storage.getAudioTracksByUser(userId);
      const tracksWithUrls = await attachSignedUrls(tracks);
      res.json(tracksWithUrls);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audio tracks" });
    }
  });

  app.post("/api/audio/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "File is required" });
      }
      const safeName = file.originalname.replace(/[^\w.\-]+/g, "_");
      const objectPath = `${userId}/audio/${Date.now()}-${safeName}`;
      let { error } = await supabase.storage.from(AUDIO_BUCKET).upload(objectPath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

      if (error && (error as any).statusCode === "415") {
        const retry = await supabase.storage.from(AUDIO_BUCKET).upload(objectPath, file.buffer, {
          contentType: "application/octet-stream",
          upsert: false,
        });
        error = retry.error;
      }

      if (error) {
        console.error("Audio upload error:", error);
        return res.status(500).json({ error: "Failed to upload audio", details: error.message });
      }

      const durationSec = Number.isFinite(Number(req.body.durationSec)) ? Math.round(Number(req.body.durationSec)) : null;
      const payload = {
        userId,
        title: typeof req.body.title === "string" && req.body.title.trim() ? req.body.title.trim() : file.originalname,
        album: typeof req.body.album === "string" && req.body.album.trim() ? req.body.album.trim() : null,
        filePath: objectPath,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        durationSec,
      };
      const validation = insertAudioTrackSchema.safeParse(payload);
      if (!validation.success) {
        return res.status(400).json({ error: fromError(validation.error).toString() });
      }
      const track = await storage.createAudioTrack(validation.data);
      const [trackWithUrl] = await attachSignedUrls([track]);
      res.status(201).json(trackWithUrl);
    } catch (error) {
      console.error("Audio upload failed:", error);
      res.status(500).json({ error: "Failed to upload audio" });
    }
  });

  app.patch("/api/audio/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const id = parseInt(req.params.id);
      const track = await storage.getAudioTrack(id);
      if (!track || track.userId !== userId) {
        return res.status(404).json({ error: "Track not found" });
      }
      const updatePayload: Record<string, any> = {};
      if (typeof req.body.title === "string") updatePayload.title = req.body.title;
      if (typeof req.body.album === "string" || req.body.album === null) updatePayload.album = req.body.album;
      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ error: "No updates provided" });
      }
      const updated = await storage.updateAudioTrack(id, updatePayload);
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update track" });
    }
  });

  app.delete("/api/audio/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const id = parseInt(req.params.id);
      const track = await storage.getAudioTrack(id);
      if (!track || track.userId !== userId) {
        return res.status(404).json({ error: "Track not found" });
      }
      await storage.deleteAudioTrack(id);
      if (track.filePath) {
        await supabase.storage.from(AUDIO_BUCKET).remove([track.filePath]);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete track" });
    }
  });
}
