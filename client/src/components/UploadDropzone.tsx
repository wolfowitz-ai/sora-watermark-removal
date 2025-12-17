import { CloudUpload } from "lucide-react";
import { useCallback, useState } from "react";

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  compact?: boolean;
}

export default function UploadDropzone({ onFilesSelected, compact = false }: UploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith("video/")
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
  }, [onFilesSelected]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      file => file.type.startsWith("video/")
    );
    if (files.length > 0) {
      onFilesSelected(files);
    }
    e.target.value = "";
  }, [onFilesSelected]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg transition-all cursor-pointer
        ${compact ? "min-h-32 p-4" : "min-h-64 p-8"}
        ${isDragging 
          ? "border-primary bg-primary/5 scale-[1.01]" 
          : "border-muted-foreground/30 hover:border-muted-foreground/50"
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById("file-input")?.click()}
      data-testid="dropzone-upload"
    >
      <input
        id="file-input"
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
        data-testid="input-file"
      />
      <div className={`flex flex-col items-center justify-center h-full ${compact ? "gap-2" : "gap-4"}`}>
        <div className={`rounded-full bg-muted flex items-center justify-center ${compact ? "w-10 h-10" : "w-16 h-16"}`}>
          <CloudUpload className={`text-muted-foreground ${compact ? "w-5 h-5" : "w-8 h-8"}`} />
        </div>
        <div className="text-center">
          <p className={`font-medium ${compact ? "text-sm" : "text-lg"}`} data-testid="text-dropzone-title">
            Drag & drop video files here
          </p>
          <p className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`} data-testid="text-dropzone-subtitle">
            or click to browse • MP4, MOV up to 500MB
          </p>
        </div>
      </div>
    </div>
  );
}
