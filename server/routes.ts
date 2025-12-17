import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import type { VideoJob } from "@shared/schema";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const PROCESSED_DIR = path.join(process.cwd(), "processed");
const MAX_CONCURRENT_JOBS = 2;

let activeJobs = 0;
const processingQueue: VideoJob[] = [];

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(PROCESSED_DIR)) {
  fs.mkdirSync(PROCESSED_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `${uniqueSuffix}${ext}`);
    },
  }),
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only video files are allowed (MP4, MOV, AVI, WebM)"));
    }
  },
});

function processNextInQueue(): void {
  if (activeJobs >= MAX_CONCURRENT_JOBS || processingQueue.length === 0) {
    return;
  }
  
  const job = processingQueue.shift();
  if (!job) return;
  
  activeJobs++;
  processWatermarkRemoval(job)
    .catch((err) => {
      console.error("Processing error:", err);
    })
    .finally(() => {
      activeJobs--;
      processNextInQueue();
    });
}

function queueJob(job: VideoJob): void {
  processingQueue.push(job);
  processNextInQueue();
}

async function processWatermarkRemoval(job: VideoJob): Promise<void> {
  const inputPath = job.originalPath;
  const outputFilename = `processed-${path.basename(inputPath)}`;
  const outputPath = path.join(PROCESSED_DIR, outputFilename);

  if (!fs.existsSync(inputPath)) {
    await storage.updateVideoJobError(job.id, "Source file not found");
    throw new Error("Source file not found");
  }

  await storage.updateVideoJobStatus(job.id, "processing", 0);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", inputPath,
      "-vf", "delogo=x=10:y=10:w=200:h=50:show=0",
      "-c:a", "copy",
      "-y",
      outputPath,
    ]);

    let duration = 0;
    let currentTime = 0;

    ffmpeg.stderr.on("data", async (data: Buffer) => {
      const output = data.toString();

      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})/);
      if (durationMatch) {
        const hours = parseInt(durationMatch[1]);
        const minutes = parseInt(durationMatch[2]);
        const seconds = parseInt(durationMatch[3]);
        duration = hours * 3600 + minutes * 60 + seconds;
      }

      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
      if (timeMatch && duration > 0) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseInt(timeMatch[3]);
        currentTime = hours * 3600 + minutes * 60 + seconds;
        const progress = Math.min(Math.round((currentTime / duration) * 100), 99);
        await storage.updateVideoJobStatus(job.id, "processing", progress);
      }
    });

    ffmpeg.on("close", async (code) => {
      if (code === 0) {
        await storage.updateVideoJobProcessedPath(job.id, outputPath);
        await storage.updateVideoJobStatus(job.id, "complete", 100);
        resolve();
      } else {
        await storage.updateVideoJobError(job.id, "Processing failed. Please try again.");
        reject(new Error("FFmpeg processing failed"));
      }
    });

    ffmpeg.on("error", async (err) => {
      await storage.updateVideoJobError(job.id, "FFmpeg not available or failed to start");
      reject(err);
    });
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/upload", upload.single("video"), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const format = path.extname(req.file.originalname).slice(1).toLowerCase() || "mp4";

      const job = await storage.createVideoJob({
        originalFilename: req.file.originalname,
        originalPath: req.file.path,
        fileSize: req.file.size,
        format,
      });

      await storage.updateVideoJobStatus(job.id, "uploading", 100);

      queueJob(job);

      res.json(job);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.get("/api/jobs", async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllVideoJobs();
      res.json(jobs);
    } catch (error) {
      console.error("Get jobs error:", error);
      res.status(500).json({ error: "Failed to get jobs" });
    }
  });

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const job = await storage.getVideoJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Get job error:", error);
      res.status(500).json({ error: "Failed to get job" });
    }
  });

  app.get("/api/jobs/:id/download", async (req: Request, res: Response) => {
    try {
      const job = await storage.getVideoJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.status !== "complete" || !job.processedPath) {
        return res.status(400).json({ error: "File not ready for download" });
      }
      if (!fs.existsSync(job.processedPath)) {
        return res.status(404).json({ error: "Processed file not found" });
      }

      const downloadName = `clean-${job.originalFilename}`;
      res.download(job.processedPath, downloadName);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  app.delete("/api/jobs/:id", async (req: Request, res: Response) => {
    try {
      const job = await storage.getVideoJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.originalPath && fs.existsSync(job.originalPath)) {
        fs.unlinkSync(job.originalPath);
      }
      if (job.processedPath && fs.existsSync(job.processedPath)) {
        fs.unlinkSync(job.processedPath);
      }

      await storage.deleteVideoJob(job.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete job" });
    }
  });

  app.post("/api/jobs/:id/retry", async (req: Request, res: Response) => {
    try {
      const job = await storage.getVideoJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      if (job.status !== "error") {
        return res.status(400).json({ error: "Can only retry failed jobs" });
      }

      await storage.updateVideoJobStatus(job.id, "uploading", 0);

      queueJob(job);

      const updatedJob = await storage.getVideoJob(job.id);
      res.json(updatedJob);
    } catch (error) {
      console.error("Retry error:", error);
      res.status(500).json({ error: "Failed to retry job" });
    }
  });

  return httpServer;
}
