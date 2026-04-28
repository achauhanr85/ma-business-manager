/**
 * NotificationsPanel.tsx — Slide-out notification panel and bell button.
 *
 * WHAT THIS FILE DOES:
 * This file has two exports:
 *   1. `NotificationsPanel` — a Sheet (slide-out drawer) that lists all notifications
 *      for the current user, grouped by type (welcome, staff approvals, payments, etc.)
 *   2. `NotificationsBellButton` — the bell icon rendered in the Header, with an unread badge
 *
 * HOW NOTIFICATIONS ARE FETCHED (BUG-04 FIX):
 * The backend exposes `getNotificationsForUser()` which returns ALL notifications for the
 * calling principal — it merges personal notifications (welcome, account events) with
 * role-scoped notifications (staff approvals, profile registrations) in one call.
 *
 * For Super Admin: this call returns profile registration notifications (no profileKey needed)
 * because the backend writes those with the SA's principal and no profileKey filter.
 *
 * Falls back to `getNotifications(profileKey, targetRole)` if the merged API is unavailable
 * on older backend deployments.
 *
 * NOTIFICATION GROUPS:
 * Notifications are grouped into sections for readability:
 *   - Welcome (first login welcome message)
 *   - Staff Approvals (new user needs approval)
 *   - New Profiles (Super Admin approval needed)
 *   - Overdue Payments
 *   - Loaned Items (sold or payout owed)
 *   - Customer Follow-ups
 *   - Other
 *
 * WHO USES THIS:
 *   Layout.tsx — renders NotificationsPanel (the full sheet) and NotificationsBellButton
 *   (bell is used inside Header.tsx via Layout)
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProfile } from "@/contexts/ProfileContext";
// ROUTES provides type-safe, centralised path constants so navigation targets
// are never raw strings that silently break when routes change.
import { ROUTES } from "@/lib/routes";
import { useTranslation } from "@/translations";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Bell,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Package,
  Smile,
  UserCheck,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { createActor } from "../backend";
import type { Notification } from "../backend";

/** Internal helper to get the backend actor */
function useBackendActor() {
  return useActor(createActor);
}

/**
 * useGetNotificationsForCurrentUser — fetches all notifications for the
 * currently logged-in user.
 *
 * BUG-04 FIX: Uses `getNotificationsForUser()` which merges ALL notification
 * types (personal + role-scoped) in one backend call. This is what makes
 * Super Admin see profile registration notifications without needing a profileKey.
 *
 * Falls back to the older `getNotifications(profileKey, targetRole)` API if
 * `getNotificationsForUser` is not available on the deployed backend.
 *
 * @param profileKey  - User's profile key (used only for fallback API)
 * @param targetRole  - User's role string (used only for fallback API)
 */
function useGetNotificationsForCurrentUser(
  profileKey: string | null,
  targetRole: string | null,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<Notification[]>({
    queryKey: ["notifications", profileKey, targetRole],
    queryFn: async () => {
      if (!actor) return [];
      // Prefer the merged API — returns all notifications for the caller
      if (typeof actor.getNotificationsForUser === "function") {
        try {
          const results = await actor.getNotificationsForUser();
          return Array.isArray(results) ? results : [];
        } catch {
          // Fall through to old API if the merged one fails
        }
      }
      // Fallback: old profileKey + targetRole scoped query
      if (!profileKey || !targetRole) return [];
      if (typeof actor.getNotifications !== "function") return [];
      return actor.getNotifications(profileKey, targetRole);
    },
    // Run even without profileKey so Super Admin (who has no profileKey) still gets notifications
    enabled: !!actor && !isFetching,
    // Poll every minute so the panel stays fresh
    refetchInterval: 60_000,
  });
}

/**
 * useMarkNotificationReadLocal — marks a single notification as read.
 * Invalidates the notifications query so the badge count updates immediately.
 */
