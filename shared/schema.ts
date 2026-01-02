import { z } from "zod";

export interface SoraVideo {
  id: string;
  videoId: string;
  originalUrl: string;
  downloadUrl: string;
  prompt?: string;
  isLoading?: boolean;
  addedAt: Date;
}

export const soraUrlSchema = z.string().regex(
  /^https:\/\/sora\.chatgpt\.com\/p\/s_[a-f0-9]+(\?.*)?$/,
  "Invalid Sora URL format. Expected: https://sora.chatgpt.com/p/s_xxxxx"
);

export function extractVideoId(url: string): string | null {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const match = cleanUrl.match(/\/p\/(s_[a-f0-9]+)$/);
  return match ? match[1] : null;
}

export function generateDownloadUrl(videoId: string): string {
  return `https://oscdn2.dyysy.com/MP4/${videoId}.mp4`;
}
