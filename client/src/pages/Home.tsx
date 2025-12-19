import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import VideoCard from "@/components/VideoCard";
import { Download, Loader2 } from "lucide-react";
import type { SoraVideo } from "@shared/schema";
import { extractVideoId, generateDownloadUrl } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [urlInput, setUrlInput] = useState("");
  const [videos, setVideos] = useState<SoraVideo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stats, setStats] = useState({ successful: 0, failed: 0 });

  const fetchPrompt = async (videoId: string): Promise<string> => {
    try {
      const response = await fetch(`/api/prompt/${videoId}`);
      if (response.ok) {
        const data = await response.json();
        return data.prompt || "";
      }
    } catch (error) {
      console.error("Failed to fetch prompt:", error);
    }
    return "";
  };

  const fetchPromptClientSide = async (url: string): Promise<string> => {
    return "";
  };

  const processUrls = useCallback(async () => {
    const lines = urlInput.split(/[\n\s]+/).filter(line => line.trim());
    const newVideos: SoraVideo[] = [];
    let failed = 0;

    lines.forEach((url) => {
      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;

      const videoId = extractVideoId(trimmedUrl);
      if (videoId) {
        const existingIds = [...videos, ...newVideos].map(v => v.videoId);
        if (!existingIds.includes(videoId)) {
          newVideos.push({
            id: crypto.randomUUID(),
            videoId,
            originalUrl: trimmedUrl,
            downloadUrl: generateDownloadUrl(videoId),
            isLoading: true,
            addedAt: new Date(),
          });
        }
      } else {
        failed++;
      }
    });

    if (newVideos.length > 0) {
      setIsProcessing(true);
      setVideos(prev => [...prev, ...newVideos]);
      setUrlInput("");
      setStats({ successful: newVideos.length, failed });

      for (const video of newVideos) {
        const prompt = await fetchPrompt(video.videoId);
        setVideos(prev => 
          prev.map(v => 
            v.id === video.id 
              ? { ...v, prompt, isLoading: false }
              : v
          )
        );
      }
      setIsProcessing(false);
    } else if (failed > 0) {
      setStats({ successful: 0, failed });
      toast({
        title: "No valid URLs found",
        description: "Please check the URL format",
        variant: "destructive",
      });
    }
  }, [urlInput, videos, toast]);

  const handleDownload = useCallback((video: SoraVideo) => {
    const link = document.createElement("a");
    link.href = `/api/download/${video.videoId}`;
    link.download = `${video.videoId}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const hasVideos = videos.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 py-6 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2" data-testid="text-page-title">
              Sora Bulk Downloader
            </h1>
            <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
              Download multiple Sora videos at once. Paste your URLs below to get started.
            </p>
          </div>

          <div className="space-y-4">
            <Textarea
              placeholder="https://sora.chatgpt.com/p/s_6944b4e29038819187a5eecf46545ba7"
              className="min-h-[140px] font-mono text-sm bg-card border-border resize-none"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              data-testid="textarea-url-input"
            />

            <Button 
              className="w-full" 
              size="lg"
              onClick={processUrls}
              disabled={!urlInput.trim() || isProcessing}
              data-testid="button-process-urls"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Download Videos
                </>
              )}
            </Button>
          </div>

          {(stats.successful > 0 || stats.failed > 0) && (
            <p className="text-center text-sm" data-testid="text-stats">
              Completed:{" "}
              <span className="text-green-500 font-medium">{stats.successful} successful</span>
              {stats.failed > 0 && (
                <>
                  ,{" "}
                  <span className="text-red-500 font-medium">{stats.failed} failed</span>
                </>
              )}
              .
            </p>
          )}

          {hasVideos && (
            <div className="space-y-3">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