function useMarkNotificationReadLocal() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.markNotificationRead !== "function") return false;
      return actor.markNotificationRead(notificationId);
    },
    onSuccess: () => {
      // Refresh notification list so the unread count updates
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * useCheckAndCreateNotificationsLocal — triggers the backend to scan for
 * conditions that should generate notifications (overdue payments, follow-ups, etc.)
 * and creates any missing notification records.
 *
 * This is called on panel open and every 5 minutes so notifications stay fresh.
 * @param profileKey - The profile key to scan (null = skip for Super Admin without active profile)
 */
function useCheckAndCreateNotificationsLocal(profileKey: string | null) {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor || !profileKey) return BigInt(0);
      if (typeof actor.checkAndCreateNotifications !== "function")
        return BigInt(0);
      return actor.checkAndCreateNotifications(profileKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/** Props for the individual notification item component */
interface NotificationItemProps {
  notification: Notification;
  onNavigate?: (path: string) => void;
}

/**
 * notificationIcon — returns the appropriate icon for a notification type.
 * Different notification types get different coloured icons for quick scanning.
 */
function notificationIcon(type: string) {
  switch (type) {
    case "StaffPendingApproval":
      return <UserCheck className="w-4 h-4 text-amber-500" />;
    case "PaymentOverdue":
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    case "CustomerFollowUp":
      return <Clock className="w-4 h-4 text-primary" />;
    case "LoanedItemSold":
      return <Package className="w-4 h-4 text-violet-500" />;
    case "LoanerPayoutOwed":
      return <DollarSign className="w-4 h-4 text-orange-500" />;
    // Welcome notifications — multiple type strings used across backend versions
    case "WelcomeNotification":
    case "Welcome":
    case "welcome":
      return <Smile className="w-4 h-4 text-primary" />;
    // Profile registration alerts — shown to Super Admin
    case "NewProfileRegistered":
    case "profile_registered":
      return <Building2 className="w-4 h-4 text-primary" />;
    case "LeadFollowUp":
    case "lead_follow":
      return <Calendar className="w-4 h-4 text-amber-500" />;
    default:
      return <Bell className="w-4 h-4 text-muted-foreground" />;
  }
}

/**
 * notificationNavPath — returns the route path the user should be navigated to
 * when they click "View →" on a notification. Returns null for types without
 * a dedicated destination (e.g. welcome notifications).
 */
function notificationNavPath(notification: Notification): string | null {
  switch (notification.notification_type) {
    case "StaffPendingApproval":
      // ROUTES.userManagement = "/user-management" — using the constant avoids
      // a silent routing miss if the path ever changes (was incorrectly "/users").
      return ROUTES.userManagement; // Admin reviews pending users on User Management
    case "CustomerFollowUp":
    case "LeadFollowUp":
    case "lead_follow":
      // Navigate to specific customer if related_id is set, otherwise customer list
      return notification.related_id
        ? `/customers/${notification.related_id}`
        : "/customers";
    case "PaymentOverdue":
      return "/sales"; // Admin reviews overdue orders on Sales page
    case "LoanedItemSold":
    case "LoanerPayoutOwed":
      return "/loaner-inventory";
    case "NewProfileRegistered":
    case "profile_registered":
      return "/super-admin"; // Super Admin reviews new profiles on their dashboard
    default:
      return null;
  }
}

/**
 * formatTimestamp — converts a nanosecond IC timestamp to a relative time string.
 * e.g. "Just now", "5m ago", "3h ago", "2d ago"
 */
function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / BigInt(1_000_000));
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * NotificationItem — renders a single notification with icon, message,
 * timestamp, and action buttons (View + Mark read).
 */
function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const markRead = useMarkNotificationReadLocal();
  const navPath = notificationNavPath(notification);

  /** Clicking the notification marks it read AND navigates to the relevant page */
  function handleClick() {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    if (navPath && onNavigate) {
      onNavigate(navPath);
    }
  }

  // Staff approval notifications get a different action label
  const isStaffApproval =
    notification.notification_type === "StaffPendingApproval";

  return (
    <div
      className={`relative flex gap-3 px-4 py-3 border-b border-border last:border-0 w-full text-left transition-colors hover:bg-muted/40 ${
        notification.is_read ? "opacity-60" : "bg-primary/5"
      }`}
      data-ocid={`notification.item.${notification.id}`}
    >
      {/* Unread indicator dot — top-right corner of the item */}
      {!notification.is_read && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
      )}
      {/* Type icon — left side */}
      <div className="mt-0.5 flex-shrink-0">
        {notificationIcon(notification.notification_type)}
      </div>
      {/* Message + timestamp + action buttons */}
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm text-foreground leading-snug break-words">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTimestamp(notification.created_at)}
        </p>
        {/* Action buttons — positioned BELOW the content, never overlapping the header close button */}
        <div className="flex items-center gap-2 mt-2">
          {navPath && (
            <button
              type="button"
              onClick={handleClick}
              className="text-xs font-medium text-primary hover:underline"
              data-ocid={`notification.action_button.${notification.id}`}
            >
              {isStaffApproval ? "Review & Approve →" : "View →"}
            </button>
          )}
          {/* Mark read — only shown for unread notifications */}
          {!notification.is_read && (
            <button
              type="button"
              onClick={() => markRead.mutate(notification.id)}
              className="text-xs text-muted-foreground hover:text-foreground"
              data-ocid={`notification.mark_read_button.${notification.id}`}
            >
              Mark read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Props for the notification group section */
interface NotificationGroupProps {
  title: string;
  notifications: Notification[];
  ocid: string;
  onNavigate?: (path: string) => void;
}

/**
 * NotificationGroup — renders a labelled section of notifications.
 * Returns null (renders nothing) if the group has no items, so empty
 * sections are hidden automatically.
 */
function NotificationGroup({
  title,
  notifications,
  ocid,
  onNavigate,
}: NotificationGroupProps) {
  // Don't render the section header if there are no notifications in this group
  if (notifications.length === 0) return null;
  return (
    <section data-ocid={ocid}>
      {/* Sticky section label — stays visible while scrolling through long groups */}
      <div className="px-4 py-2 bg-muted/30 sticky top-0 z-[1]">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      </div>
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} onNavigate={onNavigate} />
      ))}
    </section>
  );
}

