import type { Express } from "express";
import type { Server } from "http";

const DYYSY_API = "https://api.dyysy.com";

async function fetchVideoData(originalUrl: string): Promise<{
  mp4: string;
  thumbnail: string;
  title: string;
  prompt: string;
} | null> {
  try {
    const apiUrl = `${DYYSY_API}/links20260207/${encodeURIComponent(originalUrl)}`;
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json",
        "Referer": "https://dyysy.com/"
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data?.links?.mp4) return null;

    return {
      mp4: data.links.mp4,
      thumbnail: data.links.thumbnail || "",
      title: data.post_info?.title || "",
      prompt: data.post_info?.prompt || ""
    };
  } catch {
    return null;
  }
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/video-info", async (req, res) => {
    const url = req.query.url as string;

    if (!url || !url.includes("sora.chatgpt.com")) {
      return res.status(400).json({ error: "Invalid Sora URL" });
    }

    const data = await fetchVideoData(url);
    if (!data) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    res.json(data);
  });

  app.get("/api/download", async (req, res) => {
    const url = req.query.url as string;

    if (!url || !url.includes("sora.chatgpt.com")) {
      return res.status(400).json({ error: "Invalid Sora URL" });
    }

    const data = await fetchVideoData(url);
    if (!data?.mp4) {
      return res.status(500).json({ error: "Failed to resolve video URL" });
    }

    const videoId = url.match(/\/p\/(s_[a-f0-9]+)/)?.[1] || "video";

    try {
      const response = await fetch(data.mp4, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
          "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8"
        }
      });

      if (!response.ok) {
        return res.status(502).json({ error: "Failed to fetch video from CDN" });
      }

      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Content-Disposition", `attachment; filename="${videoId}.mp4"`);

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        res.setHeader("Content-Length", contentLength);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return res.status(500).json({ error: "Failed to stream video" });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ error: "Download failed" });
    }
  });
}
