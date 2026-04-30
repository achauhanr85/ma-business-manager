/**
 * NotificationsPanel.tsx — Slide-out notification panel and bell button.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * FETCH FLOW:
 *   1. Panel mounts → useGetNotificationsForCurrentUser() called
 *   2. Tries actor.getNotificationsForUser() (merged API — returns ALL
 *      notification types for the calling principal in one call)
 *   3. Falls back to actor.getNotifications(profileKey, targetRole) if merged
 *      API unavailable (older backend deployment)
 *   4. SUPER ADMIN SPECIAL CASE: pass "superadmin" sentinel as profileKey
 *      (system-level notifications stored with this sentinel, not a real key)
 *   5. Polls every 60 seconds to stay fresh
 *
 * NOTIFICATION SCAN FLOW:
 *   1. On mount (and every 5 minutes): checkAndCreateNotifications(profileKey)
 *   2. Backend scans for conditions that should generate notifications
 *      (overdue payments, follow-ups, etc.) and creates missing records
 *   3. Query cache invalidated → panel re-renders with new notifications
 *
 * INLINE APPROVE/REJECT FLOW (for NewProfilePendingApproval):
 *   1. Notification shows Approve + Reject buttons
 *   2. User clicks Approve → handleInlineApprove()
 *      → approveProfile.mutateAsync(notification.related_id)
 *      → backend sets approval_status = #approved
 *      → cache invalidated → notification disappears from panel
 *   3. User clicks Reject → handleInlineReject()
 *      → rejectProfile.mutateAsync(notification.related_id)
 *      → backend sets approval_status = #suspended (record preserved)
 *
 * NAVIGATION FLOW:
 *   User clicks "View →" on a notification
 *   → notificationNavPath() returns the route
 *   → markRead() called (notification.is_read = true)
 *   → onNavigate(path) called → panel closes → router navigates
 *
 * DIAGNOSTIC LOGGING:
 *   DEBUG (1): panel open/close, notification fetch triggered
 *   INFO  (2): notifications loaded (count), approve/reject actions
 *   WARN  (3): empty notifications, related_id missing on approve/reject
 *   ERROR (4): approve/reject failures
 *
 * WHO USES THIS:
 *   Layout.tsx — renders NotificationsPanel + NotificationsBellButton
 *   (bell is inside Header.tsx via Layout)
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
import { logDebug, logError, logInfo, logTrace, logWarn } from "@/lib/logger";
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
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  Smile,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
 * FETCH FLOW:
 *   1. Try actor.getNotificationsForUser() — merged API, no profileKey needed
 *   2. On failure, fall back to getNotifications(effectiveProfileKey, targetRole)
 *   3. For Super Admin fallback: use "superadmin" sentinel as profileKey so
 *      system-level notifications (stored without real profileKey) are returned
 *
 * VARIABLE INITIALIZATION:
 *   effectiveProfileKey: "superadmin" for SA, real profileKey for others
 *   isSuperAdmin: boolean — checked against targetRole string
 *
 * @param profileKey  - User's profile key (fallback API only)
 * @param targetRole  - User's role string (fallback API only)
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
      logDebug("NotificationsPanel: fetching notifications", {
        profileKey,
        targetRole,
      });

      // Prefer the merged API — returns all notifications for the calling principal
      if (typeof actor.getNotificationsForUser === "function") {
        try {
          const results = await actor.getNotificationsForUser();
          logInfo("NotificationsPanel: getNotificationsForUser returned", {
            count: Array.isArray(results) ? results.length : 0,
          });
          return Array.isArray(results) ? results : [];
        } catch (err) {
          logWarn(
            "NotificationsPanel: getNotificationsForUser failed, falling back",
            err,
          );
        }
      }

      // Fallback: old profileKey + targetRole scoped query.
      // SUPER ADMIN FIX: System notifications stored with profile_key = "superadmin"
      // (sentinel). Pass this exact value for SA so system notifications are returned.
      const isSuperAdmin =
        targetRole === "superAdmin" || targetRole === "super_admin";
      logTrace("NotificationsPanel: isSuperAdmin check", {
        isSuperAdmin,
        targetRole,
      });

      // effectiveProfileKey: "superadmin" sentinel for SA, real key for others
      const effectiveProfileKey = isSuperAdmin
        ? "superadmin"
        : (profileKey ?? "");

      if (!effectiveProfileKey && !isSuperAdmin) {
        logWarn(
          "NotificationsPanel: no profileKey and not SA — returning empty",
        );
        return [];
      }
      if (typeof actor.getNotifications !== "function") {
        logWarn("NotificationsPanel: getNotifications not available on actor");
        return [];
      }

      const results = await actor.getNotifications(
        effectiveProfileKey,
        targetRole ?? "",
      );
      logInfo("NotificationsPanel: getNotifications fallback returned", {
        count: Array.isArray(results) ? results.length : 0,
        effectiveProfileKey,
      });
      return Array.isArray(results) ? results : [];
    },
    // Run even without profileKey so Super Admin (no profileKey) still gets notifications
    enabled: !!actor && !isFetching,
    refetchInterval: 60_000, // poll every minute
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
      logDebug("NotificationsPanel: markNotificationRead", { notificationId });
      return actor.markNotificationRead(notificationId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      logError("NotificationsPanel: markNotificationRead failed", err);
    },
  });
}

/**
 * useCheckAndCreateNotificationsLocal — triggers the backend to scan for
 * notification conditions (overdue payments, follow-ups, etc.) and creates
 * any missing notification records.
 *
 * FLOW:
 *   Called on panel open and every 5 minutes.
 *   Also creates the welcome notification for first-time users.
 *
 * @param profileKey - Profile to scan (null = skip for SA without active profile)
 */