/** Props for the full NotificationsPanel sheet component */
interface NotificationsPanelProps {
  /** Whether the sheet is currently open */
  open: boolean;
  /** Called when the user closes the panel (X button or clicking outside) */
  onClose: () => void;
  /** Called when the user clicks a notification action link */
  onNavigate?: (path: string) => void;
}

/**
 * NotificationsPanel — the slide-out sheet that shows all notifications.
 * Opens from the right side of the screen, triggered by the bell icon.
 *
 * Notifications are fetched via `getNotificationsForUser()` which handles both
 * normal users and Super Admin in one call (no profileKey filter needed for SA).
 */
export function NotificationsPanel({
  open,
  onClose,
  onNavigate,
}: NotificationsPanelProps) {
  const { profile, userProfile } = useProfile();
  const t = useTranslation();

  // Derive profile key and role for the fallback notification API
  const profileKey = profile?.profile_key ?? userProfile?.profile_key ?? null;
  const targetRole = userProfile?.role
    ? typeof userProfile.role === "string"
      ? userProfile.role
      : String(userProfile.role)
    : null;

  // Fetch all notifications for the current user
  const { data: notifications = [], isLoading } =
    useGetNotificationsForCurrentUser(profileKey, targetRole);

  // Set up background notification scan
  const checkAndCreate = useCheckAndCreateNotificationsLocal(profileKey);
  // Use a ref so the interval always calls the latest mutation function
  const checkAndCreateRef = useRef(checkAndCreate);
  checkAndCreateRef.current = checkAndCreate;

  // Trigger a notification scan on mount and every 5 minutes.
  // This is also what creates the welcome notification for first-time users.
  useEffect(() => {
    if (profileKey) checkAndCreateRef.current.mutate();
    const interval = setInterval(
      () => {
        if (profileKey) checkAndCreateRef.current.mutate();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [profileKey]);

  // Count unread notifications for the badge in the sheet title
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  /** Navigate and close the panel — so clicking an action link closes the drawer */
  function handleNavigate(path: string) {
    onClose();
    onNavigate?.(path);
  }

  // ── Group notifications by type for organised display ────────────────────────

  // Welcome messages — first login, account creation confirmation
  const welcomeNotifs = notifications.filter(
    (n) =>
      n.notification_type === "WelcomeNotification" ||
      n.notification_type === "Welcome" ||
      n.notification_type === "welcome",
  );

  // Staff pending approval — Admin needs to approve new team members
  const staffAlerts = notifications.filter(
    (n) => n.notification_type === "StaffPendingApproval",
  );

  // Overdue payment alerts — customers with outstanding balances
  const paymentAlerts = notifications.filter(
    (n) => n.notification_type === "PaymentOverdue",
  );

  // Customer and lead follow-up reminders
  const followUps = notifications.filter(
    (n) =>
      n.notification_type === "CustomerFollowUp" ||
      n.notification_type === "LeadFollowUp" ||
      n.notification_type === "lead_follow",
  );

  // Loaned item alerts — item sold or payout owed to lender
  const loanedAlerts = notifications.filter(
    (n) =>
      n.notification_type === "LoanedItemSold" ||
      n.notification_type === "LoanerPayoutOwed",
  );

  // New profile registration alerts — Super Admin needs to approve new profiles
  const profileAlerts = notifications.filter(
    (n) =>
      n.notification_type === "NewProfileRegistered" ||
      n.notification_type === "profile_registered",
  );

  // Everything else that doesn't fit the above groups
  const others = notifications.filter(
    (n) =>
      n.notification_type !== "WelcomeNotification" &&
      n.notification_type !== "Welcome" &&
      n.notification_type !== "welcome" &&
      n.notification_type !== "StaffPendingApproval" &&
      n.notification_type !== "PaymentOverdue" &&
      n.notification_type !== "CustomerFollowUp" &&
      n.notification_type !== "LeadFollowUp" &&
      n.notification_type !== "lead_follow" &&
      n.notification_type !== "LoanedItemSold" &&
      n.notification_type !== "LoanerPayoutOwed" &&
      n.notification_type !== "NewProfileRegistered" &&
      n.notification_type !== "profile_registered",
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm p-0 flex flex-col overflow-hidden"
        data-ocid="notifications.panel"
      >
        {/*
          STICKY PANEL HEADER
          - Title on the left with unread badge
          - Close button on the RIGHT — never floats over scrollable content
          - z-10 keeps it above the notification list while scrolling
        */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0 sticky top-0 z-10 bg-card">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="w-4 h-4 text-primary" />
              {t.notifications.title}
              {/* Unread badge — only shown when there are unread notifications */}
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="text-xs px-1.5 py-0.5 h-auto min-w-[1.2rem] rounded-full"
                  data-ocid="notifications.unread_badge"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </SheetTitle>
            {/* Close button — anchored to the RIGHT of the header row */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={onClose}
              aria-label={t.common.close}
              data-ocid="notifications.close_button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable notification list — independent of the sticky header */}
        <ScrollArea className="flex-1 overflow-auto">
          {isLoading ? (
            // Loading spinner while fetching from backend
            <div
              className="flex flex-col items-center justify-center py-12 gap-2"
              data-ocid="notifications.loading_state"
            >
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">
                {t.common.loading}
              </p>
            </div>
          ) : notifications.length === 0 ? (
            // Empty state — shown when all notifications have been read or none exist
            <div
              className="flex flex-col items-center justify-center py-16 gap-3"
              data-ocid="notifications.empty_state"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                All caught up!
              </p>
              <p className="text-xs text-muted-foreground text-center px-8">
                {t.notifications.noNotifications}
              </p>
            </div>
          ) : (
            // Grouped notification list — empty groups render nothing (see NotificationGroup)
            <div className="divide-y divide-border">
              <NotificationGroup
                title="Welcome"
                notifications={welcomeNotifs}
                ocid="notifications.welcome_section"
                onNavigate={handleNavigate}
              />
              <NotificationGroup
                title="Staff Approvals"
                notifications={staffAlerts}
                ocid="notifications.staff_section"
                onNavigate={handleNavigate}
              />
              <NotificationGroup
                title="New Profiles"
                notifications={profileAlerts}
                ocid="notifications.profile_section"
                onNavigate={handleNavigate}
              />
              <NotificationGroup
                title="Overdue Payments"
                notifications={paymentAlerts}
                ocid="notifications.payment_section"
                onNavigate={handleNavigate}
              />
              <NotificationGroup
                title="Loaned Items"
                notifications={loanedAlerts}
                ocid="notifications.loaned_section"
                onNavigate={handleNavigate}
              />
              <NotificationGroup
                title="Customer Follow-ups"
                notifications={followUps}
                ocid="notifications.followup_section"
                onNavigate={handleNavigate}
              />
              <NotificationGroup
                title="Other"
                notifications={others}
                ocid="notifications.other_section"
                onNavigate={handleNavigate}
              />
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/**
 * NotificationsBellButton — the bell icon rendered in the Header.
 * Shows a red badge with the unread count when there are unread notifications.
 * Clicking opens the NotificationsPanel.
 */
export function NotificationsBellButton({
  onClick,
  unreadCount,
}: {
  onClick: () => void;
  unreadCount: number;
}) {
  const t = useTranslation();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 relative"
      onClick={onClick}
      aria-label={`${t.notifications.title}${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      data-ocid="header.notifications_button"
    >
      <Bell className="w-4 h-4" />
      {/* Unread badge — hidden when count is 0 */}
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive flex items-center justify-center text-[9px] font-bold text-destructive-foreground"
          data-ocid="header.notifications_badge"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Button>
  );
}
