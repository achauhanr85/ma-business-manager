/*
 * PAGE: InventoryMovementPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Allows Admin and Staff to move stock between warehouses. Also shows a
 *   read-only history of all past inventory movements for audit purposes.
 *
 * ROLE ACCESS:
 *   admin, staff (assigned warehouse only) — superAdmin when impersonating
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ userProfile from ProfileContext for role + warehouse checks
 *      ├─ useGetInventoryLevels() → source warehouse stock for movement
 *      ├─ useGetProducts() → product name lookup in movement form
 *      └─ useGetInventoryMovements() → history table
 *   2. Move stock form
 *      ├─ source warehouse: Staff sees only their assigned warehouse
 *      │                     Admin sees all warehouses
 *      ├─ destination warehouse: any warehouse in the profile
 *      ├─ product: dropdown filtered to products with stock in source warehouse
 *      ├─ quantity: validated against available stock (cannot exceed batch qty)
 *      ├─ useMoveInventory.mutateAsync(input)
 *      │    └─ backend: FIFO decrement from source + add to destination
 *      └─ success → toast + inventory levels refetch + movements refetch
 *   3. Staff restrictions
 *      ├─ Staff can only MOVE FROM the Main warehouse to their assigned warehouse
 *      └─ Staff CANNOT move between arbitrary warehouses
 *   4. Movement history table
 *      ├─ columns: date, product, from warehouse, to warehouse, qty, moved by
 *      └─ sorted by most recent first
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - fromWarehouse: string = ""       // source warehouse for movement
 *   - toWarehouse: string = ""         // destination warehouse
 *   - selectedProduct: string = ""     // product id for movement
 *   - moveQty: string = ""             // quantity to move (as string for input)
 *   - isMoving: boolean = false        // submission in progress
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   - Trigger: [userProfile]  →  Action: pre-fill fromWarehouse for Staff role
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - handleMoveStock: validates form, calls useMoveInventory mutation
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useGetInventoryLevels,
  useGetInventoryMovements,
  useGetProducts,
  useMoveInventory,
} from "@/hooks/useBackend";
import type { InventoryLevel, InventoryMovement, Product } from "@/types";
import { UserRole } from "@/types";
import {
  ArrowRightLeft,
  History,
  Loader2,
  MoveRight,
  PackageX,
  ShieldX,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface InventoryMovementPageProps {
  onNavigate: (path: string) => void;
}

function formatDate(timestamp: bigint) {
  const ms = Number(timestamp / 1_000_000n);
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function WarehouseBadge({ name }: { name: string }) {
  return (
    <span className="badge-location">
      <Warehouse className="w-3 h-3" />
      {name}
    </span>
  );
}

function MovementHistorySkeleton() {
  return (
    <div
      className="space-y-2 py-2"
      data-ocid="inventory_movement.history.loading_state"
    >
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function AccessDenied({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-24 gap-4"
      data-ocid="inventory_movement.access_denied"
    >
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldX className="w-8 h-8 text-destructive" />
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold text-foreground text-lg">Access Denied</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Inventory movement is only available to Admins and Staff.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => onNavigate("/dashboard")}
        data-ocid="inventory_movement.go_dashboard_button"
      >
        Go to Dashboard
      </Button>
    </div>
  );
}

interface TransferFormProps {
  products: Product[];
  levels: InventoryLevel[];
  userWarehouse: string;
  isStaff: boolean;
  isAdmin: boolean;
}

function TransferForm({
  products,
  levels,
  userWarehouse,
  isStaff,
  isAdmin,
}: TransferFormProps) {
  const MAIN_WAREHOUSE = "Main Warehouse";
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [fromWarehouse, setFromWarehouse] = useState<string>(
    isStaff ? MAIN_WAREHOUSE : "",
  );
  const [toWarehouse, setToWarehouse] = useState<string>(
    isStaff ? userWarehouse : "",
  );
  const [quantity, setQuantity] = useState<string>("");

  const moveInventory = useMoveInventory();

  const levelMap = useMemo(() => {
    const m = new Map<string, InventoryLevel>();
    for (const l of levels) m.set(l.product_id.toString(), l);
    return m;
  }, [levels]);

  const selectedLevel = selectedProductId
    ? levelMap.get(selectedProductId)
    : undefined;

  // Stock available in the selected source warehouse
  const availableQty = useMemo(() => {
    if (!selectedLevel || !fromWarehouse) return 0;
    return selectedLevel.batches
      .filter((b) => b.warehouse_name === fromWarehouse)
      .reduce((sum, b) => sum + Number(b.quantity_remaining), 0);
  }, [selectedLevel, fromWarehouse]);

  // All distinct warehouses from inventory
  const allWarehouses = useMemo(() => {
    const set = new Set<string>();
    for (const l of levels) {
      for (const b of l.batches) {
        if (b.warehouse_name) set.add(b.warehouse_name);
      }
    }
    return Array.from(set).sort();
  }, [levels]);

  // For staff: possible destination warehouses = all except fromWarehouse
  // (Staff can move to any warehouse they are associated with or shared warehouses)
  const staffDestinationOptions = useMemo(() => {
    return allWarehouses.filter((w) => w !== fromWarehouse);
  }, [allWarehouses, fromWarehouse]);

  // Products that have stock in the selected source warehouse
  const selectableProducts = useMemo(() => {
    if (!fromWarehouse) return products;
    return products.filter((p) => {
      const level = levelMap.get(p.id.toString());
      if (!level) return false;
      return level.batches.some(
        (b) =>
          b.warehouse_name === fromWarehouse &&
          Number(b.quantity_remaining) > 0,
      );
    });
  }, [products, levelMap, fromWarehouse]);

  const parsedQty = Number.parseInt(quantity, 10);
  const isValidQty =
    !Number.isNaN(parsedQty) && parsedQty > 0 && parsedQty <= availableQty;
  const isSameWarehouse =
    fromWarehouse.trim() !== "" &&
    toWarehouse.trim() !== "" &&
    fromWarehouse.trim().toLowerCase() === toWarehouse.trim().toLowerCase();

  const canSubmit =
    !!selectedProductId &&
    !!fromWarehouse.trim() &&
    !!toWarehouse.trim() &&
    isValidQty &&
    !isSameWarehouse &&
    !moveInventory.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const product = products.find((p) => p.id.toString() === selectedProductId);
    const result = await moveInventory.mutateAsync({
      product_id: BigInt(selectedProductId),
      from_warehouse: fromWarehouse.trim(),
      to_warehouse: toWarehouse.trim(),
      quantity: BigInt(parsedQty),
    });

    if (result !== null) {
      toast.success("Stock transferred successfully", {
        description: `Moved ${parsedQty} units of ${product?.name ?? "product"} from ${fromWarehouse} → ${toWarehouse}`,
      });
      setSelectedProductId("");
      setQuantity("");
      if (isAdmin) {
        setFromWarehouse("");
        setToWarehouse("");
      }
      // Staff: reset to default source/dest
      if (isStaff) {
        setFromWarehouse(MAIN_WAREHOUSE);
        setToWarehouse(userWarehouse);
      }
    } else {
      toast.error("Transfer failed", {
        description:
          "Insufficient stock or invalid transfer. Please check quantities.",
      });
    }
  };

  return (
    <Card
      className="border-border bg-card"
      data-ocid="inventory_movement.transfer_form"
    >
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <ArrowRightLeft className="w-3.5 h-3.5 text-primary" />
          </div>
          Transfer Stock
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* From / To row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* From Warehouse */}
            <div className="space-y-1.5">
              <Label htmlFor="from-warehouse" className="text-sm font-medium">
                From Warehouse
              </Label>
              {isStaff ? (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/50">
                  <Warehouse className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {MAIN_WAREHOUSE}
                  </span>
                  <Badge
                    variant="secondary"
                    className="ml-auto text-xs shrink-0"
                  >
                    Source
                  </Badge>
                </div>
              ) : (
                <Select
                  value={fromWarehouse}
                  onValueChange={(v) => {
                    setFromWarehouse(v);
                    setSelectedProductId("");
                    setToWarehouse("");
                  }}
                >
                  <SelectTrigger
                    id="from-warehouse"
                    data-ocid="inventory_movement.from_warehouse.select"
                  >
                    <SelectValue placeholder="Select source warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {allWarehouses.map((w) => (
                      <SelectItem key={w} value={w}>
                        {w}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* To Warehouse */}
            <div className="space-y-1.5">
              <Label htmlFor="to-warehouse" className="text-sm font-medium">
                To Warehouse
              </Label>
              {isStaff ? (
                // Staff can select any destination warehouse (shared inventory support)
                staffDestinationOptions.length > 1 ? (
                  <Select value={toWarehouse} onValueChange={setToWarehouse}>
                    <SelectTrigger
                      id="to-warehouse"
                      data-ocid="inventory_movement.to_warehouse.select"
                    >
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffDestinationOptions.map((w) => (
                        <SelectItem key={w} value={w}>
                          <span className="flex items-center gap-1.5">
                            {w}
                            {w === userWarehouse && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 h-4 ml-1"
                              >
                                Your warehouse
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/50">
                    <Warehouse className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">
                      {userWarehouse}
                    </span>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-xs shrink-0"
                    >
                      Your warehouse
                    </Badge>
                  </div>
                )
              ) : (
                // Admin: select from all warehouses (excluding source)
                <Select
                  value={toWarehouse}
                  onValueChange={setToWarehouse}
                  disabled={!fromWarehouse}
                >
                  <SelectTrigger
                    id="to-warehouse"
                    data-ocid="inventory_movement.to_warehouse.select"
                  >
                    <SelectValue
                      placeholder={
                        fromWarehouse
                          ? "Select destination warehouse"
                          : "Select source first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {allWarehouses
                      .filter((w) => w !== fromWarehouse)
                      .map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    {/* Allow entering a new warehouse name */}
                    <div className="px-2 py-1.5 border-t border-border mt-1">
                      <p className="text-xs text-muted-foreground mb-1">
                        Or type a new warehouse name:
                      </p>
                      <Input
                        placeholder="New warehouse name…"
                        value={
                          allWarehouses.includes(toWarehouse) ? "" : toWarehouse
                        }
                        onChange={(e) => setToWarehouse(e.target.value)}
                        className="h-7 text-xs"
                        data-ocid="inventory_movement.to_warehouse_new.input"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </SelectContent>
                </Select>
              )}
              {isSameWarehouse && (
                <p
                  className="text-xs text-destructive"
                  data-ocid="inventory_movement.same_warehouse.error_state"
                >
                  Source and destination must be different.
                </p>
              )}
            </div>
          </div>

          {/* Product select */}
          <div className="space-y-1.5">
            <Label htmlFor="product" className="text-sm font-medium">
              Product
            </Label>
            <Select
              value={selectedProductId}
              onValueChange={(v) => {
                setSelectedProductId(v);
                setQuantity("");
              }}
              disabled={!fromWarehouse}
            >
              <SelectTrigger
                id="product"
                data-ocid="inventory_movement.product.select"
              >
                <SelectValue
                  placeholder={
                    fromWarehouse
                      ? "Select product to transfer"
                      : "Select source warehouse first"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {selectableProducts.length === 0 ? (
                  <div className="py-3 px-4 text-sm text-muted-foreground text-center">
                    No stock available in {fromWarehouse}
                  </div>
                ) : (
                  selectableProducts.map((p) => {
                    const level = levelMap.get(p.id.toString());
                    const whQty = fromWarehouse
                      ? (level?.batches
                          .filter((b) => b.warehouse_name === fromWarehouse)
                          .reduce(
                            (s, b) => s + Number(b.quantity_remaining),
                            0,
                          ) ?? 0)
                      : Number(level?.total_qty ?? 0n);
                    return (
                      <SelectItem key={p.id.toString()} value={p.id.toString()}>
                        <span className="flex items-center gap-2">
                          {p.name}
                          <span className="text-xs text-muted-foreground">
                            ({whQty} available)
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity row with available info */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="quantity" className="text-sm font-medium">
                Quantity
              </Label>
              {selectedProductId && fromWarehouse && (
                <span className="text-xs text-muted-foreground">
                  Available in {fromWarehouse}:{" "}
                  <strong className="text-foreground">{availableQty}</strong>{" "}
                  units
                </span>
              )}
            </div>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={availableQty || undefined}
              placeholder="Enter quantity to move"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!selectedProductId}
              data-ocid="inventory_movement.quantity.input"
            />
            {quantity !== "" && !isValidQty && (
              <p
                className="text-xs text-destructive"
                data-ocid="inventory_movement.quantity.error_state"
              >
                {parsedQty <= 0
                  ? "Quantity must be greater than 0."
                  : `Cannot exceed available stock (${availableQty} units).`}
              </p>
            )}
          </div>

          {/* Transfer summary preview */}
          {canSubmit && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <WarehouseBadge name={fromWarehouse} />
              <MoveRight className="w-4 h-4 text-primary shrink-0" />
              <WarehouseBadge name={toWarehouse} />
              <span className="ml-auto font-semibold text-primary">
                {parsedQty} units
              </span>
            </div>
          )}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full"
            data-ocid="inventory_movement.transfer.submit_button"
          >
            {moveInventory.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferring…
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transfer Stock
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface MovementHistoryProps {
  movements: InventoryMovement[];
  productMap: Map<string, string>;
  isLoading: boolean;
}

function MovementHistory({
  movements,
  productMap,
  isLoading,
}: MovementHistoryProps) {
  return (
    <Card
      className="border-border bg-card"
      data-ocid="inventory_movement.history.card"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center">
            <History className="w-3.5 h-3.5 text-secondary-foreground" />
          </div>
          Movement History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="px-6 pb-4">
            <MovementHistorySkeleton />
          </div>
        ) : movements.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-14 px-4 text-center"
            data-ocid="inventory_movement.history.empty_state"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <PackageX className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">No movements yet</p>
            <p className="text-sm text-muted-foreground">
              Transfers between warehouses will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Product</TableHead>
                  <TableHead className="font-semibold">From</TableHead>
                  <TableHead className="font-semibold">To</TableHead>
                  <TableHead className="text-right font-semibold">
                    Qty
                  </TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">
                    Moved By
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m, idx) => (
                  <TableRow
                    key={m.id.toString()}
                    className="stagger-item hover:bg-muted/20 transition-colors"
                    style={{ animationDelay: `${idx * 0.05}s` }}
                    data-ocid={`inventory_movement.history.item.${idx + 1}`}
                  >
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDate(m.moved_at)}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {productMap.get(m.product_id.toString()) ??
                        `#${m.product_id}`}
                    </TableCell>
                    <TableCell>
                      <WarehouseBadge name={m.from_warehouse} />
                    </TableCell>
                    <TableCell>
                      <WarehouseBadge name={m.to_warehouse} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {Number(m.quantity).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground hidden md:table-cell font-mono truncate max-w-[120px]">
                      {m.moved_by.toString().slice(0, 12)}…
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function InventoryMovementPage({
  onNavigate,
}: InventoryMovementPageProps) {
  const { userProfile, isLoadingProfile } = useProfile();

  const { data: levels = [], isLoading: levelsLoading } =
    useGetInventoryLevels();
  const { data: products = [], isLoading: productsLoading } = useGetProducts();
  const { data: movements = [], isLoading: movementsLoading } =
    useGetInventoryMovements();

  const productMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) m.set(p.id.toString(), p.name);
    return m;
  }, [products]);

  const sortedMovements = useMemo(
    () => [...movements].sort((a, b) => Number(b.moved_at - a.moved_at)),
    [movements],
  );

  if (isLoadingProfile) {
    return (
      <div className="space-y-4" data-ocid="inventory_movement.loading_state">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const role = userProfile?.role;
  const isSuperAdmin = role === UserRole.superAdmin;
  const isAdmin = role === UserRole.admin;
  const isStaff = role === UserRole.staff;

  if (!userProfile || isSuperAdmin) {
    return <AccessDenied onNavigate={onNavigate} />;
  }

  const userWarehouse = userProfile.warehouse_name;
  const isDataLoading = levelsLoading || productsLoading;

  return (
    <div className="space-y-6" data-ocid="inventory_movement.page">
      {/* Page header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <ArrowRightLeft className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display font-semibold text-foreground">
            Inventory Movement
          </h1>
          <p className="text-sm text-muted-foreground">
            {isStaff
              ? `Transfer stock to your warehouse (${userWarehouse}) or shared locations`
              : "Transfer stock between warehouses and track movement history"}
          </p>
        </div>

        {/* Role badge */}
        <div className="ml-auto">
          {isStaff ? (
            <Badge
              variant="secondary"
              className="text-xs"
              data-ocid="inventory_movement.role_badge"
            >
              Staff
            </Badge>
          ) : isAdmin ? (
            <Badge
              variant="secondary"
              className="text-xs bg-primary/10 text-primary border-primary/20"
              data-ocid="inventory_movement.role_badge"
            >
              Admin
            </Badge>
          ) : null}
        </div>
      </div>

      {/* Transfer form */}
      {isDataLoading ? (
        <Card className="border-border bg-card">
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <TransferForm
          products={products}
          levels={levels}
          userWarehouse={userWarehouse}
          isStaff={isStaff}
          isAdmin={isAdmin}
        />
      )}

      {/* Movement history */}
      <MovementHistory
        movements={sortedMovements}
        productMap={productMap}
        isLoading={movementsLoading}
      />
    </div>
  );
}