function useCheckAndCreateNotificationsLocal(profileKey: string | null) {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor || !profileKey) return BigInt(0);
      if (typeof actor.checkAndCreateNotifications !== "function")
        return BigInt(0);
      logDebug("NotificationsPanel: checkAndCreateNotifications", {
        profileKey,
      });
      return actor.checkAndCreateNotifications(profileKey);
    },
    onSuccess: (created) => {
      logInfo("NotificationsPanel: checkAndCreateNotifications completed", {
        created: String(created),
      });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      logError("NotificationsPanel: checkAndCreateNotifications failed", err);
    },
  });
}

/**
 * useApproveProfileLocal — inline Approve button for NewProfilePendingApproval.
 * Calls actor.approveProfile(profileKey) — sets approval_status to #approved.
 */
function useApproveProfileLocal() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileKey: string) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.approveProfile !== "function")
        throw new Error("approveProfile not available");
      logInfo("NotificationsPanel: approveProfile called", { profileKey });
      return (a.approveProfile as (pk: string) => Promise<boolean>)(profileKey);
    },
    onSuccess: (_, profileKey) => {
      logInfo("NotificationsPanel: approveProfile succeeded", { profileKey });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["super-admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
    },
    onError: (err, profileKey) => {
      logError("NotificationsPanel: approveProfile failed", {
        err,
        profileKey,
      });
    },
  });
}

/**
 * useRejectProfileLocal — inline Reject button for NewProfilePendingApproval.
 * Sets approval_status to #suspended (record preserved for audit trail).
 */
function useRejectProfileLocal() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileKey: string) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.rejectProfile !== "function")
        throw new Error("rejectProfile not available");
      logInfo("NotificationsPanel: rejectProfile called", { profileKey });
      return (a.rejectProfile as (pk: string) => Promise<boolean>)(profileKey);
    },
    onSuccess: (_, profileKey) => {
      logInfo("NotificationsPanel: rejectProfile succeeded", { profileKey });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["super-admin-notifications"] });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
    },
    onError: (err, profileKey) => {
      logError("NotificationsPanel: rejectProfile failed", { err, profileKey });
    },
  });
}

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: (path: string) => void;
}

