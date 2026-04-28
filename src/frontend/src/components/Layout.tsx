import { HelpPanel } from "@/components/HelpPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useRunBackgroundChecks } from "@/hooks/useBackend";
import { hexToOklch } from "@/lib/color";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createActor } from "../backend";
import { Header } from "./Header";
import { NotificationsPanel } from "./NotificationsPanel";
import { Sidebar } from "./Sidebar";

interface LayoutProps {
  children: React.ReactNode;
  currentPath: string;
  pageTitle: string;
  onNavigate: (path: string) => void;
}

function useBackendActor() {
  return useActor(createActor);
}

function useUnreadNotificationCount(
  profileKey: string | null,
  targetRole: string | null,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["notifications", profileKey, targetRole],
    queryFn: async () => {
      if (!actor || !profileKey || !targetRole) return [];
      if (typeof actor.getNotifications !== "function") return [];
      return actor.getNotifications(profileKey, targetRole);
    },
    enabled: !!actor && !isFetching && !!profileKey && !!targetRole,
    refetchInterval: 60_000,
    select: (data) => data.filter((n) => !n.is_read).length,
  });
}

/**
 * Apply profile brand color as a CSS variable overlay.
 * Sets only --primary and --theme-color-* — does NOT override the
 * structural tokens that belong to the active theme class.
 */
function applyProfileBrandVars(hex: string) {
  if (!hex?.startsWith("#")) return;
  try {
    const oklch = hexToOklch(hex);
    const root = document.documentElement;
    root.style.setProperty("--primary", oklch);
    root.style.setProperty("--primary-raw", hex);

    const match = oklch.match(/([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/);
    if (match) {
      const l = Number.parseFloat(match[1]) / 100;
      const c = Number.parseFloat(match[2]);
      const h = Number.parseFloat(match[3]);
      root.style.setProperty("--theme-color-l", String(l));
      root.style.setProperty("--theme-color-c", String(c));
      root.style.setProperty("--theme-color-h", String(h));
    }
  } catch {
    // Invalid color — silently skip
  }
}

/** Map the current route path to a help page key */
function pathToHelpPage(path: string): string {
  const map: Record<string, string> = {
    "/dashboard": "dashboard",
    "/sales": "sales",
    "/customers": "customers",
    "/products": "products",
    "/inventory": "inventory",
    "/inventory-movement": "inventory",
    "/purchase-orders": "purchaseOrders",
    "/analytics": "analytics",
    "/profile": "profile",
    "/user-management": "userManagement",
    "/super-admin": "superAdmin",
    "/loaner-inventory": "inventory",
    "/stage-inventory": "inventory",
    "/customer-goals": "customers",
    "/customer-medical-issues": "customers",
    "/user-preferences": "dashboard",
  };
  return map[path] ?? "dashboard";
}

export function Layout({
  children,
  currentPath,
  pageTitle,
  onNavigate,
}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { profile, isLoadingProfile, userProfile } = useProfile();
  const { isImpersonating, profileName, impersonateAsRole, stopImpersonation } =
    useImpersonation();

  const profileKey = profile?.profile_key ?? userProfile?.profile_key ?? null;
  const targetRole = userProfile?.role
    ? typeof userProfile.role === "string"
      ? userProfile.role
      : String(userProfile.role)
    : null;

  const { data: unreadCount = 0 } = useUnreadNotificationCount(
    profileKey,
    targetRole,
  );

  // Background checks — run once on mount and every 5 minutes
  const runBackgroundChecks = useRunBackgroundChecks();
  const bgChecksRef = useRef(runBackgroundChecks);
  bgChecksRef.current = runBackgroundChecks;

  useEffect(() => {
    if (!profileKey) return;
    bgChecksRef.current.mutate();
    const interval = setInterval(
      () => bgChecksRef.current.mutate(),
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [profileKey]);

  // Apply profile brand color overlay when profile.theme_color changes.
  // This is SEPARATE from the theme class — only overrides --primary.
  useEffect(() => {
    if (profile?.theme_color) {
      applyProfileBrandVars(profile.theme_color);
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
        {/* Impersonation banner — shown above the header */}
        {isImpersonating && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30"
            data-ocid="impersonation.banner"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm">👁️</span>
              <p className="text-xs sm:text-sm font-medium text-amber-700 dark:text-amber-400 truncate">
                Viewing as{" "}
                <span className="font-semibold capitalize">
                  {impersonateAsRole}
                </span>{" "}
                of <span className="font-bold">{profileName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={stopImpersonation}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-700 dark:text-amber-400 transition-colors"
              data-ocid="impersonation.exit_button"
            >
              Exit
            </button>
          </div>
        )}

        <Header
          onMenuToggle={() => setSidebarOpen(true)}
          pageTitle={pageTitle}
          notificationCount={unreadCount}
          onNotificationsClick={() => setNotificationsPanelOpen(true)}
          onNavigate={onNavigate}
          onHelpOpen={() => setHelpOpen(true)}
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

      {/* Notifications slide-out panel */}
      <NotificationsPanel
        open={notificationsPanelOpen}
        onClose={() => setNotificationsPanelOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Help panel — page-aware */}
      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPage={pathToHelpPage(currentPath)}
      />

      <Toaster richColors position="top-right" />
    </div>
  );
}
