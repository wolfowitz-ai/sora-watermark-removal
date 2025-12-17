import { useRef, useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Pause, 
  Plus, 
  Trash2, 
  Check, 
  X,
  ChevronLeft
} from "lucide-react";
import type { WatermarkKeyframe } from "@shared/schema";

interface VideoEditorProps {
  jobId: string;
  videoSrc: string;
  onClose: () => void;
  onProcessStart: () => void;
}

interface DrawingRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function VideoEditor({ jobId, videoSrc, onClose, onProcessStart }: VideoEditorProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingRect, setDrawingRect] = useState<DrawingRect | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  
  const [pendingKeyframe, setPendingKeyframe] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    startTime: number;
  } | null>(null);

  const { data: keyframes = [], refetch: refetchKeyframes } = useQuery<WatermarkKeyframe[]>({
    queryKey: ["/api/jobs", jobId, "keyframes"],
  });

  const createKeyframeMutation = useMutation({
    mutationFn: async (data: { startTime: number; endTime: number; x: number; y: number; width: number; height: number }) => {
      return await apiRequest("POST", `/api/jobs/${jobId}/keyframes`, data);
    },
    onSuccess: () => {
      refetchKeyframes();
      setPendingKeyframe(null);
      toast({ title: "Keyframe added", description: "Watermark region marked successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add keyframe", variant: "destructive" });
    },
  });

  const deleteKeyframeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/keyframes/${id}`);
    },
    onSuccess: () => {
      refetchKeyframes();
      toast({ title: "Keyframe deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete keyframe", variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/jobs/${jobId}/process`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onProcessStart();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setVideoSize({ width: video.videoWidth, height: video.videoHeight });
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, []);

  useEffect(() => {
    const updateDisplaySize = () => {
      const video = videoRef.current;
      if (!video) return;
      setDisplaySize({ width: video.clientWidth, height: video.clientHeight });
    };

    updateDisplaySize();
    window.addEventListener("resize", updateDisplaySize);
    return () => window.removeEventListener("resize", updateDisplaySize);
  }, [videoSize]);

  const scaleToVideo = useCallback((displayX: number, displayY: number) => {
    if (displaySize.width === 0 || displaySize.height === 0) return { x: 0, y: 0 };
    const scaleX = videoSize.width / displaySize.width;
    const scaleY = videoSize.height / displaySize.height;
    return { x: Math.round(displayX * scaleX), y: Math.round(displayY * scaleY) };
  }, [displaySize, videoSize]);

  const scaleToDisplay = useCallback((videoX: number, videoY: number) => {
    if (videoSize.width === 0 || videoSize.height === 0) return { x: 0, y: 0 };
    const scaleX = displaySize.width / videoSize.width;
    const scaleY = displaySize.height / videoSize.height;
    return { x: videoX * scaleX, y: videoY * scaleY };
  }, [displaySize, videoSize]);

  const handlePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const getMousePosition = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPlaying) {
      videoRef.current?.pause();
    }
    const pos = getMousePosition(e);
    setIsDrawing(true);
    setDrawingRect({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawingRect) return;
    const pos = getMousePosition(e);
    setDrawingRect({ ...drawingRect, currentX: pos.x, currentY: pos.y });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawingRect) return;
    setIsDrawing(false);

    const minX = Math.min(drawingRect.startX, drawingRect.currentX);
    const minY = Math.min(drawingRect.startY, drawingRect.currentY);
    const width = Math.abs(drawingRect.currentX - drawingRect.startX);
    const height = Math.abs(drawingRect.currentY - drawingRect.startY);

    if (width > 10 && height > 10) {
      const videoCoords = scaleToVideo(minX, minY);
      const videoSize = scaleToVideo(width, height);
      
      setPendingKeyframe({
        x: Math.max(1, videoCoords.x),
        y: Math.max(1, videoCoords.y),
        width: Math.max(20, videoSize.x),
        height: Math.max(10, videoSize.y),
        startTime: currentTime,
      });
    }

    setDrawingRect(null);
  };

  const confirmKeyframe = () => {
    if (!pendingKeyframe) return;
    
    const endTime = Math.min(pendingKeyframe.startTime + 3, duration);
    
    createKeyframeMutation.mutate({
      startTime: pendingKeyframe.startTime,
      endTime: endTime,
      x: pendingKeyframe.x,
      y: pendingKeyframe.y,
      width: pendingKeyframe.width,
      height: pendingKeyframe.height,
    });
  };

  const cancelKeyframe = () => {
    setPendingKeyframe(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  const drawOverlay = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    keyframes.forEach((kf) => {
      if (currentTime >= kf.startTime && currentTime <= kf.endTime) {
        const displayPos = scaleToDisplay(kf.x, kf.y);
        const displayDim = scaleToDisplay(kf.width, kf.height);
        
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(displayPos.x, displayPos.y, displayDim.x, displayDim.y);
        ctx.setLineDash([]);
      }
    });

    if (drawingRect) {
      const minX = Math.min(drawingRect.startX, drawingRect.currentX);
      const minY = Math.min(drawingRect.startY, drawingRect.currentY);
      const width = Math.abs(drawingRect.currentX - drawingRect.startX);
      const height = Math.abs(drawingRect.currentY - drawingRect.startY);

      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.strokeRect(minX, minY, width, height);
      ctx.fillStyle = "rgba(239, 68, 68, 0.2)";
      ctx.fillRect(minX, minY, width, height);
    }

    if (pendingKeyframe) {
      const displayPos = scaleToDisplay(pendingKeyframe.x, pendingKeyframe.y);
      const displayDim = scaleToDisplay(pendingKeyframe.width, pendingKeyframe.height);

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 3;
      ctx.strokeRect(displayPos.x, displayPos.y, displayDim.x, displayDim.y);
      ctx.fillStyle = "rgba(245, 158, 11, 0.3)";
      ctx.fillRect(displayPos.x, displayPos.y, displayDim.x, displayDim.y);
    }
  }, [displaySize, keyframes, currentTime, drawingRect, pendingKeyframe, scaleToDisplay]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="flex items-center justify-between gap-4 p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-editor-back">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="font-semibold">Mark Watermark Regions</h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{keyframes.length} keyframe{keyframes.length !== 1 ? "s" : ""}</Badge>
          <Button
            onClick={() => processMutation.mutate()}
            disabled={keyframes.length === 0 || processMutation.isPending}
            data-testid="button-start-processing"
          >
            {processMutation.isPending ? "Starting..." : "Remove Watermarks"}
          </Button>
        </div>
      </header>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4 bg-muted/50">
          <div ref={containerRef} className="relative max-w-full max-h-full">
            <video
              ref={videoRef}
              src={videoSrc}
              className="max-w-full max-h-[60vh] rounded-md"
              data-testid="video-preview"
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full cursor-crosshair"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              data-testid="canvas-overlay"
            />
          </div>
        </div>

        <div className="p-4 border-t space-y-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handlePlayPause} data-testid="button-play-pause">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <span className="text-sm font-mono w-24" data-testid="text-current-time">
              {formatTime(currentTime)}
            </span>
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.01}
              onValueChange={handleSeek}
              className="flex-1"
              data-testid="slider-timeline"
            />
            <span className="text-sm font-mono text-muted-foreground w-24 text-right" data-testid="text-duration">
              {formatTime(duration)}
            </span>
          </div>

          {pendingKeyframe && (
            <Card className="p-3 border-amber-500">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-amber-500" />
                  <span className="text-sm">
                    New region at {formatTime(pendingKeyframe.startTime)} - {formatTime(Math.min(pendingKeyframe.startTime + 3, duration))}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({pendingKeyframe.width}x{pendingKeyframe.height}px)
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={cancelKeyframe} data-testid="button-cancel-keyframe">
                    <X className="w-4 h-4" />
                  </Button>
                  <Button size="icon" onClick={confirmKeyframe} disabled={createKeyframeMutation.isPending} data-testid="button-confirm-keyframe">
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {!pendingKeyframe && (
            <p className="text-sm text-muted-foreground text-center">
              Click and drag on the video to mark a watermark region. Seek to different times to mark watermarks at different positions.
            </p>
          )}

          {keyframes.length > 0 && (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Marked Regions</p>
              {keyframes.map((kf) => (
                <div
                  key={kf.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted"
                  data-testid={`keyframe-${kf.id}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {formatTime(kf.startTime)} - {formatTime(kf.endTime)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {kf.width}x{kf.height}px at ({kf.x}, {kf.y})
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteKeyframeMutation.mutate(kf.id)}
                    disabled={deleteKeyframeMutation.isPending}
                    data-testid={`button-delete-keyframe-${kf.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
