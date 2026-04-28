import { HelpPanel } from "@/components/HelpPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useAddLoanerBatch,
  useArchiveLoanedBatch,
  useGetInventoryLevels,
  useGetInventoryMovements,
  useGetProducts,
  useMoveLoanerToStaff,
  useReturnToSource,
} from "@/hooks/useBackend";
import type { InventoryBatchPublic, InventoryMovement } from "@/types";
import { UserRole } from "@/types";
import {
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  Info,
  Package,
  Plus,
  RotateCcw,
  Tag,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface LoanerInventoryPageProps {
  onNavigate: (path: string) => void;
}

function formatDate(timestamp: bigint) {
  const ms = Number(timestamp / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateShort(timestamp: bigint) {
  const ms = Number(timestamp / 1_000_000n);
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface LoanedBatchRow extends InventoryBatchPublic {
  productName: string;
}

export function LoanerInventoryPage({ onNavigate }: LoanerInventoryPageProps) {
  const { userProfile, profile } = useProfile();
  const { data: inventoryLevels, isLoading } = useGetInventoryLevels();
  const { data: products } = useGetProducts();
  const { data: movements = [] } = useGetInventoryMovements();
  const addLoanerBatch = useAddLoanerBatch();
  const moveLoanerToStaff = useMoveLoanerToStaff();
  const returnToSource = useReturnToSource();
  const archiveLoanedBatch = useArchiveLoanedBatch();

  const [showAddForm, setShowAddForm] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    productId: "",
    quantity: "",
    unitCost: "",
    loanedSource: "",
  });

  const role = userProfile?.role;
  const isAdmin = role === UserRole.admin;
  const isStaff = role === UserRole.staff;
  const canManage = isAdmin || isStaff;

  // Collect all loaned batches from inventory levels
  const loanedBatches = useMemo<LoanedBatchRow[]>(() => {
    return (inventoryLevels ?? []).flatMap((level) => {
      const product = (products ?? []).find((p) => p.id === level.product_id);
      return level.batches
        .filter((b) => b.is_loaned)
        .map((b) => ({
          ...b,
          productName: product?.name ?? `Product #${level.product_id}`,
        }));
    });
  }, [inventoryLevels, products]);

  const activeBatches = loanedBatches.filter(
    (b) => b.loaned_status !== "archived",
  );
  const archivedBatches = loanedBatches.filter(
    (b) => b.loaned_status === "archived",
  );

  // Total loaned units (active only)
  const totalLoanedUnits = activeBatches.reduce(
    (sum, b) => sum + Number(b.quantity_remaining),
    0,
  );

  // Loaner-related movements (is_loaned_move = true)
  const loanerMovements = useMemo(() => {
    return (movements as InventoryMovement[])
      .filter((m) => m.is_loaned_move)
      .sort((a, b) => Number(b.moved_at - a.moved_at))
      .slice(0, 20);
  }, [movements]);

  // Product name lookup
  const productNameMap = useMemo(() => {
    const m = new Map<bigint, string>();
    for (const p of products ?? []) m.set(p.id, p.name);
    return m;
  }, [products]);

  const handleAddLoaner = async () => {
    if (!addForm.productId || !addForm.quantity) {
      toast.error("Product and quantity are required");
      return;
    }
    try {
      await addLoanerBatch.mutateAsync({
        productId: BigInt(addForm.productId),
        quantity: BigInt(addForm.quantity),
        unitCost: Number.parseFloat(addForm.unitCost) || 0,
        loanedSource: addForm.loanedSource,
      });
      toast.success("Loaner batch added successfully");
      setShowAddForm(false);
      setAddForm({
        productId: "",
        quantity: "",
        unitCost: "",
        loanedSource: "",
      });
    } catch {
      toast.error("Failed to add loaner batch");
    }
  };

  const handleMoveToStaff = async (batch: LoanedBatchRow) => {
    const warehouseName =
      userProfile?.warehouse_name || profile?.business_name || "";
    if (!warehouseName) {
      toast.error("No warehouse assigned to your account");
      return;
    }
    try {
      await moveLoanerToStaff.mutateAsync({
        productId: batch.product_id,
        quantity: batch.quantity_remaining,
        toWarehouse: warehouseName,
      });
      toast.success(`Moved ${batch.productName} to ${warehouseName}`);
    } catch {
      toast.error("Failed to move stock to staff inventory");
    }
  };

  const handleReturn = async (batch: LoanedBatchRow) => {
    try {
      await returnToSource.mutateAsync({
        batchId: batch.id,
        quantity: batch.quantity_remaining,
      });
      toast.success(`Returned ${batch.productName} to source`);
    } catch {
      toast.error("Failed to return stock to source");
    }
  };

  const handleArchive = async (batch: LoanedBatchRow) => {
    try {
      await archiveLoanedBatch.mutateAsync(batch.id);
      toast.success(`${batch.productName} archived`);
    } catch {
      toast.error("Failed to archive batch");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4" data-ocid="loaner_inventory.loading_state">
        {[1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5" data-ocid="loaner_inventory.page">
      {/* Page header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 -ml-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => onNavigate("/inventory")}
              aria-label="Back to Inventory"
              data-ocid="loaner_inventory.back_button"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-display font-bold text-foreground">
              Loaner / Friend Inventory
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 ml-8">
            Track third-party borrowed stock — excluded from COGS &amp; main
            inventory valuation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setHelpOpen(true)}
            aria-label="Help"
            data-ocid="loaner_inventory.help_button"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          {canManage && (
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              size="sm"
              className="btn-theme gap-1.5"
              data-ocid="loaner_inventory.add_button"
            >
              <Plus className="h-3.5 w-3.5" />
              Receive Loaner Stock
            </Button>
          )}
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-amber-50/60 border-amber-200">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <Tag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-amber-600/80">Active Loaned</p>
              <p className="text-lg font-bold tabular-nums text-amber-700">
                {totalLoanedUnits}
                <span className="text-xs font-normal text-amber-600 ml-1">
                  units
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Active Batches</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {activeBatches.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Archive className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Archived</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {archivedBatches.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Movements</p>
              <p className="text-lg font-bold tabular-nums text-foreground">
                {loanerMovements.length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* COGS exclusion notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 text-sm text-amber-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Loaned stock is excluded from COGS</strong> and does not
          affect your main inventory valuation. Items loaned from a friend are
          tracked separately until returned or sold.
        </span>
      </div>

      {/* Receive Loaner Stock form */}
      {showAddForm && canManage && (
        <Card
          className="border-amber-200 bg-amber-50/30"
          data-ocid="loaner_inventory.add_form"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="h-4 w-4 text-amber-600" />
              Receive Loaner Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="loaner-product">Product *</Label>
                <select
                  id="loaner-product"
                  value={addForm.productId}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, productId: e.target.value }))
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  data-ocid="loaner_inventory.product_select"
                >
                  <option value="">Select product…</option>
                  {(products ?? []).map((p) => (
                    <option key={p.id.toString()} value={p.id.toString()}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loaner-source">Loaned From *</Label>
                <Input
                  id="loaner-source"
                  type="text"
                  value={addForm.loanedSource}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, loanedSource: e.target.value }))
                  }
                  placeholder="e.g. John's items, Friend ABC"
                  data-ocid="loaner_inventory.loaned_source_input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loaner-qty">Quantity *</Label>
                <Input
                  id="loaner-qty"
                  type="number"
                  min="1"
                  value={addForm.quantity}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, quantity: e.target.value }))
                  }
                  placeholder="0"
                  data-ocid="loaner_inventory.quantity_input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loaner-cost">
                  Unit Cost{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    (for reference only)
                  </span>
                </Label>
                <Input
                  id="loaner-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={addForm.unitCost}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, unitCost: e.target.value }))
                  }
                  placeholder="0.00"
                  data-ocid="loaner_inventory.unit_cost_input"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddLoaner}
                className="btn-theme"
                disabled={addLoanerBatch.isPending}
                data-ocid="loaner_inventory.submit_button"
              >
                {addLoanerBatch.isPending ? "Adding…" : "Add Loaner Batch"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAddForm(false)}
                data-ocid="loaner_inventory.cancel_button"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Loaner Stock table */}
      <Card className="border-border" data-ocid="loaner_inventory.table">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-amber-600" />
            Current Loaner Stock
            {activeBatches.length > 0 && (
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 bg-amber-50"
              >
                {activeBatches.length} active
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeBatches.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-14 gap-3 px-4 text-center"
              data-ocid="loaner_inventory.empty_state"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                <Package className="h-6 w-6 text-amber-500" />
              </div>
              <p className="text-sm font-medium text-foreground">
                No active loaner batches
              </p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Receive loaner stock from a friend or third party to start
                tracking it without affecting your main inventory.
              </p>
              {canManage && (
                <Button
                  size="sm"
                  className="btn-theme gap-1.5 mt-1"
                  onClick={() => setShowAddForm(true)}
                  data-ocid="loaner_inventory.empty_add_button"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Receive Loaner Stock
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Source</TableHead>
                    <TableHead className="text-right font-semibold">
                      Qty
                    </TableHead>
                    <TableHead className="font-semibold hidden md:table-cell">
                      Warehouse
                    </TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">
                      Date Received
                    </TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="text-right font-semibold">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeBatches.map((batch, idx) => (
                    <TableRow
                      key={batch.id.toString()}
                      className="hover:bg-amber-50/40 transition-colors"
                      data-ocid={`loaner_inventory.item.${idx + 1}`}
                    >
                      <TableCell className="font-medium min-w-[140px]">
                        <span className="line-clamp-2">
                          {batch.productName}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground min-w-[100px]">
                        {batch.loaned_source || (
                          <span className="italic opacity-60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {Number(batch.quantity_remaining).toLocaleString(
                          "en-IN",
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                        <span className="flex items-center gap-1">
                          <Warehouse className="w-3.5 h-3.5" />
                          {batch.warehouse_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {formatDate(batch.date_received)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-amber-300 text-amber-700 bg-amber-50 text-xs"
                        >
                          <Tag className="w-2.5 h-2.5 mr-1" />
                          Loaned
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Move to Staff Inventory */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMoveToStaff(batch)}
                            disabled={moveLoanerToStaff.isPending}
                            className="h-7 text-xs gap-1 px-2"
                            title="Move to your staff inventory for sale"
                            data-ocid={`loaner_inventory.move_button.${idx + 1}`}
                          >
                            <ArrowRight className="h-3 w-3" />
                            Move to Staff
                          </Button>
                          {/* Return to Source — Admin only */}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReturn(batch)}
                              disabled={returnToSource.isPending}
                              className="h-7 text-xs gap-1 px-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                              title="Return this stock to the original source"
                              data-ocid={`loaner_inventory.return_button.${idx + 1}`}
                            >
                              <RotateCcw className="h-3 w-3" />
                              Return
                            </Button>
                          )}
                          {/* Archive — Admin only */}
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchive(batch)}
                              disabled={archiveLoanedBatch.isPending}
                              className="h-7 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground"
                              title="Archive this batch after physical return to friend"
                              data-ocid={`loaner_inventory.archive_button.${idx + 1}`}
                            >
                              <Archive className="h-3 w-3" />
                              Archive
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archived batches (collapsed by default) */}
      {archivedBatches.length > 0 && (
        <ArchivedSection batches={archivedBatches} />
      )}

      {/* Movement History */}
      <Card
        className="border-border"
        data-ocid="loaner_inventory.movements_section"
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            Loaner Movement History
            {loanerMovements.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {loanerMovements.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loanerMovements.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 gap-2 text-center"
              data-ocid="loaner_inventory.movements_empty_state"
            >
              <ArrowRight className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No loaner movements recorded yet
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[500px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">From</TableHead>
                    <TableHead className="font-semibold">To</TableHead>
                    <TableHead className="text-right font-semibold">
                      Qty
                    </TableHead>
                    <TableHead className="font-semibold hidden sm:table-cell">
                      Date
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loanerMovements.map((mv, idx) => (
                    <TableRow
                      key={mv.id.toString()}
                      data-ocid={`loaner_inventory.movement.${idx + 1}`}
                    >
                      <TableCell className="font-medium text-sm">
                        {productNameMap.get(mv.product_id) ??
                          `#${mv.product_id}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {mv.from_warehouse}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {mv.to_warehouse}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {Number(mv.quantity).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                        {formatDateShort(mv.moved_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works info panel */}
      <Card className="border-border bg-muted/20">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            How Loaner Inventory Works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: <Tag className="w-4 h-4 text-amber-600" />,
                title: "1. Receive Stock",
                desc: "Log borrowed items into the Loaner Inventory. They're tracked separately and excluded from COGS.",
              },
              {
                icon: <ArrowRight className="w-4 h-4 text-primary" />,
                title: "2. Move to Staff",
                desc: "Transfer loaned items to your Staff Inventory when ready to sell. Items retain the Loaned tag.",
              },
              {
                icon: <CheckCircle className="w-4 h-4 text-green-600" />,
                title: "3. Return or Archive",
                desc: "When returned to the owner, use Return to Source. After physical return, Admin can Archive the record.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="flex gap-2.5 items-start p-2.5 rounded-lg bg-background border border-border"
              >
                <div className="mt-0.5 shrink-0">{step.icon}</div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {step.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPage="inventory"
      />
    </div>
  );
}

// ─── Archived Section (collapsible) ──────────────────────────────────────────

function ArchivedSection({ batches }: { batches: LoanedBatchRow[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-border opacity-70">
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
        data-ocid="loaner_inventory.archived_section.toggle"
      >
        <CardTitle className="text-sm flex items-center justify-between gap-2 text-muted-foreground">
          <span className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Archived Batches ({batches.length})
          </span>
          <span className="text-xs">{expanded ? "Hide" : "Show"}</span>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Product</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="text-right font-semibold">
                    Qty
                  </TableHead>
                  <TableHead className="hidden sm:table-cell font-semibold">
                    Warehouse
                  </TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch, idx) => (
                  <TableRow
                    key={batch.id.toString()}
                    className="opacity-60"
                    data-ocid={`loaner_inventory.archived.${idx + 1}`}
                  >
                    <TableCell className="text-sm font-medium">
                      {batch.productName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {batch.loaned_source || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {Number(batch.quantity_remaining).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                      {batch.warehouse_name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground"
                      >
                        Archived
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
