import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useProfile } from "../contexts/ProfileContext";

function useBackendActor() {
  return useActor(createActor);
}

function useGetNotificationsLocal(
  profileKey: string | null,
  targetRole: string | null,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<Notification[]>({
    queryKey: ["notifications", profileKey, targetRole],
    queryFn: async () => {
      if (!actor || !profileKey || !targetRole) return [];
      if (typeof actor.getNotifications !== "function") return [];
      return actor.getNotifications(profileKey, targetRole);
    },
    enabled: !!actor && !isFetching && !!profileKey && !!targetRole,
    refetchInterval: 60_000,
  });
}

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
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

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

interface NotificationItemProps {
  notification: Notification;
  onNavigate?: (path: string) => void;
}

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

function notificationNavPath(notification: Notification): string | null {
  switch (notification.notification_type) {
    case "StaffPendingApproval":
      return "/users";
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
    case "NewProfileRegistered":
    case "profile_registered":
      return "/super-admin";
    default:
      return null;
  }
}

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts / BigInt(1_000_000));
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  const markRead = useMarkNotificationReadLocal();
  const navPath = notificationNavPath(notification);

  function handleClick() {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    if (navPath && onNavigate) {
      onNavigate(navPath);
    }
  }

  const isStaffApproval =
    notification.notification_type === "StaffPendingApproval";

  return (
    <div
      className={`relative flex gap-3 px-4 py-3 border-b border-border last:border-0 w-full text-left transition-colors hover:bg-muted/40 ${
        notification.is_read ? "opacity-60" : "bg-primary/5"
      }`}
      data-ocid={`notification.item.${notification.id}`}
    >
      {!notification.is_read && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary" />
      )}
      <div className="mt-0.5 flex-shrink-0">
        {notificationIcon(notification.notification_type)}
      </div>
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm text-foreground leading-snug break-words">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatTimestamp(notification.created_at)}
        </p>
        {/* Action buttons — in the content flow, never overlapping header */}
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

interface NotificationGroupProps {
  title: string;
  notifications: Notification[];
  ocid: string;
  onNavigate?: (path: string) => void;
}

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

export function NotificationsPanel({
  open,
  onClose,
  onNavigate,
}: NotificationsPanelProps) {
  const { profile, userProfile } = useProfile();
  const profileKey = profile?.profile_key ?? userProfile?.profile_key ?? null;
  const targetRole = userProfile?.role
    ? typeof userProfile.role === "string"
      ? userProfile.role
      : String(userProfile.role)
    : null;

  const { data: notifications = [], isLoading } = useGetNotificationsLocal(
    profileKey,
    targetRole,
  );
  const checkAndCreate = useCheckAndCreateNotificationsLocal(profileKey);
  const checkAndCreateRef = useRef(checkAndCreate);
  checkAndCreateRef.current = checkAndCreate;

  // Trigger backend notification scan on mount and every 5 minutes
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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  function handleNavigate(path: string) {
    onClose();
    onNavigate?.(path);
  }

  // Group notifications by type
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
      n.notification_type === "NewProfileRegistered" ||
      n.notification_type === "profile_registered",
  );
  const others = notifications.filter(
    (n) =>
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
          - Title on the left, close button on the RIGHT in the same flex row
          - z-10 keeps it above scrollable content but does NOT overlap content action buttons
          - The close button is part of the header row, not a floating overlay
        */}
        <SheetHeader className="px-4 py-3 border-b border-border flex-shrink-0 sticky top-0 z-10 bg-card">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="flex items-center gap-2 text-base font-semibold">
              <Bell className="w-4 h-4 text-primary" />
              Notifications
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
            {/* Close button: RIGHT side of header row, never floating over content */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0"
              onClick={onClose}
              aria-label="Close notifications"
              data-ocid="notifications.close_button"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Scrollable content — independent of the sticky header */}
        <ScrollArea className="flex-1 overflow-auto">
          {isLoading ? (
            <div
              className="flex flex-col items-center justify-center py-12 gap-2"
              data-ocid="notifications.loading_state"
            >
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm text-muted-foreground">Loading…</p>
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
                No pending notifications right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
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

/** Bell icon trigger with unread badge — rendered in the header */
export function NotificationsBellButton({
  onClick,
  unreadCount,
}: {
  onClick: () => void;
  unreadCount: number;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 relative"
      onClick={onClick}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
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
