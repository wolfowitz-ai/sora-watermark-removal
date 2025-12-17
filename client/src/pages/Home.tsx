import { useState, useCallback, useRef } from "react";
import Header from "@/components/Header";
import UploadDropzone from "@/components/UploadDropzone";
import FileCard, { type FileItem, type FileStatus } from "@/components/FileCard";
import EmptyState from "@/components/EmptyState";

// todo: remove mock functionality - simulated processing
function simulateProcessing(
  fileId: string,
  updateFile: (id: string, updates: Partial<FileItem>) => void
) {
  let progress = 0;
  const uploadInterval = setInterval(() => {
    progress += Math.random() * 15 + 5;
    if (progress >= 100) {
      clearInterval(uploadInterval);
      updateFile(fileId, { status: "processing", progress: 0 });
      
      let processProgress = 0;
      const processInterval = setInterval(() => {
        processProgress += Math.random() * 10 + 5;
        if (processProgress >= 100) {
          clearInterval(processInterval);
          updateFile(fileId, { status: "complete", progress: 100 });
        } else {
          updateFile(fileId, { progress: Math.min(Math.round(processProgress), 99) });
        }
      }, 500);
    } else {
      updateFile(fileId, { progress: Math.min(Math.round(progress), 99) });
    }
  }, 300);

  return () => {
    clearInterval(uploadInterval);
  };
}

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const cancelFns = useRef<Map<string, () => void>>(new Map());

  const updateFile = useCallback((id: string, updates: Partial<FileItem>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    const fileItems: FileItem[] = newFiles.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      format: file.name.split(".").pop() || "video",
      status: "uploading" as FileStatus,
      progress: 0,
    }));

    setFiles(prev => [...fileItems, ...prev]);

    // todo: remove mock functionality - start simulated processing for each file
    fileItems.forEach((item) => {
      const cancel = simulateProcessing(item.id, updateFile);
      cancelFns.current.set(item.id, cancel);
    });
  }, [updateFile]);

  const handleDownload = useCallback((id: string) => {
    // todo: remove mock functionality
    console.log("Downloading file:", id);
    const file = files.find(f => f.id === id);
    if (file) {
      alert(`Download started for: ${file.name}\n\nIn production, this would download the processed file without watermark.`);
    }
  }, [files]);

  const handleCancel = useCallback((id: string) => {
    const cancel = cancelFns.current.get(id);
    if (cancel) {
      cancel();
      cancelFns.current.delete(id);
    }
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  const handleRetry = useCallback((id: string) => {
    updateFile(id, { status: "uploading", progress: 0, errorMessage: undefined });
    const cancel = simulateProcessing(id, updateFile);
    cancelFns.current.set(id, cancel);
  }, [updateFile]);

  const scrollToDropzone = useCallback(() => {
    document.getElementById("dropzone-upload")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const hasFiles = files.length > 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onNewUpload={hasFiles ? scrollToDropzone : undefined} />
      
      <main className="flex-1 py-12 px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold mb-2" data-testid="text-page-title">
              Remove Sora Watermarks
            </h1>
            <p className="text-muted-foreground" data-testid="text-page-subtitle">
              Upload your videos and download clean versions instantly
            </p>
          </div>

          <UploadDropzone 
            onFilesSelected={handleFilesSelected} 
            compact={hasFiles}
          />

          {hasFiles ? (
            <div className="space-y-3">
              <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Processing Queue ({files.length} {files.length === 1 ? "file" : "files"})
              </h2>
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onDownload={handleDownload}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border">
        Marketing Tools • Internal Use Only
      </footer>
    </div>
  );
}
