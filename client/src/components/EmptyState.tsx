import { FileVideo } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileVideo className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-1" data-testid="text-empty-title">No files yet</h3>
      <p className="text-muted-foreground text-sm" data-testid="text-empty-subtitle">
        Upload your first video to get started
      </p>
    </div>
  );
}
