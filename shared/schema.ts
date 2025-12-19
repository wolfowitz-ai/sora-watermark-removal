import { z } from "zod";

// Sora video item for URL conversion
export interface SoraVideo {
  id: string;
  videoId: string;           // extracted ID like "s_6944b4e29038819187a5eecf46545ba7"
  originalUrl: string;       // https://sora.chatgpt.com/p/s_xxxxx
  downloadUrl: string;       // https://oscdn2.dyysy.com/MP4/s_xxxxx.mp4
  addedAt: Date;
}

// Schema for validating Sora URLs
export const soraUrlSchema = z.string().regex(
  /^https:\/\/sora\.chatgpt\.com\/p\/s_[a-f0-9]+$/,
  "Invalid Sora URL format. Expected: https://sora.chatgpt.com/p/s_xxxxx"
);

// Helper to extract video ID from Sora URL
export function extractVideoId(url: string): string | null {
  const match = url.match(/\/p\/(s_[a-f0-9]+)$/);
  return match ? match[1] : null;
}

// Helper to generate download URL from video ID
export function generateDownloadUrl(videoId: string): string {
  return `https://oscdn2.dyysy.com/MP4/${videoId}.mp4`;
}
