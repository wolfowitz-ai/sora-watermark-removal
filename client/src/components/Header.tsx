import { CloudUpload, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface HeaderProps {
  onNewUpload?: () => void;
}

export default function Header({ onNewUpload }: HeaderProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "dark" || (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
          <CloudUpload className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg" data-testid="text-app-title">Watermark Remover</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
        {onNewUpload && (
          <Button
            variant="outline"
            onClick={onNewUpload}
            data-testid="button-new-upload"
          >
            <CloudUpload className="w-4 h-4 mr-2" />
            New Upload
          </Button>
        )}
      </div>
    </header>
  );
}
