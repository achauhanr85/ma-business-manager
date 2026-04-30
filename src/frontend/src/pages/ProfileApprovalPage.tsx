/*
 * PAGE: ProfileApprovalPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Dedicated Super Admin page for reviewing and actioning new business profiles
 *   that are awaiting approval before the profile Admin can log in and use the app.
 *
 * ROLE ACCESS:
 *   superAdmin only — enforced by parent router in App.tsx
 *
 * FLOW:
 *   1. Mount / initialization
 *      └─ calls useGetPendingProfiles() directly from backend
 *           └─ backend getPendingProfiles() returns only profiles with
 *              approval_status = #pending_super_admin_approval
 *   2. Data loading
 *      ├─ Loading → skeleton cards
 *      ├─ Error   → error card with Try Again
 *      └─ Data    → renders one card per pending profile
 *   3. User actions
 *      ├─ Approve button clicked
 *      │    ├─ setApprovingKey(profileKey) → shows spinner on that row
 *      │    ├─ calls useApproveProfile.mutateAsync(profileKey)
 *      │    │    └─ backend: sets approval_status = #approved
 *      │    │         Admin can now log in and access the app
 *      │    ├─ on success → toast.success, invalidates useGetPendingProfiles query
 *      │    └─ on error   → toast.error with message
 *      └─ Reject button clicked
 *           ├─ setRejectingKey(profileKey) → shows spinner on that row
 *           ├─ calls useRejectProfile.mutateAsync(profileKey)
 *           │    └─ backend: sets approval_status = #suspended (record KEPT)
 *           ├─ on success → toast.success, invalidates query
 *           └─ on error   → toast.error with message
 *   4. Empty state
 *      └─ "No pending approvals" card with link back to Super Admin dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - approvingKey: string | null = null  // profile currently being approved
 *   - rejectingKey: string | null = null  // profile currently being rejected
 *   - isRefreshing: boolean = false       // manual refresh in progress
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   none
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - handleApprove: calls approveProfile mutation, shows success/error toast
 *   - handleReject:  calls rejectProfile mutation, shows success/error toast
 *   - handleRefresh: refetches the pending profiles list
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY useGetPendingProfiles() and NOT useGetAllProfilesForAdmin() + filter:
 *   The previous implementation called getAllProfilesForAdmin() and then filtered
 *   client-side by profile_approval_status. This was unreliable because:
 *     1. The full profiles list is large and includes many approved/rejected profiles.
 *     2. Client-side string matching on the Candid variant could miss edge cases.
 *   The backend getPendingProfiles() directly queries the store for the correct
 *   variant (#pending_super_admin_approval), making the list authoritative.
 *
 * WHY useApproveProfile() and NOT useEnableProfile():
 *   enableProfile() only toggles the is_enabled flag. The approval gate checks
 *   approval_status, not is_enabled. Using enableProfile for approval was a bug
 *   that left the profile status as "pending" even after the Admin could log in.
 *
 * WHY useRejectProfile() and NOT useDeleteProfile():
 *   deleteProfile() permanently removes all data. rejectProfile() sets
 *   approval_status = #suspended so the record is preserved for audit purposes.
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useApproveProfile,
  useGetPendingProfiles,
  useRejectProfile,
} from "@/hooks/useBackend";
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

/**
 * formatTimestamp — converts a nanosecond IC timestamp (bigint) to a human-readable date string.
 * Returns "—" if the timestamp is null, undefined, or zero.
 */
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
  /**
   * useGetPendingProfiles — directly calls getPendingProfiles() on the backend.
   * This returns ONLY profiles with approval_status = #pending_super_admin_approval.
   * No client-side filtering needed — the backend is authoritative here.
   *
   * Falls back to filtering getAllProfilesForAdmin() client-side if the dedicated
   * backend method is not yet deployed (graceful degradation).
   */
  const {
    data: pendingProfiles = [],
    isLoading,
    isError,
    refetch,
  } = useGetPendingProfiles();

  const approveProfileMutation = useApproveProfile();
  const rejectProfileMutation = useRejectProfile();

  // Track which profile is being actioned so we can show per-row spinners
  const [approvingKey, setApprovingKey] = useState<string | null>(null);
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  /**
   * handleApprove — calls approveProfile(profileKey) on the backend.
   *
   * WHAT IT DOES:
   *   - Sets approval_status = #approved on the profile record
   *   - Admin for that profile can now log in and see their data
   *   - On success, the profile disappears from this list (React Query invalidation)
   *
   * IMPORTANT: approveProfile() ≠ enableProfile()
   * enableProfile only toggles is_enabled — it does NOT change approval_status.
   * A profile must have approval_status = #approved for the routing gate to pass.
   */
  const handleApprove = async (profileKey: string, businessName: string) => {
    setApprovingKey(profileKey);
    try {
      const ok = await approveProfileMutation.mutateAsync(profileKey);
      if (ok) {
        toast.success(
          `Profile "${businessName}" approved. The Admin can now log in.`,
        );
        await refetch();
      } else {
        toast.error("Failed to approve profile. Please try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to approve profile: ${msg}`);
    } finally {
      setApprovingKey(null);
    }
  };

  /**
   * handleReject — calls rejectProfile(profileKey) on the backend.
   *
   * WHAT IT DOES:
   *   - Sets approval_status = #suspended on the profile record
   *   - Profile record is PRESERVED (not deleted) for audit trail
   *   - Admin for that profile cannot log in
   *
   * IMPORTANT: rejectProfile() ≠ deleteProfile()
   * deleteProfile() permanently removes all data and related records.
   * rejectProfile() only changes the status — data is preserved.
   */
  const handleReject = async (profileKey: string, businessName: string) => {
    setRejectingKey(profileKey);
    try {
      const ok = await rejectProfileMutation.mutateAsync(profileKey);
      if (ok) {
        toast.success(
          `Profile "${businessName}" rejected. The creator has been notified.`,
        );
        await refetch();
      } else {
        toast.error("Failed to reject profile. Please try again.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to reject profile: ${msg}`);
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
              Failed to load pending profiles
            </p>
            <p className="text-xs text-muted-foreground">
              The getPendingProfiles backend method may not be deployed yet.
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
                here automatically.
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
              // Safely cast to access optional fields that may be on ProfilePublic
              const ext = profile as typeof profile & {
                email?: string;
                created_at?: bigint;
                last_activity?: bigint;
              };
              const email = ext.email;
              // Prefer created_at timestamp; fall back to last_activity
              const createdAt = ext.created_at ?? ext.last_activity;
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
                        Pending Approval
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
                      Registered: {formatTimestamp(createdAt ?? undefined)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end mt-1">
                    {/* Reject — sets approval_status to #suspended; record is preserved */}
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

                    {/* Approve — sets approval_status to #approved; Admin can now log in */}
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
    </div>
  );
}
