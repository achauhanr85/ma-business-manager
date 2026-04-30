/*
 * PAGE: StageInventoryPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Staging area for returned items pending Admin review. When a return order
 *   is created with "Usable" items, they land here before going back to main
 *   inventory. Admin accepts (→ main inventory) or rejects (→ discarded).
 *
 * ROLE ACCESS:
 *   admin, staff — both can VIEW items; only admin/superAdmin can Accept/Reject
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ profileKey from ProfileContext (userProfile.profile_key or profile.profile_key)
 *      ├─ isAdminOrSuperAdmin: boolean — determines whether action buttons are shown
 *      └─ useGetStagedInventory(profileKey) → loads staged items list
 *   2. Staged items rendering
 *      ├─ Loading → skeleton rows
 *      ├─ Empty → "No items staged for review" empty state
 *      └─ Data → table: Product, Batch #, Qty, Return Order #, Staged Date, Status
 *           ├─ Status badge: Pending Review / Accepted / Rejected
 *           └─ Actions (Admin only): Accept button + Reject button
 *   3. Accept staged item (Admin only)
 *      ├─ "Accept" button on a Pending row
 *      ├─ useReviewStagedItem.mutateAsync({ batchId, action: "accept", reviewedBy })
 *      │    └─ backend: moves item from stage → main inventory at correct warehouse
 *      └─ success → toast + list refetches + inventory levels refetch
 *   4. Reject staged item (Admin only)
 *      ├─ "Reject" button on a Pending row
 *      ├─ useReviewStagedItem.mutateAsync({ batchId, action: "reject", reviewedBy })
 *      │    └─ backend: marks item as rejected (not moved to inventory)
 *      └─ success → toast + list refetches
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - profileKey: string                        // from userProfile or profile
 *   - isAdminOrSuperAdmin: boolean              // role check for action buttons
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   none
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - handleAccept: calls useReviewStagedItem with action="accept"
 *   - handleReject: calls useReviewStagedItem with action="reject"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/ProfileContext";
import { useGetStagedInventory, useReviewStagedItem } from "@/hooks/useBackend";
import type { StagedInventoryItem } from "@/hooks/useBackend";
import { UserRole } from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface StageInventoryPageProps {
  onNavigate: (path: string) => void;
}

function formatDate(ts: bigint): string {
  if (!ts || ts === BigInt(0)) return "—";
  const ms = Number(ts / BigInt(1_000_000));
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return (
      <Badge className="bg-primary/10 text-primary border-primary/30 capitalize">
        Accepted
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge className="bg-destructive/10 text-destructive border-destructive/30 capitalize">
        Rejected
      </Badge>
    );
  return (
    <Badge className="bg-accent/20 text-accent-foreground border-accent/40 capitalize">
      Pending Review
    </Badge>
  );
}

export function StageInventoryPage({
  onNavigate: _onNavigate,
}: StageInventoryPageProps) {
  const { userProfile, profile } = useProfile();
  const profileKey = userProfile?.profile_key ?? profile?.profile_key ?? "";
  // BUG-08: Both Admin and Staff can access Stage Inventory and view items.
  // Only Admin/SuperAdmin has the Accept/Reject action buttons.
  const isAdminOrSuperAdmin =
    userProfile?.role === UserRole.admin ||
    userProfile?.role === UserRole.superAdmin;
  const reviewerName = userProfile?.display_name ?? "Unknown";

  const {
    data: stagedItems = [],
    isLoading,
    error,
  } = useGetStagedInventory(profileKey || null);
  const reviewMutation = useReviewStagedItem();

  async function handleReview(
    item: StagedInventoryItem,
    action: "accept" | "reject",
  ) {
    try {
      await reviewMutation.mutateAsync({
        batchId: item.batch_id,
        action,
        reviewedBy: reviewerName,
      });
      toast.success(
        action === "accept"
          ? `"${item.product_name}" accepted — moved to main inventory`
          : `"${item.product_name}" rejected and archived`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      toast.error(msg);
    }
  }

  const pendingItems = stagedItems.filter((i) => i.status === "pending");
  const reviewedItems = stagedItems.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6" data-ocid="stage_inventory.page">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            Stage Inventory
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review returned items before restocking to main inventory
          </p>
        </div>
        {pendingItems.length > 0 && (
          <Badge className="bg-accent/20 text-accent-foreground border-accent/40 text-sm px-3 py-1">
            {pendingItems.length} pending review
          </Badge>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5"
          data-ocid="stage_inventory.error_state"
        >
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">
            Failed to load stage inventory. Please refresh.
          </p>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3" data-ocid="stage_inventory.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}

      {/* Pending items */}
      {!isLoading && !error && (
        <>
          <Card
            className="card-elevated"
            data-ocid="stage_inventory.pending.panel"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Pending Review
                {pendingItems.length > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {pendingItems.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingItems.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-3 py-10 text-muted-foreground"
                  data-ocid="stage_inventory.pending.empty_state"
                >
                  <CheckCircle2 className="w-10 h-10 opacity-30" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      No items pending review
                    </p>
                    <p className="text-xs mt-0.5">
                      Returned items awaiting review will appear here
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingItems.map((item, idx) => (
                    <div
                      key={item.batch_id.toString()}
                      className="rounded-lg border border-border bg-card p-4"
                      data-ocid={`stage_inventory.pending.item.${idx + 1}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {item.product_name}
                          </p>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="text-xs text-muted-foreground">
                              Qty:{" "}
                              <span className="font-medium text-foreground">
                                {item.quantity.toString()}
                              </span>
                            </span>
                            {item.batch_no && (
                              <span className="text-xs text-muted-foreground">
                                Batch:{" "}
                                <span className="font-medium text-foreground">
                                  {item.batch_no}
                                </span>
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Return Order:{" "}
                              <span className="font-medium text-foreground">
                                #{item.return_order_id.toString()}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Staged:{" "}
                              <span className="font-medium text-foreground">
                                {formatDate(item.date_staged)}
                              </span>
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      {/* Admin-only action buttons */}
                      {isAdminOrSuperAdmin && (
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
                            onClick={() => handleReview(item, "accept")}
                            disabled={reviewMutation.isPending}
                            data-ocid={`stage_inventory.accept_button.${idx + 1}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Accept — Restock
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/5"
                            onClick={() => handleReview(item, "reject")}
                            disabled={reviewMutation.isPending}
                            data-ocid={`stage_inventory.reject_button.${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Reject — Archive
                          </Button>
                        </div>
                      )}

                      {!isAdminOrSuperAdmin && (
                        <p className="mt-2 text-xs text-muted-foreground italic">
                          Awaiting Admin review
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reviewed items */}
          {reviewedItems.length > 0 && (
            <Card
              className="card-elevated"
              data-ocid="stage_inventory.reviewed.panel"
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4" />
                  Previously Reviewed
                  <Badge variant="secondary" className="text-xs ml-1">
                    {reviewedItems.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {reviewedItems.map((item, idx) => (
                    <div
                      key={item.batch_id.toString()}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3"
                      data-ocid={`stage_inventory.reviewed.item.${idx + 1}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Qty: {item.quantity.toString()} · Return #
                          {item.return_order_id.toString()} ·{" "}
                          {formatDate(item.date_staged)}
                        </p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
