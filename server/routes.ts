import type { Express } from "express";
import type { Server } from "http";

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/prompt/:videoId", async (req, res) => {
    const { videoId } = req.params;
    
    if (!videoId || !videoId.startsWith("s_")) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    try {
      const soraUrl = `https://sora.chatgpt.com/p/${videoId}`;
      const response = await fetch(soraUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
        }
      });

      if (!response.ok) {
        return res.status(404).json({ error: "Video not found" });
      }

      const html = await response.text();
      
      const promptMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                         html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
      
      let prompt = "";
      if (promptMatch) {
        prompt = promptMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'");
      } else {
        const textMatch = html.match(/Create a video[^<]+/i);
        if (textMatch) {
          prompt = textMatch[0].trim();
        }
      }

      res.json({ prompt, videoId });
    } catch (error) {
      console.error("Error fetching prompt:", error);
      res.status(500).json({ error: "Failed to fetch prompt" });
    }
  });

  app.get("/api/download/:videoId", async (req, res) => {
    const { videoId } = req.params;
    
    if (!videoId || !videoId.startsWith("s_")) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    try {
      const downloadUrl = `https://oscdn2.dyysy.com/MP4/${videoId}.mp4`;
      const response = await fetch(downloadUrl);

      if (!response.ok) {
        return res.status(404).json({ error: "Video not found" });
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

      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };

      await pump();
    } catch (error) {
      console.error("Error downloading video:", error);
      res.status(500).json({ error: "Failed to download video" });
    }
  });
}
