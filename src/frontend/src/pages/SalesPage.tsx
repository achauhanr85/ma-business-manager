import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useCheckCustomerDuplicate,
  useCreateCustomer,
  useCreateSale,
  useGetCustomers,
  useGetInventoryLevels,
  useGetProducts,
} from "@/hooks/useBackend";
import type {
  CartItem,
  CustomerPublic,
  InventoryLevel,
  Product,
} from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

interface SalesPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

interface CartEntry {
  product: Product;
  quantity: number;
  salePrice: number;
}

function getStockForWarehouse(
  productId: bigint,
  levels: InventoryLevel[],
  warehouseName: string,
): bigint {
  const level = levels.find(
    (l) => l.product_id.toString() === productId.toString(),
  );
  if (!level) return BigInt(0);
  if (!warehouseName) return level.total_qty;
  const warehouseQty = level.batches
    .filter((b) => b.warehouse_name === warehouseName)
    .reduce((sum, b) => sum + b.quantity_remaining, BigInt(0));
  return warehouseQty;
}

// ─── Customer Selector ────────────────────────────────────────────────────────

function CustomerSelector({
  customers,
  selected,
  onSelect,
  onQuickAdd,
}: {
  customers: CustomerPublic[];
  selected: CustomerPublic | null;
  onSelect: (c: CustomerPublic | null) => void;
  onQuickAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers.slice(0, 10);
    const q = query.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (customer: CustomerPublic) => {
    onSelect(customer);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(null);
    setQuery("");
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm transition-smooth text-left ${
          selected
            ? "border-primary/50 bg-primary/5 text-foreground"
            : "border-input bg-background text-muted-foreground hover:border-primary/40"
        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        onClick={() => setOpen((v) => !v)}
        data-ocid="sales.customer_select"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <User
          className={`w-4 h-4 flex-shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
        />
        <span
          className={`flex-1 truncate ${selected ? "text-foreground font-medium" : ""}`}
        >
          {selected ? selected.name : "Select customer…"}
        </span>
        {selected ? (
          <button
            type="button"
            onClick={handleClear}
            className="text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Clear customer"
            data-ocid="sales.customer_clear_button"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm"
                placeholder="Search customers…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                data-ocid="sales.customer_search_input"
              />
            </div>
          </div>

          {/* Quick add button */}
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors border-b border-border"
            onClick={() => {
              setOpen(false);
              onQuickAdd();
            }}
            data-ocid="sales.customer_new_button"
          >
            <UserPlus className="w-4 h-4" />
            <span className="font-medium">+ New Customer</span>
          </button>

          {/* Customer list */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div
                className="py-6 text-center text-sm text-muted-foreground"
                data-ocid="sales.customer_list.empty_state"
              >
                No customers found
              </div>
            ) : (
              filtered.map((c, idx) => (
                <button
                  key={c.id.toString()}
                  type="button"
                  aria-pressed={selected?.id.toString() === c.id.toString()}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                    selected?.id.toString() === c.id.toString()
                      ? "bg-primary/5 text-primary"
                      : "text-foreground"
                  }`}
                  onClick={() => handleSelect(c)}
                  data-ocid={`sales.customer_list.item.${idx + 1}`}
                >
                  <span className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-xs font-semibold text-secondary-foreground uppercase">
                    {c.name.charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.phone && (
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    )}
                  </div>
                  {selected?.id.toString() === c.id.toString() && (
                    <CheckCircle2 className="w-4 h-4 text-primary ml-auto flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quick Add Customer Modal ─────────────────────────────────────────────────

function QuickAddCustomerModal({
  open,
  onClose,
  onCustomerCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: CustomerPublic) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [duplicateResult, setDuplicateResult] = useState<{
    similar: CustomerPublic[];
    checked: boolean;
  } | null>(null);
  const [pendingConfirmFor, setPendingConfirmFor] =
    useState<CustomerPublic | null>(null);

  const checkDuplicate = useCheckCustomerDuplicate();
  const createCustomer = useCreateCustomer();

  const reset = () => {
    setName("");
    setPhone("");
    setNameError("");
    setPhoneError("");
    setDuplicateResult(null);
    setPendingConfirmFor(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleNameBlur = async () => {
    if (!name.trim() || name.trim().length < 2) return;
    try {
      const result = await checkDuplicate.mutateAsync(name.trim());
      if (result.has_similar && result.similar_customers.length > 0) {
        setDuplicateResult({
          similar: result.similar_customers,
          checked: true,
        });
        setPendingConfirmFor(result.similar_customers[0]);
      } else {
        setDuplicateResult({ similar: [], checked: true });
        setPendingConfirmFor(null);
      }
    } catch {
      // silently ignore duplicate check errors
    }
  };

  const validate = () => {
    let valid = true;
    if (!name.trim()) {
      setNameError("Name is required");
      valid = false;
    } else {
      setNameError("");
    }
    if (!phone.trim()) {
      setPhoneError("Phone is required");
      valid = false;
    } else {
      setPhoneError("");
    }
    return valid;
  };

  const handleUseDuplicate = (customer: CustomerPublic) => {
    onCustomerCreated(customer);
    toast.success(`Selected existing customer: ${customer.name}`);
    handleClose();
  };

  const handleCreateNew = async () => {
    if (!validate()) return;
    setPendingConfirmFor(null);
    try {
      const newId = await createCustomer.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        email: "",
        address: "",
      });
      const newCustomer: CustomerPublic = {
        id: newId,
        name: name.trim(),
        phone: phone.trim(),
        email: "",
        address: "",
        profile_key: "",
        total_sales: BigInt(0),
        lifetime_revenue: 0,
        last_purchase_at: BigInt(0),
        created_at: BigInt(Date.now()),
      };
      toast.success(`Customer "${name.trim()}" created`);
      onCustomerCreated(newCustomer);
      handleClose();
    } catch {
      toast.error("Failed to create customer. Please try again.");
    }
  };

  const hasDuplicate =
    duplicateResult?.checked &&
    duplicateResult.similar.length > 0 &&
    pendingConfirmFor;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="sm:max-w-md"
        data-ocid="sales.quick_add_customer.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Add New Customer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Name field */}
          <div className="space-y-1.5">
            <Label htmlFor="qac-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qac-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDuplicateResult(null);
                setPendingConfirmFor(null);
              }}
              onBlur={handleNameBlur}
              placeholder="Customer full name"
              className={nameError ? "border-destructive" : ""}
              data-ocid="sales.quick_add_customer.name_input"
            />
            {nameError && (
              <p
                className="text-xs text-destructive"
                data-ocid="sales.quick_add_customer.name_field_error"
              >
                {nameError}
              </p>
            )}
            {checkDuplicate.isPending && (
              <p className="text-xs text-muted-foreground">
                Checking for duplicates…
              </p>
            )}
          </div>

          {/* Duplicate warning */}
          {hasDuplicate && pendingConfirmFor && (
            <div
              className="rounded-lg border border-accent bg-accent/10 p-3 space-y-2"
              data-ocid="sales.quick_add_customer.duplicate_warning"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-accent-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Found similar:{" "}
                    <span className="font-semibold">
                      {pendingConfirmFor.name}
                    </span>
                  </p>
                  {pendingConfirmFor.phone && (
                    <p className="text-xs text-muted-foreground">
                      {pendingConfirmFor.phone}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Same person?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-accent text-accent-foreground hover:bg-accent/20"
                  onClick={() => handleUseDuplicate(pendingConfirmFor)}
                  data-ocid="sales.quick_add_customer.duplicate_yes_button"
                >
                  Yes, use this customer
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    setPendingConfirmFor(null);
                    setDuplicateResult({ similar: [], checked: true });
                  }}
                  data-ocid="sales.quick_add_customer.duplicate_no_button"
                >
                  No, create new
                </Button>
              </div>
            </div>
          )}

          {/* Phone field */}
          <div className="space-y-1.5">
            <Label htmlFor="qac-phone">
              Phone <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qac-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number"
              type="tel"
              className={phoneError ? "border-destructive" : ""}
              data-ocid="sales.quick_add_customer.phone_input"
            />
            {phoneError && (
              <p
                className="text-xs text-destructive"
                data-ocid="sales.quick_add_customer.phone_field_error"
              >
                {phoneError}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              data-ocid="sales.quick_add_customer.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleCreateNew}
              disabled={createCustomer.isPending || !!pendingConfirmFor}
              data-ocid="sales.quick_add_customer.submit_button"
            >
              {createCustomer.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                "Save Customer"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Product Search Panel ─────────────────────────────────────────────────────

function ProductSearchPanel({
  products,
  inventoryLevels,
  warehouseName,
  onAddToCart,
  cartEntries,
}: {
  products: Product[];
  inventoryLevels: InventoryLevel[];
  warehouseName: string;
  onAddToCart: (product: Product) => void;
  cartEntries: CartEntry[];
}) {
  const [query, setQuery] = useState("");

  const warehouseProducts = useMemo(() => {
    return products.filter((p) => {
      const qty = getStockForWarehouse(p.id, inventoryLevels, warehouseName);
      return qty > BigInt(0);
    });
  }, [products, inventoryLevels, warehouseName]);

  const filtered = useMemo(() => {
    if (!query.trim()) return warehouseProducts.slice(0, 20);
    const q = query.toLowerCase();
    return warehouseProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [warehouseProducts, query]);

  const cartProductIds = new Set(
    cartEntries.map((e) => e.product.id.toString()),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-ocid="sales.search_input"
        />
        {query && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {warehouseName && (
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Package className="w-3 h-3" />
          Showing stock for{" "}
          <span className="font-medium text-foreground">{warehouseName}</span>
        </p>
      )}

      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {filtered.length === 0 && (
          <div
            className="text-center py-10 text-muted-foreground text-sm"
            data-ocid="sales.products.empty_state"
          >
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            {warehouseProducts.length === 0
              ? "No stock available in your warehouse"
              : "No products match your search"}
          </div>
        )}
        {filtered.map((product, idx) => {
          const stock = getStockForWarehouse(
            product.id,
            inventoryLevels,
            warehouseName,
          );
          const inCart = cartProductIds.has(product.id.toString());

          return (
            <button
              type="button"
              key={product.id.toString()}
              className={`w-full text-left rounded-lg border p-3 transition-smooth hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring stagger-item ${
                inCart
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              }`}
              style={{ animationDelay: `${idx * 0.04}s` }}
              onClick={() => onAddToCart(product)}
              data-ocid={`sales.product.item.${idx + 1}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {product.sku}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    ₹{product.mrp.toFixed(2)}
                  </p>
                  <Badge variant="secondary" className="text-xs mt-1">
                    {stock.toString()} units
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {product.volume_points} VP
                </span>
                {inCart && (
                  <Badge
                    variant="outline"
                    className="text-xs text-primary border-primary/40"
                  >
                    In cart
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({
  entries,
  selectedCustomer,
  onUpdateQty,
  onUpdatePrice,
  onRemove,
  onClear,
  onConfirm,
  isConfirming,
  inventoryLevels,
  warehouseName,
}: {
  entries: CartEntry[];
  selectedCustomer: CustomerPublic | null;
  onUpdateQty: (id: bigint, qty: number) => void;
  onUpdatePrice: (id: bigint, price: number) => void;
  onRemove: (id: bigint) => void;
  onClear: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  inventoryLevels: InventoryLevel[];
  warehouseName: string;
}) {
  const totalRevenue = entries.reduce(
    (sum, e) => sum + e.salePrice * e.quantity,
    0,
  );
  const totalVP = entries.reduce(
    (sum, e) => sum + e.product.volume_points * e.quantity,
    0,
  );
  const totalProfit = entries.reduce((sum, e) => {
    const level = inventoryLevels.find(
      (l) => l.product_id.toString() === e.product.id.toString(),
    );
    const avgCost =
      level && level.batches.length > 0
        ? level.batches[0].unit_cost
        : e.product.earn_base;
    return sum + (e.salePrice - avgCost) * e.quantity;
  }, 0);

  const canConfirm = entries.length > 0 && !!selectedCustomer && !isConfirming;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">
            Cart ({entries.length} items)
          </span>
        </div>
        {entries.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive text-xs h-7"
            data-ocid="sales.cart.clear_button"
          >
            Clear all
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground py-8"
          data-ocid="sales.cart.empty_state"
        >
          <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Cart is empty</p>
          <p className="text-xs mt-1">Search and click products to add them</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {entries.map((entry, idx) => {
              const qtyInputId = `cart-qty-${entry.product.id.toString()}`;
              const priceInputId = `cart-price-${entry.product.id.toString()}`;
              const maxQty = Number(
                getStockForWarehouse(
                  entry.product.id,
                  inventoryLevels,
                  warehouseName,
                ),
              );
              return (
                <div
                  key={entry.product.id.toString()}
                  className="rounded-lg border border-border bg-card p-3 space-y-2"
                  data-ocid={`sales.cart.item.${idx + 1}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.product.volume_points * entry.quantity} VP ·{" "}
                        <span className="text-primary">
                          ₹{(entry.salePrice * entry.quantity).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.product.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      aria-label="Remove item"
                      data-ocid={`sales.cart.delete_button.${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor={qtyInputId}
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        Qty
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() =>
                            onUpdateQty(
                              entry.product.id,
                              Math.max(1, entry.quantity - 1),
                            )
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <Input
                          id={qtyInputId}
                          type="number"
                          min={1}
                          max={maxQty}
                          value={entry.quantity}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value, 10);
                            if (!Number.isNaN(v) && v > 0)
                              onUpdateQty(entry.product.id, v);
                          }}
                          className="h-6 text-center text-xs w-12 px-1"
                          data-ocid={`sales.cart.qty_input.${idx + 1}`}
                        />
                        <button
                          type="button"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() =>
                            onUpdateQty(entry.product.id, entry.quantity + 1)
                          }
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={priceInputId}
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        Price (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          id={priceInputId}
                          type="number"
                          min={0}
                          step={0.01}
                          value={entry.salePrice}
                          onChange={(e) => {
                            const v = Number.parseFloat(e.target.value);
                            if (!Number.isNaN(v) && v >= 0)
                              onUpdatePrice(entry.product.id, v);
                          }}
                          className="h-6 text-xs pl-5"
                          data-ocid={`sales.cart.price_input.${idx + 1}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Customer banner */}
          {selectedCustomer ? (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Selling to</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {selectedCustomer.name}
                </p>
              </div>
            </div>
          ) : (
            <div
              className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20"
              data-ocid="sales.customer_required_warning"
            >
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">
                Select a customer to proceed
              </p>
            </div>
          )}

          {/* Totals */}
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-semibold text-foreground">
                ₹{totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Volume Points</span>
              <span className="font-semibold text-foreground">
                {totalVP} VP
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Profit</span>
              <span
                className={`font-semibold ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}
              >
                ₹{totalProfit.toFixed(2)}
              </span>
            </div>

            <Separator className="my-2" />

            <Button
              type="button"
              className="w-full"
              onClick={onConfirm}
              disabled={!canConfirm}
              title={!selectedCustomer ? "Select a customer first" : undefined}
              data-ocid="sales.confirm_button"
            >
              {isConfirming ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                `Confirm Sale · ₹${totalRevenue.toFixed(2)}`
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sales Page ───────────────────────────────────────────────────────────────

export function SalesPage({ onNavigate }: SalesPageProps) {
  const { userProfile } = useProfile();
  const warehouseName = userProfile?.warehouse_name ?? "";

  const { data: products = [], isLoading: loadingProducts } = useGetProducts();
  const { data: inventoryLevels = [], isLoading: loadingInventory } =
    useGetInventoryLevels();
  const { data: customers = [], isLoading: loadingCustomers } =
    useGetCustomers();
  const createSale = useCreateSale();

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerPublic | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find(
        (e) => e.product.id.toString() === product.id.toString(),
      );
      if (existing) return prev;
      return [...prev, { product, quantity: 1, salePrice: product.mrp }];
    });
  };

  const updateQty = (id: bigint, qty: number) => {
    const stock = getStockForWarehouse(id, inventoryLevels, warehouseName);
    const cappedQty = Math.min(qty, Number(stock));
    if (cappedQty <= 0) {
      toast.warning("Insufficient stock for that quantity");
      return;
    }
    setCart((prev) =>
      prev.map((e) =>
        e.product.id.toString() === id.toString()
          ? { ...e, quantity: cappedQty }
          : e,
      ),
    );
  };

  const updatePrice = (id: bigint, price: number) => {
    setCart((prev) =>
      prev.map((e) =>
        e.product.id.toString() === id.toString()
          ? { ...e, salePrice: price }
          : e,
      ),
    );
  };

  const removeFromCart = (id: bigint) => {
    setCart((prev) =>
      prev.filter((e) => e.product.id.toString() !== id.toString()),
    );
  };

  const clearCart = () => setCart([]);

  const confirmSale = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer before confirming the sale.");
      return;
    }
    for (const entry of cart) {
      const stock = getStockForWarehouse(
        entry.product.id,
        inventoryLevels,
        warehouseName,
      );
      if (BigInt(entry.quantity) > stock) {
        toast.error(
          `Insufficient stock for "${entry.product.name}". Only ${stock.toString()} units available.`,
        );
        return;
      }
    }

    const cartItems: CartItem[] = cart.map((e) => ({
      product_id: e.product.id,
      quantity: BigInt(e.quantity),
      actual_sale_price: e.salePrice,
    }));

    try {
      const saleId = await createSale.mutateAsync({
        cart_items: cartItems,
        customer_id: selectedCustomer.id,
      });
      if (saleId === null || saleId === undefined) {
        toast.error("Sale failed — insufficient inventory");
        return;
      }
      clearCart();
      setSelectedCustomer(null);
      toast.success("Sale confirmed!");
      onNavigate("/receipt", saleId as bigint);
    } catch {
      toast.error("Failed to create sale. Please try again.");
    }
  };

  const handleCustomerCreated = (customer: CustomerPublic) => {
    setSelectedCustomer(customer);
    setShowQuickAdd(false);
  };

  const isLoading = loadingProducts || loadingInventory || loadingCustomers;

  return (
    <div className="space-y-4" data-ocid="sales.page">
      {/* Customer selection bar */}
      <Card className="card-elevated" data-ocid="sales.customer.panel">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Customer</span>
              <span className="text-destructive text-sm">*</span>
            </div>
            <div className="flex-1 min-w-0 max-w-sm">
              {isLoading ? (
                <Skeleton className="h-9 rounded-lg" />
              ) : (
                <CustomerSelector
                  customers={customers}
                  selected={selectedCustomer}
                  onSelect={setSelectedCustomer}
                  onQuickAdd={() => setShowQuickAdd(true)}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-[500px] rounded-lg" />
          </div>
          <Skeleton className="h-[540px] rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Product Search */}
          <Card
            className="lg:col-span-2 card-elevated"
            data-ocid="sales.products.panel"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Products
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] flex flex-col">
              <ProductSearchPanel
                products={products}
                inventoryLevels={inventoryLevels}
                warehouseName={warehouseName}
                onAddToCart={addToCart}
                cartEntries={cart}
              />
            </CardContent>
          </Card>

          {/* Cart */}
          <Card className="card-elevated" data-ocid="sales.cart.panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] flex flex-col">
              <CartPanel
                entries={cart}
                selectedCustomer={selectedCustomer}
                onUpdateQty={updateQty}
                onUpdatePrice={updatePrice}
                onRemove={removeFromCart}
                onClear={clearCart}
                onConfirm={confirmSale}
                isConfirming={createSale.isPending}
                inventoryLevels={inventoryLevels}
                warehouseName={warehouseName}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Add Customer Modal */}
      <QuickAddCustomerModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}
