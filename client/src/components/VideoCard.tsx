import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Download, Copy, Check, Loader2, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SoraVideo } from "@shared/schema";

interface VideoCardProps {
  video: SoraVideo;
  onDownload: (video: SoraVideo) => void;
}

export default function VideoCard({ video, onDownload }: VideoCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const handleCopyPrompt = async () => {
    const text = video.prompt || video.title;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: "Copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const displayText = video.prompt || video.title || null;
  const truncated = displayText
    ? displayText.length > 80
      ? displayText.substring(0, 80) + "..."
      : displayText
    : null;

  const hasVideo = !!video.downloadUrl;
  const isReady = !video.isLoading && hasVideo;

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
      style={{ WebkitTransform: "translateZ(0)" }}
      data-testid={`card-video-${video.id}`}
    >
      <Dialog>
        <DialogTrigger asChild disabled={!isReady}>
          <button
            className="relative rounded-md overflow-hidden bg-muted cursor-pointer group"
            style={{
              width: "64px",
              height: "64px",
              minWidth: "64px",
              minHeight: "64px",
              flexShrink: 0,
              WebkitTransform: "translateZ(0)"
            }}
            disabled={!isReady}
            data-testid={`button-preview-${video.id}`}
          >
            {video.isLoading ? (
              <div className="flex items-center justify-center w-full h-full">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !thumbError && video.thumbnailUrl ? (
              <>
                <img
                  src={video.thumbnailUrl}
                  alt="Video thumbnail"
                  className="object-cover"
                  style={{ width: "64px", height: "64px", display: "block" }}
                  onError={() => setThumbError(true)}
                  data-testid={`img-thumbnail-${video.id}`}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center bg-black/30"
                  style={{ WebkitTransform: "translateZ(0)" }}
                >
                  <Play className="w-6 h-6 text-white" fill="white" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center bg-muted w-full h-full">
                <span className="text-xs text-muted-foreground">N/A</span>
              </div>
            )}
          </button>
        </DialogTrigger>
        {isReady && (
          <DialogContent className="max-w-3xl p-0 overflow-hidden">
            <video
              src={video.downloadUrl}
              className="w-full"
              style={{ display: "block" }}
              controls
              autoPlay
              playsInline
              data-testid={`video-fullscreen-${video.id}`}
            />
          </DialogContent>
        )}
      </Dialog>

      <div
        className="space-y-1"
        style={{
          flex: "1 1 0%",
          minWidth: 0,
          WebkitTransform: "translateZ(0)"
        }}
      >
        <p
          className="text-xs text-muted-foreground font-mono"
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          data-testid={`text-video-id-${video.id}`}
        >
          ID: {video.videoId}
        </p>

        {video.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading info...</span>
          </div>
        ) : truncated ? (
          <p
            className="text-sm"
            style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            data-testid={`text-prompt-${video.id}`}
          >
            {truncated}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No info available</p>
        )}

        {displayText && !video.isLoading && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyPrompt}
            data-testid={`button-copy-prompt-${video.id}`}
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 mr-1" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 mr-1" />
                Copy Prompt
              </>
            )}
          </Button>
        )}
      </div>

      <Button
        onClick={() => onDownload(video)}
        disabled={!isReady}
        style={{ flexShrink: 0 }}
        data-testid={`button-download-${video.id}`}
      >
        <Download className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">Download</span>
      </Button>
    </div>
  );
}
