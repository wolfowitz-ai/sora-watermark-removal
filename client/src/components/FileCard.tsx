import { CheckCircle, Download, Loader2, XCircle, X, RefreshCw, Video, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export type FileStatus = "uploading" | "processing" | "complete" | "error";

export interface FileItem {
  id: string;
  name: string;
  size: number;
  format: string;
  status: FileStatus;
  progress: number;
  errorMessage?: string;
}

interface FileCardProps {
  file: FileItem;
  onDownload?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onEdit?: (id: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getStatusIcon(status: FileStatus) {
  switch (status) {
    case "uploading":
    case "processing":
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    case "complete":
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "error":
      return <XCircle className="w-4 h-4 text-destructive" />;
  }
}

function getStatusText(status: FileStatus, progress: number): string {
  switch (status) {
    case "uploading":
      if (progress >= 100) {
        return "Ready to edit - mark watermark regions";
      }
      return `Uploading... ${progress}%`;
    case "processing":
      return `Removing watermarks... ${progress}%`;
    case "complete":
      return "Ready to download";
    case "error":
      return "Failed";
  }
}

export default function FileCard({ file, onDownload, onCancel, onRetry, onEdit }: FileCardProps) {
  const isProcessing = file.status === "uploading" || file.status === "processing";
  const canEdit = file.status !== "processing";

  return (
    <Card className="p-4" data-testid={`card-file-${file.id}`}>
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <Video className="w-6 h-6 text-muted-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-sm truncate" data-testid={`text-filename-${file.id}`}>
                {file.name}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {file.format.toUpperCase()}
                </Badge>
                <span className="text-xs text-muted-foreground" data-testid={`text-filesize-${file.id}`}>
                  {formatFileSize(file.size)}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(file.id)}
                  data-testid={`button-edit-${file.id}`}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit Regions
                </Button>
              )}
              {file.status === "complete" && onDownload && (
                <Button
                  size="sm"
                  onClick={() => onDownload(file.id)}
                  data-testid={`button-download-${file.id}`}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              )}
              {file.status === "error" && onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRetry(file.id)}
                  data-testid={`button-retry-${file.id}`}
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retry
                </Button>
              )}
              {isProcessing && onCancel && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onCancel(file.id)}
                  data-testid={`button-cancel-${file.id}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
          
          <div className="mt-3">
            {isProcessing && (
              <Progress value={file.progress} className="h-1.5" />
            )}
            <div className="flex items-center gap-2 mt-2">
              {getStatusIcon(file.status)}
              <span className={`text-xs ${file.status === "error" ? "text-destructive" : "text-muted-foreground"}`} data-testid={`text-status-${file.id}`}>
                {file.status === "error" ? file.errorMessage : getStatusText(file.status, file.progress)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
