/**
 * ProfileApprovalPage.tsx — Profile Approval management page for Super Admin.
 *
 * WHAT THIS FILE DOES:
 * Provides a dedicated page for the Super Admin to review all business profiles
 * that are pending approval (i.e. is_enabled === false). Each row shows the
 * business name, profile key, email, and creation date, with Approve / Reject
 * action buttons that call backend functions and refresh the list on success.
 *
 * HOW IT WORKS:
 *   1. Calls useGetAllProfilesForAdmin() to get all profiles
 *   2. Filters for profiles where is_enabled === false (pending)
 *   3. Approve → calls enableProfile(profileKey, true)
 *   4. Reject  → calls deleteProfile(profileKey) (removes the profile)
 *   5. List auto-refreshes after each action via React Query invalidation
 *
 * WHO USES THIS:
 *   App.tsx — rendered at ROUTES.profileApprovals
 *   SuperAdminPage.tsx — linked via "View All Approvals" button on the dashboard card
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteProfile,
  useEnableProfile,
  useGetAllProfilesForAdmin,
} from "@/hooks/useBackend";
import type { ProfileStatsExtended } from "@/types";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Mail,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProfileApprovalPageProps {
  onNavigate: (path: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(ts: bigint | null | undefined): string {
  if (!ts || ts === 0n) return "—";
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ProfileApprovalPage({ onNavigate }: ProfileApprovalPageProps) {
  // Fetch all profiles from the backend — Super Admin sees all of them
  const {
    data: profiles = [],
    isLoading,
    isError,
    refetch,
  } = useGetAllProfilesForAdmin();

  const enableProfile = useEnableProfile();
  const deleteProfile = useDeleteProfile();

  // Track which profile is currently being actioned so we can show per-row spinners
  const [approvingKey, setApprovingKey] = useState<string | null>(null);
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter to only profiles that are pending approval (is_enabled === false)
  const pendingProfiles = profiles.filter((p) => {
    const ext = p as ProfileStatsExtended;
    return "is_enabled" in ext && !ext.is_enabled;
  });

  // Approve a profile — enables it so the Admin can log in and use the app
  const handleApprove = async (profileKey: string, businessName: string) => {
    setApprovingKey(profileKey);
    try {
      const ok = await enableProfile.mutateAsync({
        profileKey,
        enabled: true,
      });
      if (ok) {
        toast.success(`Profile "${businessName}" approved and activated.`);
      } else {
        toast.error("Failed to approve profile. Please try again.");
      }
    } catch {
      toast.error("Failed to approve profile.");
    } finally {
      setApprovingKey(null);
    }
  };

  // Reject a profile — permanently deletes it so the creator must reapply
  const handleReject = async (profileKey: string, businessName: string) => {
    setRejectingKey(profileKey);
    try {
      const ok = await deleteProfile.mutateAsync(profileKey);
      if (ok) {
        toast.success(
          `Profile "${businessName}" rejected and removed. The creator can create a new profile.`,
        );
      } else {
        toast.error("Failed to reject profile. Please try again.");
      }
    } catch {
      toast.error("Failed to reject profile.");
    } finally {
      setRejectingKey(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-5 pb-8" data-ocid="profile_approval.page">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-display font-semibold text-foreground">
              Profile Approvals
            </h1>
            <p className="text-sm text-muted-foreground">
              Review and approve or reject new business profiles awaiting access
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          className="flex items-center gap-1.5"
          data-ocid="profile_approval.refresh_button"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* ── Loading State ── */}
      {isLoading && (
        <div className="space-y-3" data-ocid="profile_approval.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* ── Error State ── */}
      {!isLoading && isError && (
        <Card
          className="border-destructive/30 bg-destructive/5"
          data-ocid="profile_approval.error_state"
        >
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertTriangle className="w-10 h-10 text-destructive/70" />
            <p className="text-sm font-medium text-destructive">
              Failed to load profiles
            </p>
            <p className="text-xs text-muted-foreground">
              Check your connection and try refreshing.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              data-ocid="profile_approval.retry_button"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Empty State (no pending approvals) ── */}
      {!isLoading && !isError && pendingProfiles.length === 0 && (
        <Card
          className="border-dashed bg-card"
          data-ocid="profile_approval.empty_state"
        >
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                No pending approvals
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                All profiles have been reviewed. New registrations will appear
                here.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("/super-admin")}
              data-ocid="profile_approval.go_dashboard_button"
            >
              Back to Super Admin
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Pending Profiles List ── */}
      {!isLoading && !isError && pendingProfiles.length > 0 && (
        <Card
          className="border-amber-300/50 bg-amber-50/20 dark:bg-amber-950/10 dark:border-amber-800/30"
          data-ocid="profile_approval.pending_list"
        >
          <CardHeader className="pb-3 border-b border-amber-200/50 dark:border-amber-800/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-base font-semibold text-foreground">
                Pending Profile Approvals
              </CardTitle>
              <Badge className="ml-auto text-xs bg-amber-500/15 text-amber-700 border-amber-400/30 dark:text-amber-400">
                {pendingProfiles.length} pending
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              These business profiles were recently created and are awaiting
              your approval before the Admin can access the app.
            </p>
          </CardHeader>

          <CardContent className="pt-4 space-y-3">
            {pendingProfiles.map((profile, idx) => {
              const ext = profile as ProfileStatsExtended;
              const email = (ext as { email?: string }).email;
              const isApproving = approvingKey === profile.profile_key;
              const isRejecting = rejectingKey === profile.profile_key;
              const isBusy = isApproving || isRejecting;

              return (
                <div
                  key={profile.profile_key}
                  className="flex items-start gap-3 p-4 rounded-lg border border-amber-200/60 bg-card dark:border-amber-800/30"
                  data-ocid={`profile_approval.item.${idx + 1}`}
                >
                  {/* Profile icon */}
                  <div className="w-10 h-10 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 className="w-5 h-5 text-amber-600" />
                  </div>

                  {/* Profile details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">
                        {profile.business_name}
                      </p>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 border-amber-400/30"
                      >
                        Pending
                      </Badge>
                    </div>

                    <p className="text-xs font-mono text-muted-foreground truncate">
                      Key: {profile.profile_key}
                    </p>

                    {email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span className="truncate">{email}</span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Registered:{" "}
                      {formatTimestamp(ext.last_activity ?? undefined)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end mt-1">
                    {/* Reject button — deletes the profile */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        handleReject(profile.profile_key, profile.business_name)
                      }
                      disabled={isBusy}
                      data-ocid={`profile_approval.reject_button.${idx + 1}`}
                    >
                      {isRejecting ? (
                        <span className="w-3 h-3 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      Reject
                    </Button>

                    {/* Approve button — enables the profile */}
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() =>
                        handleApprove(
                          profile.profile_key,
                          profile.business_name,
                        )
                      }
                      disabled={isBusy}
                      data-ocid={`profile_approval.approve_button.${idx + 1}`}
                    >
                      {isApproving ? (
                        <span className="w-3 h-3 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Approve
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── All profiles summary (approved) ── */}
      {!isLoading && !isError && profiles.length > 0 && (
        <div className="text-xs text-muted-foreground px-1">
          {profiles.length - pendingProfiles.length} active profiles ·{" "}
          {pendingProfiles.length} pending
        </div>
      )}
    </div>
  );
}
