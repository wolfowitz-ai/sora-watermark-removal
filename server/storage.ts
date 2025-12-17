import { type User, type InsertUser, type VideoJob, type InsertVideoJob, type JobStatus, type WatermarkKeyframe, type InsertKeyframe } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createVideoJob(job: InsertVideoJob): Promise<VideoJob>;
  getVideoJob(id: string): Promise<VideoJob | undefined>;
  getAllVideoJobs(): Promise<VideoJob[]>;
  updateVideoJobStatus(id: string, status: JobStatus, progress?: number): Promise<VideoJob | undefined>;
  updateVideoJobProcessedPath(id: string, processedPath: string): Promise<VideoJob | undefined>;
  updateVideoJobError(id: string, errorMessage: string): Promise<VideoJob | undefined>;
  deleteVideoJob(id: string): Promise<boolean>;
  
  // Keyframe operations
  createKeyframe(keyframe: InsertKeyframe): Promise<WatermarkKeyframe>;
  getKeyframesForJob(jobId: string): Promise<WatermarkKeyframe[]>;
  updateKeyframe(id: string, keyframe: Partial<InsertKeyframe>): Promise<WatermarkKeyframe | undefined>;
  deleteKeyframe(id: string): Promise<boolean>;
  deleteKeyframesForJob(jobId: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videoJobs: Map<string, VideoJob>;
  private keyframes: Map<string, WatermarkKeyframe>;

  constructor() {
    this.users = new Map();
    this.videoJobs = new Map();
    this.keyframes = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createVideoJob(job: InsertVideoJob): Promise<VideoJob> {
    const id = randomUUID();
    const videoJob: VideoJob = {
      id,
      originalFilename: job.originalFilename,
      originalPath: job.originalPath,
      processedPath: null,
      fileSize: job.fileSize,
      format: job.format,
      status: "uploading",
      progress: 0,
      errorMessage: null,
      createdAt: new Date(),
    };
    this.videoJobs.set(id, videoJob);
    return videoJob;
  }

  async getVideoJob(id: string): Promise<VideoJob | undefined> {
    return this.videoJobs.get(id);
  }

  async getAllVideoJobs(): Promise<VideoJob[]> {
    return Array.from(this.videoJobs.values()).sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async updateVideoJobStatus(id: string, status: JobStatus, progress?: number): Promise<VideoJob | undefined> {
    const job = this.videoJobs.get(id);
    if (!job) return undefined;
    
    job.status = status;
    if (progress !== undefined) {
      job.progress = progress;
    }
    this.videoJobs.set(id, job);
    return job;
  }

  async updateVideoJobProcessedPath(id: string, processedPath: string): Promise<VideoJob | undefined> {
    const job = this.videoJobs.get(id);
    if (!job) return undefined;
    
    job.processedPath = processedPath;
    this.videoJobs.set(id, job);
    return job;
  }

  async updateVideoJobError(id: string, errorMessage: string): Promise<VideoJob | undefined> {
    const job = this.videoJobs.get(id);
    if (!job) return undefined;
    
    job.status = "error";
    job.errorMessage = errorMessage;
    this.videoJobs.set(id, job);
    return job;
  }

  async deleteVideoJob(id: string): Promise<boolean> {
    // Also delete associated keyframes
    await this.deleteKeyframesForJob(id);
    return this.videoJobs.delete(id);
  }

  async createKeyframe(keyframe: InsertKeyframe): Promise<WatermarkKeyframe> {
    const id = randomUUID();
    const newKeyframe: WatermarkKeyframe = {
      id,
      jobId: keyframe.jobId,
      startTime: keyframe.startTime,
      endTime: keyframe.endTime,
      x: keyframe.x,
      y: keyframe.y,
      width: keyframe.width,
      height: keyframe.height,
    };
    this.keyframes.set(id, newKeyframe);
    return newKeyframe;
  }

  async getKeyframesForJob(jobId: string): Promise<WatermarkKeyframe[]> {
    return Array.from(this.keyframes.values())
      .filter(kf => kf.jobId === jobId)
      .sort((a, b) => a.startTime - b.startTime);
  }

  async updateKeyframe(id: string, updates: Partial<InsertKeyframe>): Promise<WatermarkKeyframe | undefined> {
    const keyframe = this.keyframes.get(id);
    if (!keyframe) return undefined;
    
    const updated: WatermarkKeyframe = {
      ...keyframe,
      ...updates,
      id: keyframe.id,
      jobId: keyframe.jobId,
    };
    this.keyframes.set(id, updated);
    return updated;
  }

  async deleteKeyframe(id: string): Promise<boolean> {
    return this.keyframes.delete(id);
  }

  async deleteKeyframesForJob(jobId: string): Promise<boolean> {
    const toDelete = Array.from(this.keyframes.values())
      .filter(kf => kf.jobId === jobId)
      .map(kf => kf.id);
    
    for (const id of toDelete) {
      this.keyframes.delete(id);
    }
    return true;
  }
}

export const storage = new MemStorage();
