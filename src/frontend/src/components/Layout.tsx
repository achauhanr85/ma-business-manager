import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useProfile } from "@/contexts/ProfileContext";
import { hexToOklch } from "@/lib/color";
import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  pageTitle: string;
  onNavigate: (path: string) => void;
}

export function Layout({
  children,
  currentPath,
  pageTitle,
  onNavigate,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, isLoadingProfile } = useProfile();

  // Inject --primary CSS variable from profile theme_color
  useEffect(() => {
    if (profile?.theme_color?.startsWith("#")) {
      const oklch = hexToOklch(profile.theme_color);
      document.documentElement.style.setProperty("--primary", oklch);
    }
  }, [profile?.theme_color]);

  if (isLoadingProfile) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-background"
        data-ocid="layout.loading_state"
      >
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content shifts right on desktop */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Header
          onMenuToggle={() => setSidebarOpen(true)}
          pageTitle={pageTitle}
        />
        <main
          className="flex-1 p-4 lg:p-6 bg-background"
          data-ocid="main_content"
        >
          {children}
        </main>
        <footer className="bg-muted/40 border-t border-border px-4 lg:px-6 py-3">
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </footer>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
