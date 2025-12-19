import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import type { SoraVideo } from "@shared/schema";

interface VideoCardProps {
  video: SoraVideo;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onRemove: () => void;
}

export default function VideoCard({ video, isSelected, onSelect, onRemove }: VideoCardProps) {
  const [videoError, setVideoError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const handleDownload = () => {
    window.open(video.downloadUrl, "_blank");
  };

  return (
    <Card className="overflow-hidden" data-testid={`card-video-${video.id}`}>
      <div className="relative aspect-[9/16] bg-muted">
        {!videoError ? (
          <video
            src={video.downloadUrl}
            className="w-full h-full object-cover"
            controls
            preload="metadata"
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            data-testid={`video-preview-${video.id}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground p-4">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Video unavailable</p>
            </div>
          </div>
        )}
        
        <div className="absolute top-2 left-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onSelect}
            className="bg-background/80 backdrop-blur"
            data-testid={`checkbox-select-${video.id}`}
          />
        </div>
        
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 bg-background/80 backdrop-blur"
          onClick={onRemove}
          data-testid={`button-remove-${video.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="p-3 space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Video ID:</p>
          <p className="text-sm font-mono truncate" data-testid={`text-video-id-${video.id}`}>
            {video.videoId}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {videoLoaded && !videoError ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Ready
            </Badge>
          ) : videoError ? (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              Error
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              Loading...
            </Badge>
          )}
        </div>
        
        <Button 
          className="w-full" 
          onClick={handleDownload}
          disabled={videoError}
          data-testid={`button-download-${video.id}`}
        >
          <Download className="w-4 h-4 mr-2" />
          Download MP4
        </Button>
      </div>
    </Card>
  );
}
