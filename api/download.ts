import type { VercelRequest, VercelResponse } from "@vercel/node";

const DYYSY_API = "https://api.dyysy.com";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const url = req.query.url as string;

  if (!url || !url.includes("sora.chatgpt.com")) {
    return res.status(400).json({ error: "Invalid Sora URL" });
  }

  try {
    const apiUrl = `${DYYSY_API}/links20260207/${encodeURIComponent(url)}`;
    const infoResponse = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "application/json",
        Referer: "https://dyysy.com/",
      },
    });

    if (!infoResponse.ok) {
      return res.status(500).json({ error: "Failed to resolve video URL" });
    }

    const data = await infoResponse.json();
    const mp4Url = data?.links?.mp4;

    if (!mp4Url) {
      return res.status(500).json({ error: "No video URL returned" });
    }

    const videoId = url.match(/\/p\/(s_[a-f0-9]+)/)?.[1] || "video";

    const videoResponse = await fetch(mp4Url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "video/mp4,video/*;q=0.9,*/*;q=0.8",
      },
    });

    if (!videoResponse.ok) {
      return res.status(502).json({ error: "Failed to fetch video from CDN" });
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${videoId}.mp4"`
    );

    const contentLength = videoResponse.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }

    const reader = videoResponse.body?.getReader();
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
    console.error("download error:", error);
    return res.status(500).json({ error: "Download failed" });
  }
}
