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
  const [videoError, setVideoError] = useState(false);

  const handleCopyPrompt = async () => {
    if (!video.prompt) return;
    
    try {
      await navigator.clipboard.writeText(video.prompt);
      setCopied(true);
      toast({ title: "Prompt copied!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const truncatedPrompt = video.prompt 
    ? video.prompt.length > 60 
      ? video.prompt.substring(0, 60) + "..." 
      : video.prompt
    : null;

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
      data-testid={`card-video-${video.id}`}
    >
      <Dialog>
        <DialogTrigger asChild>
          <button 
            className="relative w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer group"
            data-testid={`button-preview-${video.id}`}
          >
            {!videoError ? (
              <>
                <video
                  src={video.downloadUrl}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  onError={() => setVideoError(true)}
                  data-testid={`video-thumbnail-${video.id}`}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-6 h-6 text-white" fill="white" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <span className="text-xs text-muted-foreground">N/A</span>
              </div>
            )}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <video
            src={video.downloadUrl}
            className="w-full"
            controls
            autoPlay
            data-testid={`video-fullscreen-${video.id}`}
          />
        </DialogContent>
      </Dialog>

      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground font-mono truncate" data-testid={`text-video-id-${video.id}`}>
          ID: {video.videoId}
        </p>
        
        {video.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading prompt...</span>
          </div>
        ) : truncatedPrompt ? (
          <p className="text-sm truncate" data-testid={`text-prompt-${video.id}`}>
            {truncatedPrompt}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No prompt available</p>
        )}

        {video.prompt && !video.isLoading && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyPrompt}
            className="h-7 text-xs"
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
        disabled={videoError}
        className="flex-shrink-0"
        data-testid={`button-download-${video.id}`}
      >
        <Download className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">Download</span>
      </Button>
    </div>
  );
}
