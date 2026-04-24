import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useGetCategories,
  useGetInventoryBatches,
  useGetInventoryLevels,
  useGetProducts,
} from "@/hooks/useBackend";
import type {
  Category,
  InventoryBatchPublic,
  InventoryLevel,
  Product,
} from "@/types";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Package,
  Search,
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

function BatchDetailsRow({ productId }: { productId: bigint }) {
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

  if (batches.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={7}
          className="bg-muted/30 py-3 text-center text-muted-foreground text-sm"
        >
          No batches found
        </TableCell>
      </TableRow>
    );
  }

  const sorted = [...batches].sort((a, b) =>
    Number(a.date_received - b.date_received),
  );

  return (
    <TableRow>
      <TableCell colSpan={7} className="p-0 bg-muted/20">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" />
            FIFO Batch Details (oldest first)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[380px]">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-1.5 pr-4 font-medium">Batch #</th>
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
                    className="border-b border-border/40 last:border-0"
                    data-ocid={`inventory.batch.${idx + 1}`}
                  >
                    <td className="py-1.5 pr-4 text-muted-foreground">
                      #{(idx + 1).toString().padStart(2, "0")}
                      {idx === 0 && (
                        <span className="ml-1.5 text-xs text-primary font-medium">
                          (next)
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-4">
                      {formatDate(batch.date_received)}
                    </td>
                    <td className="py-1.5 pr-4 text-right tabular-nums">
                      {Number(batch.quantity_remaining).toLocaleString("en-IN")}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatCurrency(batch.unit_cost)}
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
}

function ProductRow({ product, level, categoryName, index }: ProductRowProps) {
  const [expanded, setExpanded] = useState(false);
  const totalQty = level?.total_qty ?? 0n;
  const oldestBatch = level?.batches
    ? [...level.batches].sort((a, b) =>
        Number(a.date_received - b.date_received),
      )[0]
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
          {Number(totalQty).toLocaleString("en-IN")}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm whitespace-nowrap hidden md:table-cell">
          {oldestBatch ? formatCurrency(oldestBatch.unit_cost) : "—"}
        </TableCell>
        <TableCell className="text-right">
          <StockStatusBadge qty={totalQty} />
        </TableCell>
      </TableRow>
      {expanded && <BatchDetailsRow productId={product.id} />}
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

export function InventoryPage({ onNavigate: _onNavigate }: InventoryPageProps) {
  const [search, setSearch] = useState("");
  const { data: levels = [], isLoading: levelsLoading } =
    useGetInventoryLevels();
  const { data: products = [], isLoading: productsLoading } = useGetProducts();
  const { data: categories = [], isLoading: categoriesLoading } =
    useGetCategories();

  const isLoading = levelsLoading || productsLoading || categoriesLoading;

  const categoryMap = useMemo(() => {
    const m = new Map<bigint, string>();
    for (const c of categories) m.set(c.id, c.name);
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
      const oldestBatch = [...level.batches].sort((a, b) =>
        Number(a.date_received - b.date_received),
      )[0];
      if (!oldestBatch) return sum;
      return sum + oldestBatch.unit_cost * Number(level.total_qty);
    }, 0);
  }, [levels]);

  const lowStockCount = useMemo(
    () =>
      levels.filter(
        (l: InventoryLevel) =>
          Number(l.total_qty) < LOW_STOCK_THRESHOLD && Number(l.total_qty) > 0,
      ).length,
    [levels],
  );

  const outOfStockCount = useMemo(
    () =>
      levels.filter((l: InventoryLevel) => Number(l.total_qty) === 0).length,
    [levels],
  );

  if (isLoading) return <InventorySkeleton />;

  return (
    <div className="space-y-4" data-ocid="inventory.page">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Warehouse className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Total Inventory Value
              </p>
              <p className="text-xl font-bold font-display text-foreground tabular-nums truncate">
                {formatCurrency(totalInventoryValue)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Low Stock Alerts</p>
              <p className="text-xl font-bold font-display text-destructive tabular-nums">
                {lowStockCount}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  products
                </span>
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardContent className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Out of Stock</p>
              <p className="text-xl font-bold font-display text-foreground tabular-nums">
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

      {/* Main table card */}
      <Card className="border-border bg-card" data-ocid="inventory.table">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center gap-2">
          <CardTitle className="text-base font-semibold flex-1">
            All Products
          </CardTitle>
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
                {search ? "No products match your search" : "No products yet"}
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
                    <TableHead className="font-semibold">SKU</TableHead>
                    <TableHead className="hidden sm:table-cell font-semibold">
                      Category
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      Stock
                    </TableHead>
                    <TableHead className="text-right font-semibold hidden md:table-cell">
                      Unit Cost
                    </TableHead>
                    <TableHead className="text-right font-semibold">
                      Status
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
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