/**
 * notificationIcon — returns the appropriate icon for a notification type.
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
    case "WelcomeNotification":
    case "Welcome":
    case "welcome":
      return <Smile className="w-4 h-4 text-primary" />;
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
 * notificationNavPath — returns the route to navigate to when clicking "View →".
 * Returns null for notification types without a dedicated destination.
 */
function notificationNavPath(notification: Notification): string | null {
  switch (notification.notification_type) {
    case "StaffPendingApproval":
      return ROUTES.userManagement;
    case "CustomerFollowUp":
    case "LeadFollowUp":
    case "lead_follow":
      return notification.related_id
        ? `/customers/${notification.related_id}`
        : "/customers";
    case "PaymentOverdue":
      return "/sales";
    case "LoanedItemSold":
    case "LoanerPayoutOwed":
      return "/loaner-inventory";
    case "NewProfilePendingApproval":
    case "NewProfileRegistered":
    case "profile_registered":
      return ROUTES.profileApprovals;
    default:
      return null;
  }
}

/**
 * formatTimestamp — converts a nanosecond IC timestamp to a relative time string.
 * e.g. "Just now", "5m ago", "3h ago", "2d ago"
 *
 * VARIABLE INITIALIZATION:
 *   ms: number — timestamp in milliseconds (IC ns ÷ 1_000_000)
 *   diff: number — milliseconds since the notification was created
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
 *
 * INLINE APPROVE/REJECT FLOW:
 *   For NewProfilePendingApproval: shows Approve + Reject buttons
 *   → clicking calls handleInlineApprove / handleInlineReject
 *   → notification.related_id = the profileKey to approve/reject
 *   → after action: notification marked read + list refreshes
 */
