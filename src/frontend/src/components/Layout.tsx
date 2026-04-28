/**
 * Layout.tsx — The main page wrapper used by every authenticated page.
 *
 * WHAT THIS FILE DOES:
 * Layout renders the three-panel shell that surrounds every page:
 *   - Sidebar (left, collapsible on mobile)
 *   - Header (sticky top bar with title, icons, notifications bell)
 *   - Main content area (where each page's content goes)
 *   - Footer (branding)
 *   - NotificationsPanel (slide-out sheet, triggered by bell icon)
 *   - HelpPanel (slide-out sheet, triggered by help icon)
 *   - Toaster (toast notification stack)
 *
 * It also:
 *   - Runs background notification checks every 5 minutes
 *   - Shows an impersonation banner when Super Admin is viewing as another role
 *   - Applies the profile brand colour as a CSS overlay via `applyProfileBrandVars()`
 *
 * WHO USES THIS:
 *   App.tsx — both AppContent and SuperAdminApp wrap their content in Layout
 */

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

/** Props accepted by the Layout component */
interface LayoutProps {
  children: React.ReactNode;
  /** Current route path — passed to Sidebar to highlight active nav item */
  currentPath: string;
  /** Human-readable page title shown in the Header */
  pageTitle: string;
  /** Called whenever any nav item, icon, or button triggers navigation */
  onNavigate: (path: string) => void;
}

/** Local helper to get the backend actor */
function useBackendActor() {
  return useActor(createActor);
}

/**
 * useUnreadNotificationCount — fetches the notification list and counts unread items.
 * Used only to drive the badge number on the bell icon in the header.
 * The full notification list is loaded separately inside NotificationsPanel.
 *
 * @param profileKey  - The user's profile key (null for Super Admin with no active profile)
 * @param targetRole  - The user's role as a string (used to scope notifications)
 * @returns number of unread notifications
 */
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
    // Poll every minute so the badge stays fresh without the user needing to refresh
    refetchInterval: 60_000,
    // `select` transforms the query result — here we count unread items only
    select: (data) => data.filter((n) => !n.is_read).length,
  });
}

/**
 * applyProfileBrandVars — applies the business profile's brand colour as CSS
 * variable overlays. Sets only `--primary` and `--theme-color-*` — does NOT
 * override structural tokens like `--background` or `--card`.
 *
 * This is called whenever `profile.theme_color` changes (e.g. after an edit).
 * The same logic exists in ProfileContext.tsx; this is needed here as a fallback
 * because Layout renders after the context and may need to re-apply the colour
 * if the theme was just changed.
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
    // Invalid colour — silently skip
  }
}

/**
 * pathToHelpPage — maps the current route path to a help topic key.
 * The HelpPanel uses this key to show relevant content for the current page.
 * Paths that don't have a dedicated help topic fall back to "dashboard".
 */
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

/**
 * Layout — the main shell component. Import this in every page that needs
 * the standard sidebar + header + footer chrome.
 */
export function Layout({
  children,
  currentPath,
  pageTitle,
  onNavigate,
}: LayoutProps) {
  // `sidebarOpen` controls whether the mobile overlay sidebar is visible
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // `notificationsPanelOpen` controls the slide-out notifications panel
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  // `helpOpen` controls the slide-out help panel
  const [helpOpen, setHelpOpen] = useState(false);

  const { profile, isLoadingProfile, userProfile } = useProfile();
  const { isImpersonating, profileName, impersonateAsRole, stopImpersonation } =
    useImpersonation();

  // Derive the profile key and target role for notification queries.
  // `profile.profile_key` is preferred (business profile); fallback to user profile key.
  const profileKey = profile?.profile_key ?? userProfile?.profile_key ?? null;
  const targetRole = userProfile?.role
    ? typeof userProfile.role === "string"
      ? userProfile.role
      : String(userProfile.role)
    : null;

  // Drive the badge count on the bell icon in the header
  const { data: unreadCount = 0 } = useUnreadNotificationCount(
    profileKey,
    targetRole,
  );

  // Background checks — run once on mount and then every 5 minutes.
  // This triggers the backend to check for overdue payments, follow-ups, etc.
  // and creates notification records where applicable.
  const runBackgroundChecks = useRunBackgroundChecks();
  // Use a ref so the interval callback always has the latest mutate function
  const bgChecksRef = useRef(runBackgroundChecks);
  bgChecksRef.current = runBackgroundChecks;

  useEffect(() => {
    // Only run if the user belongs to a profile (Super Admin without active profile skips)
    if (!profileKey) return;
    bgChecksRef.current.mutate();
    const interval = setInterval(
      () => bgChecksRef.current.mutate(),
      5 * 60 * 1000, // every 5 minutes
    );
    return () => clearInterval(interval);
  }, [profileKey]);

  // Re-apply profile brand colour whenever `profile.theme_color` changes.
  // e.g. when the user saves new brand settings on the Profile page
  useEffect(() => {
    if (profile?.theme_color) {
      applyProfileBrandVars(profile.theme_color);
    }
  }, [profile?.theme_color]);

  // Show skeleton while profile data is still loading to avoid a flash of empty header
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
      {/* Sidebar — fixed on desktop, overlay on mobile */}
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content area — shifted right on desktop to clear the fixed sidebar */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Impersonation banner — only shown when Super Admin is viewing as another role */}
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
            {/* Exit button ends impersonation and returns Super Admin to their own dashboard */}
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

        {/* Sticky header with page title and quick-action icons */}
        <Header
          onMenuToggle={() => setSidebarOpen(true)}
          pageTitle={pageTitle}
          notificationCount={unreadCount}
          onNotificationsClick={() => setNotificationsPanelOpen(true)}
          onNavigate={onNavigate}
          onHelpOpen={() => setHelpOpen(true)}
        />

        {/* Page content — each page component renders here */}
        <main
          className="flex-1 p-4 lg:p-6 bg-background"
          data-ocid="main_content"
        >
          {children}
        </main>

        {/* Footer — branding, always at the bottom of the content area */}
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

      {/* Notifications slide-out panel — opens from the right */}
      <NotificationsPanel
        open={notificationsPanelOpen}
        onClose={() => setNotificationsPanelOpen(false)}
        onNavigate={onNavigate}
      />

      {/* Help panel — page-aware help content, opens from the right */}
      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPage={pathToHelpPage(currentPath)}
      />

      {/* Toast notification stack — positioned top-right, auto-dismisses */}
      <Toaster richColors position="top-right" />
    </div>
  );
}
