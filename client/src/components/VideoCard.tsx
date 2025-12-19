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
      className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
      style={{ WebkitTransform: 'translateZ(0)' }}
      data-testid={`card-video-${video.id}`}
    >
      <Dialog>
        <DialogTrigger asChild>
          <button 
            className="relative rounded-md overflow-hidden bg-muted cursor-pointer group"
            style={{ 
              width: '64px', 
              height: '64px', 
              minWidth: '64px',
              minHeight: '64px',
              flexShrink: 0,
              WebkitTransform: 'translateZ(0)'
            }}
            data-testid={`button-preview-${video.id}`}
          >
            {!videoError ? (
              <>
                <video
                  src={video.downloadUrl}
                  className="object-cover"
                  style={{ 
                    width: '64px', 
                    height: '64px',
                    display: 'block'
                  }}
                  preload="metadata"
                  playsInline
                  muted
                  onError={() => setVideoError(true)}
                  data-testid={`video-thumbnail-${video.id}`}
                />
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/30"
                  style={{ WebkitTransform: 'translateZ(0)' }}
                >
                  <Play className="w-6 h-6 text-white" fill="white" />
                </div>
              </>
            ) : (
              <div 
                className="flex items-center justify-center bg-muted"
                style={{ width: '64px', height: '64px' }}
              >
                <span className="text-xs text-muted-foreground">N/A</span>
              </div>
            )}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <video
            src={video.downloadUrl}
            className="w-full"
            style={{ display: 'block' }}
            controls
            autoPlay
            playsInline
            data-testid={`video-fullscreen-${video.id}`}
          />
        </DialogContent>
      </Dialog>

      <div 
        className="space-y-1"
        style={{ 
          flex: '1 1 0%', 
          minWidth: 0,
          WebkitTransform: 'translateZ(0)'
        }}
      >
        <p 
          className="text-xs text-muted-foreground font-mono"
          style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }}
          data-testid={`text-video-id-${video.id}`}
        >
          ID: {video.videoId}
        </p>
        
        {video.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Loading prompt...</span>
          </div>
        ) : truncatedPrompt ? (
          <p 
            className="text-sm"
            style={{ 
              overflow: 'hidden', 
              textOverflow: 'ellipsis', 
              whiteSpace: 'nowrap' 
            }}
            data-testid={`text-prompt-${video.id}`}
          >
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
        style={{ flexShrink: 0 }}
        data-testid={`button-download-${video.id}`}
      >
        <Download className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">Download</span>
      </Button>
    </div>
  );
}
