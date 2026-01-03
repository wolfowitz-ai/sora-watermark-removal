import type { Express } from "express";
import type { Server } from "http";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

let browserInstance: any = null;

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled"
      ]
    });
  }
  return browserInstance;
}

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
      const browser = await getBrowser();
      const page = await browser.newPage();
      
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      );

      const soraUrl = `https://sora.chatgpt.com/p/${videoId}`;
      
      await page.goto(soraUrl, { 
        waitUntil: "networkidle2",
        timeout: 30000
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const html = await page.content();
      await page.close();

      let prompt = "";
      
      const ogMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
      if (ogMatch) {
        prompt = ogMatch[1]
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'");
      } else {
        const textMatch = html.match(/Create a video[^<"]+/i);
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

    const downloadUrl = `https://oscdn2.dyysy.com/MP4/${videoId}.mp4`;
    const maxRetries = 5;
    const baseDelay = 2000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(downloadUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Accept': 'video/mp4,video/*;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://sora.chatgpt.com/'
          }
        });

        if (response.status === 429) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          return res.status(404).json({ error: "Video not found" });
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("video")) {
          return res.status(502).json({ error: "CDN returned non-video content" });
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
        return;
      } catch (error) {
        console.error(`Download attempt ${attempt + 1} failed:`, error);
        if (attempt === maxRetries - 1) {
          return res.status(500).json({ error: "Failed to download video after retries" });
        }
      }
    }
    
    res.status(500).json({ error: "Failed to download video" });
  });
}
