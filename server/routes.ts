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

interface WatermarkSegment {
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DetectionResult {
  success?: boolean;
  error?: string;
  watermark_detected?: boolean;
  segments?: WatermarkSegment[];
  default_position?: { x: number; y: number; w: number; h: number };
  video_info?: { width: number; height: number; duration: number; fps: number };
}

async function detectWatermarkPositions(videoPath: string): Promise<DetectionResult> {
  const scriptPath = path.join(process.cwd(), "server", "detect_watermark.py");
  
  return new Promise((resolve) => {
    const python = spawn("python3", [scriptPath, videoPath]);
    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (code === 0 && stdout) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          console.error("Failed to parse detection output:", stdout);
          resolve({ success: false, error: "Failed to parse detection result" });
        }
      } else {
        console.error("Detection script failed:", stderr);
        resolve({ success: false, error: stderr || "Detection failed" });
      }
    });

    python.on("error", (err) => {
      console.error("Failed to run detection script:", err);
      resolve({ success: false, error: "Detection script not available" });
    });
  });
}

function validateAndClampSegment(seg: WatermarkSegment, videoWidth?: number, videoHeight?: number): WatermarkSegment | null {
  const x = Math.max(0, Math.round(seg.x));
  const y = Math.max(0, Math.round(seg.y));
  let w = Math.round(seg.w);
  let h = Math.round(seg.h);
  
  if (videoWidth && x + w > videoWidth) {
    w = videoWidth - x;
  }
  if (videoHeight && y + h > videoHeight) {
    h = videoHeight - y;
  }
  
  if (w < 10 || h < 10 || x < 0 || y < 0) {
    return null;
  }
  
  return { ...seg, x, y, w, h };
}

function buildDynamicDelogoFilter(segments: WatermarkSegment[], duration: number, videoWidth?: number, videoHeight?: number): string {
  if (!segments || segments.length === 0) {
    return "delogo=x=10:y=10:w=200:h=50:show=0";
  }

  const validSegments = segments
    .map(seg => validateAndClampSegment(seg, videoWidth, videoHeight))
    .filter((seg): seg is WatermarkSegment => seg !== null);
  
  if (validSegments.length === 0) {
    return "delogo=x=10:y=10:w=200:h=50:show=0";
  }

  if (validSegments.length === 1) {
    const seg = validSegments[0];
    return `delogo=x=${seg.x}:y=${seg.y}:w=${seg.w}:h=${seg.h}:show=0`;
  }

  const filters: string[] = [];
  
  for (let i = 0; i < validSegments.length; i++) {
    const seg = validSegments[i];
    const start = seg.start;
    const end = seg.end;
    
    filters.push(
      `delogo=x=${seg.x}:y=${seg.y}:w=${seg.w}:h=${seg.h}:show=0:enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`
    );
  }
  
  return filters.join(",");
}

async function processWatermarkRemoval(job: VideoJob): Promise<void> {
  const inputPath = job.originalPath;
  const outputFilename = `processed-${path.basename(inputPath)}`;
  const outputPath = path.join(PROCESSED_DIR, outputFilename);

  if (!fs.existsSync(inputPath)) {
    await storage.updateVideoJobError(job.id, "Source file not found");
    throw new Error("Source file not found");
  }

  await storage.updateVideoJobStatus(job.id, "processing", 5);

  console.log("Detecting watermark positions...");
  const detection = await detectWatermarkPositions(inputPath);
  
  let videoFilter: string;
  
  if (detection.success && detection.watermark_detected && detection.segments && detection.segments.length > 0) {
    console.log(`Watermark detected with ${detection.segments.length} position segment(s)`);
    const duration = detection.video_info?.duration || 60;
    const videoWidth = detection.video_info?.width;
    const videoHeight = detection.video_info?.height;
    videoFilter = buildDynamicDelogoFilter(detection.segments, duration, videoWidth, videoHeight);
  } else if (detection.success && detection.default_position) {
    console.log("Using default watermark position");
    const pos = detection.default_position;
    videoFilter = `delogo=x=${pos.x}:y=${pos.y}:w=${pos.w}:h=${pos.h}:show=0`;
  } else {
    console.log("Detection failed or no watermark found, using fallback position");
    videoFilter = "delogo=x=10:y=10:w=200:h=50:show=0";
  }

  console.log("Applying filter:", videoFilter);
  await storage.updateVideoJobStatus(job.id, "processing", 10);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i", inputPath,
      "-vf", videoFilter,
      "-c:a", "copy",
      "-y",
      outputPath,
    ]);

    let duration = 0;
    let currentTime = 0;
    let ffmpegOutput = "";

    ffmpeg.stderr.on("data", async (data: Buffer) => {
      const output = data.toString();
      ffmpegOutput += output;

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
        const progress = 10 + Math.min(Math.round((currentTime / duration) * 89), 89);
        await storage.updateVideoJobStatus(job.id, "processing", progress);
      }
    });

    ffmpeg.on("close", async (code) => {
      if (code === 0) {
        await storage.updateVideoJobProcessedPath(job.id, outputPath);
        await storage.updateVideoJobStatus(job.id, "complete", 100);
        resolve();
      } else {
        console.error("FFmpeg error output:", ffmpegOutput);
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
