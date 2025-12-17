import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/Header";
import UploadDropzone from "@/components/UploadDropzone";
import FileCard, { type FileItem } from "@/components/FileCard";
import EmptyState from "@/components/EmptyState";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { VideoJob } from "@shared/schema";

function mapJobToFileItem(job: VideoJob): FileItem {
  return {
    id: job.id,
    name: job.originalFilename,
    size: job.fileSize,
    format: job.format,
    status: job.status,
    progress: job.progress,
    errorMessage: job.errorMessage || undefined,
  };
}

export default function Home() {
  const { toast } = useToast();
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map());

  const { data: jobs = [], isLoading } = useQuery<VideoJob[]>({
    queryKey: ["/api/jobs"],
    refetchInterval: 2000,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("video", file);
      
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel job",
        variant: "destructive",
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/jobs/${id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to retry job",
        variant: "destructive",
      });
    },
  });

  const handleFilesSelected = useCallback((files: File[]) => {
    files.forEach((file) => {
      uploadMutation.mutate(file);
    });
  }, [uploadMutation]);

  const handleDownload = useCallback((id: string) => {
    window.open(`/api/jobs/${id}/download`, "_blank");
  }, []);

  const handleCancel = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleRetry = useCallback((id: string) => {
    retryMutation.mutate(id);
  }, [retryMutation]);

  const scrollToDropzone = useCallback(() => {
    document.getElementById("dropzone-upload")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fileItems: FileItem[] = jobs.map(mapJobToFileItem);
  const hasFiles = fileItems.length > 0;

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

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : hasFiles ? (
            <div className="space-y-3">
              <h2 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Processing Queue ({fileItems.length} {fileItems.length === 1 ? "file" : "files"})
              </h2>
              {fileItems.map((file) => (
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
