import { HelpPanel } from "@/components/HelpPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  useGetCategories,
  useGetDashboardStats,
  useGetInventoryBatches,
  useGetInventoryLevels,
  useGetProducts,
} from "@/hooks/useBackend";
import { useTranslation } from "@/translations";
import type {
  Category,
  InventoryBatchPublic,
  InventoryLevel,
  Product,
} from "@/types";
import { UserRole } from "@/types";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  Package,
  Search,
  Tag,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";

interface InventoryPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

const LOW_STOCK_THRESHOLD = 10;

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(timestamp: bigint) {
  const ms = Number(timestamp / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStockStatus(
  qty: bigint,
): "in-stock" | "low-stock" | "out-of-stock" {
  const n = Number(qty);
  if (n === 0) return "out-of-stock";
  if (n < LOW_STOCK_THRESHOLD) return "low-stock";
  return "in-stock";
}

function StockStatusBadge({ qty }: { qty: bigint }) {
  const status = getStockStatus(qty);
  if (status === "out-of-stock")
    return (
      <Badge variant="destructive" className="text-xs whitespace-nowrap">
        Out of Stock
      </Badge>
    );
  if (status === "low-stock")
    return (
      <Badge
        variant="destructive"
        className="text-xs whitespace-nowrap bg-destructive/15 text-destructive border-destructive/30"
      >
        <AlertTriangle className="w-3 h-3 mr-1" />
        Low Stock
      </Badge>
    );
  return (
    <Badge
      variant="secondary"
      className="text-xs whitespace-nowrap bg-primary/10 text-primary border-primary/20"
    >
      In Stock
    </Badge>
  );
}

/** Amber "Loaned" badge shown on batches from Friend/Loaner Inventory */
function LoanedBadge({ source }: { source?: string }) {
  return (
    <span
      title={
        source ? `Loaned from: ${source}` : "Loaned item — excluded from COGS"
      }
      className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 text-[10px] font-semibold cursor-default"
    >
      <Tag className="w-2.5 h-2.5" />
      Loaned
      {source && (
        <span className="hidden sm:inline ml-0.5 opacity-80">· {source}</span>
      )}
    </span>
  );
}

function BatchDetailsRow({
  productId,
  warehouseFilter,
}: {
  productId: bigint;
  warehouseFilter: string;
}) {
  const { data: batches = [], isLoading } = useGetInventoryBatches(productId);

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="bg-muted/30 py-3">
          <div className="space-y-1.5 pl-4">
            <Skeleton className="h-4 w-full max-w-md" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </div>
        </TableCell>
      </TableRow>
    );
  }

  const filtered =
    warehouseFilter && warehouseFilter !== "all"
      ? batches.filter((b) => b.warehouse_name === warehouseFilter)
      : batches;

  if (filtered.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={7}
          className="bg-muted/30 py-3 text-center text-muted-foreground text-sm"
        >
          No batches found
          {warehouseFilter !== "all" ? ` in ${warehouseFilter}` : ""}
        </TableCell>
      </TableRow>
    );
  }

  const sorted = [...filtered].sort((a, b) =>
    Number(a.date_received - b.date_received),
  );

  const hasLoanedBatches = sorted.some((b) => b.is_loaned);

  return (
    <TableRow>
      <TableCell colSpan={7} className="p-0 bg-muted/20">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              FIFO Batch Details (oldest first)
            </p>
            {hasLoanedBatches && (
              <span
                title="Loaned batches are excluded from inventory valuation (COGS)"
                className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 cursor-default"
              >
                <Info className="w-2.5 h-2.5" />
                Loaned stock excluded from COGS
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[440px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 pr-4 font-medium">Batch #</th>
                  <th className="text-left py-1.5 pr-4 font-medium">
                    Warehouse
                  </th>
                  <th className="text-left py-1.5 pr-4 font-medium">
                    Date Received
                  </th>
                  <th className="text-right py-1.5 pr-4 font-medium">
                    Qty Remaining
                  </th>
                  <th className="text-right py-1.5 font-medium">Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((batch: InventoryBatchPublic, idx: number) => (
                  <tr
                    key={batch.id.toString()}
                    className={`border-b border-border/40 last:border-0 ${batch.is_loaned ? "bg-amber-50/60" : ""}`}
                    data-ocid={`inventory.batch.${idx + 1}`}
                  >
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      <span className="flex items-center gap-1.5 flex-wrap">
                        #{(idx + 1).toString().padStart(2, "0")}
                        {idx === 0 && !batch.is_loaned && (
                          <span className="text-xs text-primary font-medium">
                            (next)
                          </span>
                        )}
                        {batch.is_loaned && (
                          <LoanedBadge source={batch.loaned_source} />
                        )}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Warehouse className="w-3 h-3" />
                        {batch.warehouse_name}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4">
                      {formatDate(batch.date_received)}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      {Number(batch.quantity_remaining).toLocaleString("en-IN")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {batch.is_loaned ? (
                        <span className="text-muted-foreground text-xs italic">
                          excl. COGS
                        </span>
                      ) : (
                        formatCurrency(batch.unit_cost)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface ProductRowProps {
  product: Product;
  level: InventoryLevel | undefined;
  categoryName: string;
  index: number;
  warehouseFilter: string;
}

function ProductRow({
  product,
  level,
  categoryName,
  index,
  warehouseFilter,
}: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);

  const totalQty = useMemo(() => {
    if (!level) return 0n;
    if (!warehouseFilter || warehouseFilter === "all") return level.total_qty;
    return level.batches
      .filter((b) => b.warehouse_name === warehouseFilter && !b.is_loaned)
      .reduce((sum, b) => sum + b.quantity_remaining, 0n);
  }, [level, warehouseFilter]);

  const loanedCount = useMemo(() => {
    if (!level) return 0n;
    const batchFilter =
      warehouseFilter && warehouseFilter !== "all"
        ? level.batches.filter((b) => b.warehouse_name === warehouseFilter)
        : level.batches;
    return batchFilter
      .filter((b) => b.is_loaned)
      .reduce((sum, b) => sum + b.quantity_remaining, 0n);
  }, [level, warehouseFilter]);

  const oldestBatch = level?.batches
    ? [...level.batches]
        .filter(
          (b) =>
            !b.is_loaned &&
            (!warehouseFilter ||
              warehouseFilter === "all" ||
              b.warehouse_name === warehouseFilter),
        )
        .sort((a, b) => Number(a.date_received - b.date_received))[0]
    : undefined;

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/30 transition-colors group"
        onClick={() => setExpanded((v) => !v)}
        data-ocid={`inventory.item.${index}`}
      >
        <TableCell className="w-8 pr-0">
          <span className="text-muted-foreground">
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4 group-hover:text-primary transition-colors" />
            )}
          </span>
        </TableCell>
        <TableCell className="font-medium min-w-[140px]">
          <span className="line-clamp-2">{product.name}</span>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm font-mono whitespace-nowrap">
          {product.sku}
        </TableCell>
        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground whitespace-nowrap">
          {categoryName}
        </TableCell>
        <TableCell className="text-right tabular-nums font-semibold whitespace-nowrap">
          <span>{Number(totalQty).toLocaleString("en-IN")}</span>
          {loanedCount > 0n && (
            <span
              className="ml-1.5 text-[10px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 cursor-default"
              title={`${loanedCount} units on loan (not counted in stock or COGS)`}
            >
              +{Number(loanedCount)} loaned
            </span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm whitespace-nowrap hidden md:table-cell">
          {oldestBatch ? formatCurrency(oldestBatch.unit_cost) : "—"}
        </TableCell>
        <TableCell className="text-right">
          <StockStatusBadge qty={totalQty} />
        </TableCell>
      </TableRow>
      {expanded && (
        <BatchDetailsRow
          productId={product.id}
          warehouseFilter={warehouseFilter}
        />
      )}
    </>
  );
}

function InventorySkeleton() {
  return (
    <div className="space-y-4" data-ocid="inventory.loading_state">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full mb-4" />
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function InventoryPage({ onNavigate }: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const { userProfile } = useProfile();
  const t = useTranslation();

  const { data: rawLevels = [], isLoading: levelsLoading } =
    useGetInventoryLevels();
  const { data: products = [], isLoading: productsLoading } = useGetProducts();
  const { data: categories = [], isLoading: categoriesLoading } =
    useGetCategories();

  // BUG-10: Use getDashboardStats for the authoritative out-of-stock count
  const { data: dashboardStats } = useGetDashboardStats();

  const isLoading = levelsLoading || productsLoading || categoriesLoading;

  const role = userProfile?.role;
  const isStaff = role === UserRole.staff;
  const isAdmin = role === UserRole.admin;
  const userWarehouse = userProfile?.warehouse_name ?? "";

  const allWarehouses = useMemo(() => {
    const set = new Set<string>();
    for (const l of rawLevels) {
      for (const b of l.batches) {
        if (b.warehouse_name) set.add(b.warehouse_name);
      }
    }
    return Array.from(set).sort();
  }, [rawLevels]);

  const effectiveWarehouse = isStaff ? userWarehouse : selectedWarehouse;

  const levels = useMemo<InventoryLevel[]>(() => {
    if (isStaff && userWarehouse) {
      return rawLevels
        .map((level: InventoryLevel) => {
          const filteredBatches = level.batches.filter(
            (b) => b.warehouse_name === userWarehouse,
          );
          const filteredQty = filteredBatches
            .filter((b) => !b.is_loaned)
            .reduce((sum, b) => sum + b.quantity_remaining, 0n);
          return { ...level, batches: filteredBatches, total_qty: filteredQty };
        })
        .filter((level: InventoryLevel) => level.batches.length > 0);
    }
    if (isAdmin && effectiveWarehouse && effectiveWarehouse !== "all") {
      return rawLevels
        .map((level: InventoryLevel) => {
          const filteredBatches = level.batches.filter(
            (b) => b.warehouse_name === effectiveWarehouse,
          );
          const filteredQty = filteredBatches
            .filter((b) => !b.is_loaned)
            .reduce((sum, b) => sum + b.quantity_remaining, 0n);
          return { ...level, batches: filteredBatches, total_qty: filteredQty };
        })
        .filter((level: InventoryLevel) => level.batches.length > 0);
    }
    return rawLevels;
  }, [rawLevels, isStaff, isAdmin, userWarehouse, effectiveWarehouse]);

  const categoryMap = useMemo(() => {
    const m = new Map<bigint, string>();
    for (const c of categories as Category[]) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const levelMap = useMemo(() => {
    const m = new Map<bigint, InventoryLevel>();
    for (const l of levels) m.set(l.product_id, l);
    return m;
  }, [levels]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p: Product) => {
      const catName = categoryMap.get(p.category_id) ?? "";
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        catName.toLowerCase().includes(q)
      );
    });
  }, [products, search, categoryMap]);

  const totalInventoryValue = useMemo(() => {
    return levels.reduce((sum: number, level: InventoryLevel) => {
      const regularBatches = level.batches.filter((b) => !b.is_loaned);
      const oldestBatch = [...regularBatches].sort((a, b) =>
        Number(a.date_received - b.date_received),
      )[0];
      if (!oldestBatch) return sum;
      return sum + oldestBatch.unit_cost * Number(level.total_qty);
    }, 0);
  }, [levels]);

  const totalLoanedUnits = useMemo(() => {
    return rawLevels.reduce((sum: number, level: InventoryLevel) => {
      return (
        sum +
        level.batches
          .filter((b) => b.is_loaned)
          .reduce((s, b) => s + Number(b.quantity_remaining), 0)
      );
    }, 0);
  }, [rawLevels]);

  const lowStockCount = useMemo(
    () =>
      levels.filter(
        (l: InventoryLevel) =>
          Number(l.total_qty) < LOW_STOCK_THRESHOLD && Number(l.total_qty) > 0,
      ).length,
    [levels],
  );

  // BUG-10 FIX: Use backend's authoritative out-of-stock count from getDashboardStats.
  // Falls back to computing from levels if dashboard stats not loaded yet.
  const outOfStockCount = useMemo(() => {
    if (dashboardStats?.out_of_stock_count !== undefined) {
      return Number(dashboardStats.out_of_stock_count);
    }
    return levels.filter((l: InventoryLevel) => Number(l.total_qty) === 0)
      .length;
  }, [levels, dashboardStats]);

  if (isLoading) return <InventorySkeleton />;

  return (
    <div className="space-y-4" data-ocid="inventory.page">
      {/* Page header with help */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-display font-semibold text-foreground sr-only">
          {t.inventory.title}
        </h1>
        <div className="flex items-center gap-2 ml-auto">
          {totalLoanedUnits > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate("/loaner-inventory")}
              className="h-8 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              data-ocid="inventory.loaner_nav_button"
            >
              <Tag className="w-3.5 h-3.5" />
              {totalLoanedUnits} Loaned Items
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setHelpOpen(true)}
            aria-label="Help"
            data-ocid="inventory.help_button"
          >
            <HelpCircle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {t.inventory.totalValue}
                {effectiveWarehouse !== "all" && (
                  <span className="ml-1 text-primary">
                    · {effectiveWarehouse}
                  </span>
                )}
                <span
                  className="ml-1 inline-flex items-center cursor-default"
                  title="Loaned items are excluded from this valuation"
                >
                  <Info className="w-3 h-3 text-muted-foreground/60" />
                </span>
              </p>
              <p className="text-xl font-bold font-display text-foreground tabular-nums truncate">
                {formatCurrency(totalInventoryValue)}
              </p>
              {totalLoanedUnits > 0 && (
                <p className="text-[10px] text-amber-600 mt-0.5">
                  +{totalLoanedUnits} loaned units excluded
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                {t.inventory.lowStock}
              </p>
              <p className="text-xl font-bold font-display text-destructive tabular-nums">
                {lowStockCount}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  products
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* BUG-10 FIX: Out of Stock card now uses authoritative backend count */}
        <Card
          className={`border-border bg-card ${outOfStockCount > 0 ? "border-destructive/40" : ""}`}
          data-ocid="inventory.out_of_stock_card"
        >
          <CardContent className="p-4 flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                outOfStockCount > 0 ? "bg-destructive/15" : "bg-muted"
              }`}
            >
              <Package
                className={`w-4 h-4 ${outOfStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Out of Stock</p>
              <p
                className={`text-xl font-bold font-display tabular-nums ${
                  outOfStockCount > 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {outOfStockCount}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  products
                </span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2.5 text-sm text-destructive"
          data-ocid="inventory.low_stock_alert"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{lowStockCount}</strong> product
            {lowStockCount > 1 ? "s are" : " is"} running low (below{" "}
            {LOW_STOCK_THRESHOLD} units). Consider restocking.
          </span>
        </div>
      )}

      {/* Out of stock alert banner */}
      {outOfStockCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          data-ocid="inventory.out_of_stock_alert"
        >
          <Package className="w-4 h-4 shrink-0" />
          <span>
            <strong>{outOfStockCount}</strong> product
            {outOfStockCount > 1 ? "s are" : " is"} out of stock. Create a
            Purchase Order to restock.
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto shrink-0 h-6 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => onNavigate("/purchase-orders")}
            data-ocid="inventory.create_po_button"
          >
            Create PO
          </Button>
        </div>
      )}

      {/* Loaner inventory callout — always visible to Admin */}
      {(isAdmin || isStaff) && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2.5"
          data-ocid="inventory.loaner_callout"
        >
          <div className="flex items-center gap-2 text-sm text-amber-700">
            <Tag className="w-4 h-4 shrink-0" />
            <span>
              <strong>Friend/Loaner Inventory</strong> — Manage third-party
              borrowed stock without affecting COGS or inventory valuation.
              {totalLoanedUnits > 0 && (
                <span className="ml-1 font-medium">
                  {totalLoanedUnits} unit{totalLoanedUnits !== 1 ? "s" : ""}{" "}
                  currently on loan.
                </span>
              )}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate("/loaner-inventory")}
            className="shrink-0 text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100"
            data-ocid="inventory.go_loaner_button"
          >
            View Loaner Inventory
          </Button>
        </div>
      )}

      {/* Main table card */}
      <Card className="border-border bg-card" data-ocid="inventory.table">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CardTitle className="text-base font-semibold flex-1">
              {isStaff
                ? `${t.inventory.title} — ${userWarehouse}`
                : effectiveWarehouse === "all"
                  ? t.inventory.allWarehouses
                  : `${t.inventory.warehouse}: ${effectiveWarehouse}`}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Warehouse selector — Admin only */}
              {isAdmin && allWarehouses.length > 0 && (
                <Select
                  value={selectedWarehouse}
                  onValueChange={setSelectedWarehouse}
                >
                  <SelectTrigger
                    className="h-8 text-sm w-44"
                    data-ocid="inventory.warehouse_filter.select"
                  >
                    <Warehouse className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder={t.inventory.allWarehouses} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t.inventory.allWarehouses}
                    </SelectItem>
                    {allWarehouses.map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search name, SKU, category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-ocid="inventory.search_input"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 px-4 text-center"
              data-ocid="inventory.empty_state"
            >
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">
                {search
                  ? "No products match your search"
                  : t.inventory.noInventory}
              </p>
              <p className="text-sm text-muted-foreground">
                {search
                  ? "Try a different search term"
                  : "Add products to see your inventory here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-8 pr-0" />
                    <TableHead className="font-semibold">
                      Product Name
                    </TableHead>
                    <TableHead className="font-semibold">
                      {t.products.sku}
                    </TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold">
                      {t.products.category}
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      {t.inventory.quantity}
                    </TableHead>
                    <TableHead className="text-right font-semibold hidden md:table-cell">
                      {t.inventory.unitCost}
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      {t.common.status}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((product: Product, idx: number) => (
                    <ProductRow
                      key={product.id.toString()}
                      product={product}
                      level={levelMap.get(product.id)}
                      categoryName={
                        categoryMap.get(product.category_id) ?? "Uncategorized"
                      }
                      index={idx + 1}
                      warehouseFilter={effectiveWarehouse}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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
