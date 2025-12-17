import { type User, type InsertUser, type VideoJob, type InsertVideoJob, type JobStatus } from "@shared/schema";
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private videoJobs: Map<string, VideoJob>;

  constructor() {
    this.users = new Map();
    this.videoJobs = new Map();
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
    return this.videoJobs.delete(id);
  }
}

export const storage = new MemStorage();
