import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import VideoCard from "@/components/VideoCard";
import { 
  ChevronDown, 
  Info, 
  Trash2, 
  Download, 
  ClipboardPaste,
  ArrowLeft
} from "lucide-react";
import type { SoraVideo } from "@shared/schema";
import { extractVideoId, generateDownloadUrl } from "@shared/schema";

export default function Home() {
  const { toast } = useToast();
  const [urlInput, setUrlInput] = useState("");
  const [videos, setVideos] = useState<SoraVideo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const processUrls = useCallback(() => {
    const lines = urlInput.split(/[\n\s]+/).filter(line => line.trim());
    const newVideos: SoraVideo[] = [];
    const errors: string[] = [];

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
            addedAt: new Date(),
          });
        }
      } else {
        errors.push(trimmedUrl.substring(0, 50));
      }
    });

    if (newVideos.length > 0) {
      setVideos(prev => [...prev, ...newVideos]);
      setUrlInput("");
      toast({
        title: `Added ${newVideos.length} video${newVideos.length > 1 ? "s" : ""}`,
        description: "Videos are ready for preview and download",
      });
    }

    if (errors.length > 0) {
      toast({
        title: "Some URLs were invalid",
        description: `${errors.length} URL(s) could not be processed`,
        variant: "destructive",
      });
    }
  }, [urlInput, videos, toast]);

  const handleAutoPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrlInput(prev => prev ? `${prev}\n${text}` : text);
    } catch {
      toast({
        title: "Clipboard access denied",
        description: "Please paste manually using Ctrl+V",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === videos.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(videos.map(v => v.id)));
    }
  }, [videos, selectedIds]);

  const handleRemoveSelected = useCallback(() => {
    setVideos(prev => prev.filter(v => !selectedIds.has(v.id)));
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleRemoveVideo = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleSelectVideo = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleDownloadAll = useCallback(() => {
    const toDownload = selectedIds.size > 0 
      ? videos.filter(v => selectedIds.has(v.id))
      : videos;
    
    toDownload.forEach((video, index) => {
      setTimeout(() => {
        window.open(video.downloadUrl, "_blank");
      }, index * 500);
    });
  }, [videos, selectedIds]);

  const hasVideos = videos.length > 0;
  const allSelected = videos.length > 0 && selectedIds.size === videos.length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 py-8 px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">
              Sora Video Downloader
            </h1>
            <p className="text-muted-foreground" data-testid="text-page-subtitle">
              Paste Sora video links to preview and download
            </p>
          </div>

          <Card className="p-4 space-y-4">
            <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="w-full justify-between"
                  data-testid="button-toggle-instructions"
                >
                  <span className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    View Instructions & Usage Tips
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${instructionsOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 pb-2 px-2 space-y-2 text-sm text-muted-foreground">
                <p>1. Copy Sora video links from sora.chatgpt.com</p>
                <p>2. Paste one or more links in the text area below</p>
                <p>3. Click "Process & Download" to generate download links</p>
                <p>4. Preview videos and download individually or in bulk</p>
                <p className="text-xs pt-2">
                  Supported URL format: https://sora.chatgpt.com/p/s_xxxxx
                </p>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Paste Video Links</label>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAutoPaste}
                  data-testid="button-auto-paste"
                >
                  <ClipboardPaste className="w-4 h-4 mr-2" />
                  Auto-Paste
                </Button>
              </div>
              <Textarea
                placeholder="https://sora.chatgpt.com/p/s_6944b4e29038819187a5eecf46545ba7 https://sora.chatgpt.com/p/s_abc123..."
                className="min-h-[120px] font-mono text-sm"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                data-testid="textarea-url-input"
              />
            </div>

            <Button 
              className="w-full" 
              size="lg"
              onClick={processUrls}
              disabled={!urlInput.trim()}
              data-testid="button-process-urls"
            >
              <Download className="w-5 h-5 mr-2" />
              Process & Download Bulk
            </Button>
          </Card>

          {hasVideos && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setVideos([])}
                  data-testid="button-add-more"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Add More
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    data-testid="button-select-all"
                  >
                    <Checkbox 
                      checked={allSelected} 
                      className="mr-2" 
                    />
                    Select All
                  </Button>

                  {selectedIds.size > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveSelected}
                      className="text-destructive"
                      data-testid="button-remove-selected"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove ({selectedIds.size})
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    isSelected={selectedIds.has(video.id)}
                    onSelect={(selected) => handleSelectVideo(video.id, selected)}
                    onRemove={() => handleRemoveVideo(video.id)}
                  />
                ))}
              </div>

              {videos.length > 1 && (
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handleDownloadAll}
                  data-testid="button-download-all"
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : `All (${videos.length})`}
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        Marketing Tools Internal Use Only
      </footer>
    </div>
  );
}
