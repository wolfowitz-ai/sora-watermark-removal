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
    const response = await fetch(apiUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        Accept: "application/json",
        Referer: "https://dyysy.com/",
      },
    });

    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch video info" });
    }

    const data = await response.json();

    if (!data?.links?.mp4) {
      return res.status(500).json({ error: "No video URL returned" });
    }

    return res.status(200).json({
      mp4: data.links.mp4,
      thumbnail: data.links.thumbnail || "",
      title: data.post_info?.title || "",
      prompt: data.post_info?.prompt || "",
    });
  } catch (error) {
    console.error("video-info error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