function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const markRead = useMarkNotificationReadLocal();
  const approveProfile = useApproveProfileLocal();
  const rejectProfile = useRejectProfileLocal();
  const navPath = notificationNavPath(notification);

  // TRACE: variable initialization for inline action state
  const [inlineApproving, setInlineApproving] = useState(false);
  const [inlineRejecting, setInlineRejecting] = useState(false);

  logTrace("NotificationItem: rendering", {
    id: notification.id,
    type: notification.notification_type,
    is_read: notification.is_read,
  });

  /** Click: mark read + navigate to relevant page */
  function handleClick() {
    logDebug("NotificationItem: clicked", { id: notification.id, navPath });
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    if (navPath && onNavigate) {
      onNavigate(navPath);
    }
  }

  /**
   * handleInlineApprove — approve the profile directly from the panel.
   *
   * FLOW:
   *   1. Get profileKey from notification.related_id
   *   2. Call approveProfile.mutateAsync(profileKey)
   *   3. Mark notification as read
   *   4. Show success toast
   */
  async function handleInlineApprove() {
    const profileKey = notification.related_id;
    if (!profileKey) {
      logWarn(
        "NotificationItem: handleInlineApprove — no related_id on notification",
        {
          notificationId: notification.id,
        },
      );
      toast.error(
        "Cannot approve: profile key not found in this notification.",
      );
      return;
    }
    setInlineApproving(true);
    logInfo("NotificationItem: handleInlineApprove", { profileKey });
    try {
      await approveProfile.mutateAsync(profileKey);
      if (!notification.is_read) markRead.mutate(notification.id);
      toast.success(`Profile "${profileKey}" approved successfully.`);
    } catch (err) {
      logError("NotificationItem: handleInlineApprove failed", err);
      toast.error(
        "Failed to approve profile. The backend function may not be deployed yet.",
      );
    } finally {
      setInlineApproving(false);
    }
  }

  /**
   * handleInlineReject — reject the profile directly from the panel.
   *
   * FLOW:
   *   1. Get profileKey from notification.related_id
   *   2. Call rejectProfile.mutateAsync(profileKey) — sets #suspended
   *   3. Mark notification as read
   *   4. Show success toast
   */
  async function handleInlineReject() {
    const profileKey = notification.related_id;
    if (!profileKey) {
      logWarn(
        "NotificationItem: handleInlineReject — no related_id on notification",
        {
          notificationId: notification.id,
        },
      );
      toast.error("Cannot reject: profile key not found in this notification.");
      return;
    }
    setInlineRejecting(true);
    logInfo("NotificationItem: handleInlineReject", { profileKey });
    try {
      await rejectProfile.mutateAsync(profileKey);
      if (!notification.is_read) markRead.mutate(notification.id);
      toast.success(`Profile "${profileKey}" rejected.`);
    } catch (err) {
      logError("NotificationItem: handleInlineReject failed", err);
      toast.error(
        "Failed to reject profile. The backend function may not be deployed yet.",
      );
    } finally {
      setInlineRejecting(false);
    }
  }

  const isStaffApproval =
    notification.notification_type === "StaffPendingApproval";
  const isProfileApproval =
    notification.notification_type === "NewProfilePendingApproval";
  const isBusy = inlineApproving || inlineRejecting;

  return (
    <div
      className={`relative flex gap-3 px-4 py-3 border-b border-border last:border-0 w-full text-left transition-colors hover:bg-muted/40 ${
        notification.is_read ? "opacity-60" : "bg-primary/5"
      }`}
      data-ocid={`notification.item.${notification.id}`}
    >
      {/* Unread indicator dot */}
      {!notification.is_read && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
      )}
      {/* Type icon */}
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
        {/* Action buttons — positioned BELOW content, never overlapping close button */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Inline Approve/Reject for profile pending approval */}
          {isProfileApproval && notification.related_id && (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[11px] px-2 gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={handleInlineReject}
                disabled={isBusy}
                data-ocid={`notification.reject_profile_button.${notification.id}`}
              >
                {inlineRejecting ? (
                  <span className="w-2.5 h-2.5 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                Reject
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-6 text-[11px] px-2 gap-1"
                onClick={handleInlineApprove}
                disabled={isBusy}
                data-ocid={`notification.approve_profile_button.${notification.id}`}
              >
                {inlineApproving ? (
                  <span className="w-2.5 h-2.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                Approve
              </Button>
            </>
          )}
          {/* View link */}
          {navPath && (
            <button
              type="button"
              onClick={handleClick}
              className="text-xs font-medium text-primary hover:underline"
              data-ocid={`notification.action_button.${notification.id}`}
            >
              {isStaffApproval
                ? "Review & Approve →"
                : isProfileApproval
                  ? "View all approvals →"
                  : "View →"}
            </button>
          )}
          {/* Mark read */}
          {!notification.is_read && (
            <button
              type="button"
              onClick={() => {
                logDebug("NotificationItem: mark read clicked", {
                  id: notification.id,
                });
                markRead.mutate(notification.id);
              }}
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

interface NotificationGroupProps {
  title: string;
  notifications: Notification[];
  ocid: string;
  onNavigate?: (path: string) => void;
}

/**
 * NotificationGroup — renders a labelled section of notifications.
 * Returns null if the group has no items (empty sections hidden automatically).
 */
function NotificationGroup({
  title,
  notifications,
  ocid,
  onNavigate,
}: NotificationGroupProps) {
  if (notifications.length === 0) return null;
  return (
    <section data-ocid={ocid}>
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

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onNavigate?: (path: string) => void;
}

/**
 * NotificationsPanel — the slide-out sheet showing all notifications.
 *
 * PAGE FLOW SUMMARY:
 *   Open → fetch notifications → scan for new notifications
 *   → group by type → render grouped list
 *   User clicks notification → mark read + navigate
 *   SA clicks Approve/Reject → inline action → list refreshes
 */
export function NotificationsPanel({
  open,
  onClose,
  onNavigate,
}: NotificationsPanelProps) {
  const { profile, userProfile } = useProfile();
  const t = useTranslation();

  // TRACE: variable initialization for panel data
  // Derive profile key and role for the fallback notification API
  const profileKey = profile?.profile_key ?? userProfile?.profile_key ?? null;
  const targetRole = userProfile?.role
    ? typeof userProfile.role === "string"
      ? userProfile.role
      : String(userProfile.role)
    : null;

  logTrace("NotificationsPanel: initialized", { profileKey, targetRole, open });

  const { data: notifications = [], isLoading } =
    useGetNotificationsForCurrentUser(profileKey, targetRole);

  // Background notification scan
  const checkAndCreate = useCheckAndCreateNotificationsLocal(profileKey);
  const checkAndCreateRef = useRef(checkAndCreate);
  checkAndCreateRef.current = checkAndCreate;

  // Trigger scan on mount and every 5 minutes
  useEffect(() => {
    logDebug("NotificationsPanel: mounted, triggering notification scan", {
      profileKey,
    });
    if (profileKey) checkAndCreateRef.current.mutate();
    const interval = setInterval(
      () => {
        if (profileKey) {
          logDebug("NotificationsPanel: periodic notification scan");
          checkAndCreateRef.current.mutate();
        }
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [profileKey]);

  // Log when panel opens with notification count
  useEffect(() => {
    if (open) {
      logInfo("NotificationsPanel: panel opened", {
        totalNotifications: notifications.length,
        unread: notifications.filter((n) => !n.is_read).length,
      });
    }
  }, [open, notifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleNavigate(path: string) {
    logDebug("NotificationsPanel: navigating from notification", { path });
    onClose();
    onNavigate?.(path);
  }

  // ── Group notifications by type ──────────────────────────────────────────

  const welcomeNotifs = notifications.filter(
    (n) =>
      n.notification_type === "WelcomeNotification" ||
      n.notification_type === "Welcome" ||
      n.notification_type === "welcome",
  );
  const staffAlerts = notifications.filter(
    (n) => n.notification_type === "StaffPendingApproval",
  );
  const paymentAlerts = notifications.filter(
    (n) => n.notification_type === "PaymentOverdue",
  );
  const followUps = notifications.filter(
    (n) =>
      n.notification_type === "CustomerFollowUp" ||
      n.notification_type === "LeadFollowUp" ||
      n.notification_type === "lead_follow",
  );
  const loanedAlerts = notifications.filter(
    (n) =>
      n.notification_type === "LoanedItemSold" ||
      n.notification_type === "LoanerPayoutOwed",
  );
  const profileAlerts = notifications.filter(
    (n) =>
      n.notification_type === "NewProfilePendingApproval" ||
      n.notification_type === "NewProfileRegistered" ||
      n.notification_type === "profile_registered",
  );
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
      n.notification_type !== "NewProfilePendingApproval" &&
      n.notification_type !== "NewProfileRegistered" &&
      n.notification_type !== "profile_registered",
  );

  logTrace("NotificationsPanel: notification groups", {
    welcome: welcomeNotifs.length,
    staff: staffAlerts.length,
    payment: paymentAlerts.length,
    followUps: followUps.length,
    loaned: loanedAlerts.length,
    profiles: profileAlerts.length,
    others: others.length,
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-sm p-0 flex flex-col overflow-hidden"
        data-ocid="notifications.panel"
      >
        {/* STICKY PANEL HEADER — close button anchored RIGHT, never floats over list */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0 sticky top-0 z-10 bg-card">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="w-4 h-4 text-primary" />
              {t.notifications.title}
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

        {/* Scrollable notification list */}
        <ScrollArea className="flex-1 overflow-auto">
          {isLoading ? (
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
 * NotificationsBellButton — bell icon rendered in the Header.
 * Shows a red badge with the unread count when there are unread notifications.
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
