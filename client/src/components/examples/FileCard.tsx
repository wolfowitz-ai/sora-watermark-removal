import FileCard, { type FileItem } from "../FileCard";

export default function FileCardExample() {
  // todo: remove mock functionality
  const mockFiles: FileItem[] = [
    {
      id: "1",
      name: "product-demo-final.mp4",
      size: 125 * 1024 * 1024,
      format: "mp4",
      status: "complete",
      progress: 100,
    },
    {
      id: "2",
      name: "marketing-campaign-v2.mov",
      size: 89 * 1024 * 1024,
      format: "mov",
      status: "processing",
      progress: 67,
    },
    {
      id: "3",
      name: "social-media-clip.mp4",
      size: 45 * 1024 * 1024,
      format: "mp4",
      status: "uploading",
      progress: 34,
    },
    {
      id: "4",
      name: "brand-video-corrupted.mp4",
      size: 200 * 1024 * 1024,
      format: "mp4",
      status: "error",
      progress: 0,
      errorMessage: "File too large or corrupted",
    },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-3">
      {mockFiles.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          onDownload={(id) => console.log("Download:", id)}
          onCancel={(id) => console.log("Cancel:", id)}
          onRetry={(id) => console.log("Retry:", id)}
        />
      ))}
    </div>
  );
}
