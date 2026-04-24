import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useCreatePurchaseOrder,
  useGetProducts,
  useGetPurchaseOrders,
  useMarkPurchaseOrderReceived,
} from "@/hooks/useBackend";
import type { PurchaseOrder, PurchaseOrderItemInput } from "@/types";
import { POStatus } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createActor } from "../backend";

interface PurchaseOrdersPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

interface DraftItem {
  uid: string;
  product_id: string;
  quantity: string;
  unit_cost: string;
}

function newDraftItem(): DraftItem {
  return {
    uid: crypto.randomUUID(),
    product_id: "",
    quantity: "",
    unit_cost: "",
  };
}

function POStatusBadge({ status }: { status: POStatus }) {
  if (status === POStatus.Received) {
    return (
      <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
        Received
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="bg-muted text-muted-foreground border-border hover:bg-muted/80"
    >
      Pending
    </Badge>
  );
}

function formatDate(ts: bigint): string {
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Hook to fetch PO items for a specific PO id
function useGetPOItems(poId: bigint) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery({
    queryKey: ["po-items", poId.toString()],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPurchaseOrderItems(poId);
    },
    enabled: !!actor && !isFetching,
  });
}

function POItemsExpander({
  poId,
  getProductName,
}: {
  poId: bigint;
  getProductName: (id: bigint) => string;
}) {
  const { data, isLoading } = useGetPOItems(poId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 rounded-md" />
        <Skeleton className="h-8 rounded-md" />
      </div>
    );
  }

  const items = data ?? [];

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">No items found.</p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm min-w-[360px]">
        <thead>
          <tr className="text-muted-foreground text-xs border-b border-border">
            <th className="text-left pb-2 font-medium">Product</th>
            <th className="text-right pb-2 font-medium">Qty</th>
            <th className="text-right pb-2 font-medium">Unit Cost</th>
            <th className="text-right pb-2 font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={`${item.po_id}-${item.product_id}`}
              className="border-b border-border/50 last:border-0"
            >
              <td className="py-2 pr-4 font-medium text-foreground truncate max-w-[160px]">
                {getProductName(item.product_id)}
              </td>
              <td className="py-2 text-right text-muted-foreground">
                {Number(item.quantity)}
              </td>
              <td className="py-2 text-right text-muted-foreground">
                ₹{item.unit_cost.toFixed(2)}
              </td>
              <td className="py-2 text-right font-semibold text-foreground">
                ₹{(item.unit_cost * Number(item.quantity)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PORowProps {
  po: PurchaseOrder;
  index: number;
  onMarkReceived: (id: bigint) => void;
  isReceiving: boolean;
}

function PORow({ po, index, onMarkReceived, isReceiving }: PORowProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: products } = useGetProducts();

  const getProductName = (productId: bigint) =>
    products?.find((p) => p.id === productId)?.name ?? `#${productId}`;

  return (
    <div
      className="border border-border rounded-xl overflow-hidden bg-card"
      data-ocid={`purchase_orders.item.${index}`}
    >
      {/* Header row — clickable */}
      <button
        type="button"
        className="w-full flex items-start sm:items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <ShoppingCart className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground truncate">{po.vendor}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(po.timestamp)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <POStatusBadge status={po.status} />
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 pb-4 pt-3 space-y-3">
          <POItemsExpander poId={po.id} getProductName={getProductName} />
          {po.status === POStatus.Pending && (
            <Button
              type="button"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => onMarkReceived(po.id)}
              disabled={isReceiving}
              data-ocid={`purchase_orders.mark_received_button.${index}`}
            >
              {isReceiving ? "Marking…" : "Mark as Received"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create PO Dialog ────────────────────────────────────────────────────────

interface CreatePODialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function CreatePODialog({ open, onOpenChange }: CreatePODialogProps) {
  const { data: products } = useGetProducts();
  const createPO = useCreatePurchaseOrder();

  const [vendor, setVendor] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setVendor("");
    setItems([newDraftItem()]);
    setErrors({});
  };

  const addItem = () => {
    setItems((prev) => [...prev, newDraftItem()]);
  };

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((item) => item.uid !== uid));
  };

  const updateItem = (uid: string, field: keyof DraftItem, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.uid === uid ? { ...item, [field]: value } : item,
      ),
    );
    // clear individual error
    const errKey = `${uid}-${field}`;
    if (errors[errKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        next[errKey] = "";
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!vendor.trim()) newErrors.vendor = "Vendor name is required";
    if (items.length === 0) newErrors.items = "At least one item is required";
    for (const item of items) {
      if (!item.product_id) newErrors[`${item.uid}-product_id`] = "Required";
      if (!item.quantity || Number(item.quantity) <= 0)
        newErrors[`${item.uid}-quantity`] = "Required";
      if (!item.unit_cost || Number(item.unit_cost) <= 0)
        newErrors[`${item.uid}-unit_cost`] = "Required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const poItems: PurchaseOrderItemInput[] = items.map((item) => ({
      product_id: BigInt(item.product_id),
      quantity: BigInt(Math.round(Number(item.quantity))),
      unit_cost: Number(item.unit_cost),
    }));

    try {
      await createPO.mutateAsync({
        vendor: vendor.trim(),
        items: poItems,
        warehouse_name: "Main Warehouse",
      });
      toast.success("Purchase order created successfully!");
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Failed to create purchase order. Please try again.");
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        data-ocid="purchase_orders.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Create Purchase Order
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Vendor */}
          <div className="space-y-1.5">
            <Label htmlFor="po-vendor">Vendor *</Label>
            <Input
              id="po-vendor"
              placeholder="e.g. Nature's Herbs Supplier"
              value={vendor}
              onChange={(e) => {
                setVendor(e.target.value);
                if (errors.vendor)
                  setErrors((prev) => ({ ...prev, vendor: "" }));
              }}
              data-ocid="purchase_orders.vendor_input"
            />
            {errors.vendor && (
              <p
                className="text-xs text-destructive"
                data-ocid="purchase_orders.vendor_input.field_error"
              >
                {errors.vendor}
              </p>
            )}
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items *</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="gap-1.5"
                data-ocid="purchase_orders.add_item_button"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Row
              </Button>
            </div>

            {errors.items && (
              <p className="text-xs text-destructive">{errors.items}</p>
            )}

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.uid}
                  className="relative border border-border rounded-lg p-3 bg-muted/30 space-y-3"
                  data-ocid={`purchase_orders.po_item.${idx + 1}`}
                >
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.uid)}
                      className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Remove item"
                      data-ocid={`purchase_orders.remove_item_button.${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <p className="text-xs font-medium text-muted-foreground">
                    Item {idx + 1}
                  </p>

                  {/* Product select */}
                  <div className="space-y-1">
                    <Label
                      htmlFor={`po-product-${item.uid}`}
                      className="text-xs"
                    >
                      Product
                    </Label>
                    <Select
                      value={item.product_id}
                      onValueChange={(v) =>
                        updateItem(item.uid, "product_id", v)
                      }
                    >
                      <SelectTrigger
                        id={`po-product-${item.uid}`}
                        data-ocid={`purchase_orders.product_select.${idx + 1}`}
                        className={
                          errors[`${item.uid}-product_id`]
                            ? "border-destructive"
                            : ""
                        }
                      >
                        <SelectValue placeholder="Select product…" />
                      </SelectTrigger>
                      <SelectContent>
                        {(products ?? []).map((p) => (
                          <SelectItem
                            key={p.id.toString()}
                            value={p.id.toString()}
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground ml-1.5 text-xs">
                              {p.sku}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[`${item.uid}-product_id`] && (
                      <p
                        className="text-xs text-destructive"
                        data-ocid={`purchase_orders.product_select.${idx + 1}.field_error`}
                      >
                        {errors[`${item.uid}-product_id`]}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Quantity */}
                    <div className="space-y-1">
                      <Label htmlFor={`po-qty-${item.uid}`} className="text-xs">
                        Quantity
                      </Label>
                      <Input
                        id={`po-qty-${item.uid}`}
                        type="number"
                        min="1"
                        step="1"
                        placeholder="0"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.uid, "quantity", e.target.value)
                        }
                        data-ocid={`purchase_orders.quantity_input.${idx + 1}`}
                        className={
                          errors[`${item.uid}-quantity`]
                            ? "border-destructive"
                            : ""
                        }
                      />
                      {errors[`${item.uid}-quantity`] && (
                        <p
                          className="text-xs text-destructive"
                          data-ocid={`purchase_orders.quantity_input.${idx + 1}.field_error`}
                        >
                          {errors[`${item.uid}-quantity`]}
                        </p>
                      )}
                    </div>

                    {/* Unit cost */}
                    <div className="space-y-1">
                      <Label
                        htmlFor={`po-cost-${item.uid}`}
                        className="text-xs"
                      >
                        Unit Cost (₹)
                      </Label>
                      <Input
                        id={`po-cost-${item.uid}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                        value={item.unit_cost}
                        onChange={(e) =>
                          updateItem(item.uid, "unit_cost", e.target.value)
                        }
                        data-ocid={`purchase_orders.unit_cost_input.${idx + 1}`}
                        className={
                          errors[`${item.uid}-unit_cost`]
                            ? "border-destructive"
                            : ""
                        }
                      />
                      {errors[`${item.uid}-unit_cost`] && (
                        <p
                          className="text-xs text-destructive"
                          data-ocid={`purchase_orders.unit_cost_input.${idx + 1}.field_error`}
                        >
                          {errors[`${item.uid}-unit_cost`]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            data-ocid="purchase_orders.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={createPO.isPending}
            data-ocid="purchase_orders.submit_button"
          >
            {createPO.isPending ? "Creating…" : "Confirm Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function PurchaseOrdersPage({
  onNavigate: _onNavigate,
}: PurchaseOrdersPageProps) {
  const { data: orders, isLoading } = useGetPurchaseOrders();
  const markReceived = useMarkPurchaseOrderReceived();
  const [dialogOpen, setDialogOpen] = useState(false);

  const sortedOrders = [...(orders ?? [])].sort((a, b) =>
    Number(b.timestamp - a.timestamp),
  );

  const handleMarkReceived = async (id: bigint) => {
    try {
      await markReceived.mutateAsync(id);
      toast.success("Purchase order marked as received. Inventory updated.");
    } catch {
      toast.error("Failed to mark order as received.");
    }
  };

  const pendingCount = sortedOrders.filter(
    (o) => o.status === POStatus.Pending,
  ).length;

  return (
    <div className="space-y-5" data-ocid="purchase_orders.page">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            Purchase Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendingCount > 0
              ? `${pendingCount} pending order${pendingCount > 1 ? "s" : ""}`
              : "All orders up to date"}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="gap-2 flex-shrink-0"
          data-ocid="purchase_orders.create_button"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Order</span>
          <span className="sm:hidden">New</span>
        </Button>
      </div>

      {/* Summary cards */}
      {!isLoading && sortedOrders.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3 border-border bg-card">
            <p className="text-xs text-muted-foreground">Total Orders</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">
              {sortedOrders.length}
            </p>
          </Card>
          <Card className="p-3 border-border bg-card">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-muted-foreground mt-0.5">
              {pendingCount}
            </p>
          </Card>
        </div>
      )}

      {/* Order list */}
      {isLoading ? (
        <div className="space-y-3" data-ocid="purchase_orders.loading_state">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : sortedOrders.length === 0 ? (
        <Card
          className="border-dashed bg-card"
          data-ocid="purchase_orders.empty_state"
        >
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Package className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="text-lg font-display mb-2">
              No purchase orders yet
            </CardTitle>
            <p className="text-sm text-muted-foreground max-w-xs mb-6">
              Create your first purchase order to start tracking incoming stock
              and updating inventory batches.
            </p>
            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="gap-2"
              data-ocid="purchase_orders.empty_create_button"
            >
              <Plus className="w-4 h-4" />
              Create First Order
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3" data-ocid="purchase_orders.list">
          {sortedOrders.map((po, idx) => (
            <PORow
              key={po.id.toString()}
              po={po}
              index={idx + 1}
              onMarkReceived={handleMarkReceived}
              isReceiving={
                markReceived.isPending && markReceived.variables === po.id
              }
            />
          ))}
        </div>
      )}

      <CreatePODialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
