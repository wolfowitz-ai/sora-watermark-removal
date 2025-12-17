import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type JobStatus = "uploading" | "processing" | "complete" | "error";

export const videoJobs = pgTable("video_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalFilename: text("original_filename").notNull(),
  originalPath: text("original_path").notNull(),
  processedPath: text("processed_path"),
  fileSize: integer("file_size").notNull(),
  format: text("format").notNull(),
  status: text("status").$type<JobStatus>().notNull().default("uploading"),
  progress: integer("progress").notNull().default(0),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVideoJobSchema = createInsertSchema(videoJobs).omit({
  id: true,
  processedPath: true,
  status: true,
  progress: true,
  errorMessage: true,
  createdAt: true,
});

export type InsertVideoJob = z.infer<typeof insertVideoJobSchema>;
export type VideoJob = typeof videoJobs.$inferSelect;

// Keyframe for manual watermark marking
export interface WatermarkKeyframe {
  id: string;
  jobId: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
  x: number;          // pixels from left
  y: number;          // pixels from top
  width: number;      // pixels
  height: number;     // pixels
}

export const insertKeyframeSchema = z.object({
  jobId: z.string(),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(10),
  height: z.number().min(10),
});

export type InsertKeyframe = z.infer<typeof insertKeyframeSchema>;
