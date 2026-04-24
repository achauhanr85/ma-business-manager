import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useCheckCustomerDuplicate,
  useCreateCustomer,
  useCreateSale,
  useGetCustomers,
  useGetInventoryLevels,
  useGetProducts,
  useGetSaleItems,
  useGetSales,
  useUpdateSale,
} from "@/hooks/useBackend";
import { calcDiscount, getStoredCustomerDiscount } from "@/lib/discountStore";
import type {
  CartItem,
  CustomerPublic,
  InventoryLevel,
  Product,
  Sale,
  SaleItem,
} from "@/types";
import type {
  CustomerPublicWithDiscount,
  DiscountType,
  UpdateSaleInputUI,
} from "@/types";
import { UserRole } from "@/types";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Edit,
  Minus,
  Package,
  Percent,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  User,
  UserPlus,
  Wallet,
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

function formatCurrency(v: number): string {
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: bigint): string {
  if (ts === BigInt(0)) return "—";
  const ms = Number(ts / BigInt(1_000_000));
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  bank_transfer: "Bank Transfer",
  other: "Other",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  paid: "bg-primary/10 text-primary border-primary/30",
  unpaid: "bg-destructive/10 text-destructive border-destructive/30",
  partial: "bg-accent/20 text-accent-foreground border-accent/40",
};

// ─── Customer Selector ────────────────────────────────────────────────────────

function CustomerSelector({
  customers,
  selected,
  onSelect,
  onQuickAdd,
}: {
  customers: CustomerPublicWithDiscount[];
  selected: CustomerPublicWithDiscount | null;
  onSelect: (c: CustomerPublicWithDiscount | null) => void;
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
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
              setQuery("");
            }}
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
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted ${
                    selected?.id.toString() === c.id.toString()
                      ? "bg-primary/5 text-primary"
                      : "text-foreground"
                  }`}
                  onClick={() => {
                    onSelect(c);
                    setOpen(false);
                    setQuery("");
                  }}
                  data-ocid={`sales.customer_list.item.${idx + 1}`}
                >
                  <span className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-xs font-semibold text-secondary-foreground uppercase">
                    {c.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.phone && (
                      <p className="text-xs text-muted-foreground">{c.phone}</p>
                    )}
                  </div>
                  {c.discount_applicable &&
                    c.discount_value &&
                    c.discount_value > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs border-primary/40 text-primary shrink-0"
                      >
                        {c.discount_applicable === "Percentage"
                          ? `${c.discount_value}%`
                          : `₹${c.discount_value}`}
                      </Badge>
                    )}
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
      }
    } catch {
      /* silently ignore */
    }
  };

  const validate = () => {
    let valid = true;
    if (!name.trim()) {
      setNameError("Name is required");
      valid = false;
    } else setNameError("");
    if (!phone.trim()) {
      setPhoneError("Phone is required");
      valid = false;
    } else setPhoneError("");
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
        notes: [],
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
                  className="h-7 text-xs"
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
  paymentMode,
  paymentStatus,
  amountPaid,
  onPaymentModeChange,
  onPaymentStatusChange,
  onAmountPaidChange,
}: {
  entries: CartEntry[];
  selectedCustomer: CustomerPublicWithDiscount | null;
  onUpdateQty: (id: bigint, qty: number) => void;
  onUpdatePrice: (id: bigint, price: number) => void;
  onRemove: (id: bigint) => void;
  onClear: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  inventoryLevels: InventoryLevel[];
  warehouseName: string;
  paymentMode: string;
  paymentStatus: string;
  amountPaid: number;
  onPaymentModeChange: (v: string) => void;
  onPaymentStatusChange: (v: string) => void;
  onAmountPaidChange: (v: number) => void;
}) {
  const totalRevenue = entries.reduce(
    (sum, e) => sum + e.salePrice * e.quantity,
    0,
  );

  // Discount calculation
  const discountType = selectedCustomer?.discount_applicable as
    | DiscountType
    | undefined;
  const discountVal = selectedCustomer?.discount_value ?? 0;
  const { discountAmount, finalTotal } = calcDiscount(
    totalRevenue,
    discountType,
    discountVal,
  );

  // Payment balance
  const balanceDue =
    paymentStatus === "partial"
      ? Math.max(0, finalTotal - amountPaid)
      : paymentStatus === "paid"
        ? 0
        : finalTotal;

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
                        htmlFor={`cart-qty-${entry.product.id.toString()}`}
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
                          id={`cart-qty-${entry.product.id.toString()}`}
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
                        htmlFor={`cart-price-${entry.product.id.toString()}`}
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        Price (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          id={`cart-price-${entry.product.id.toString()}`}
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

          {selectedCustomer ? (
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/8 border border-primary/20">
              <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Selling to</p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {selectedCustomer.name}
                </p>
              </div>
              {discountType && discountVal > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs border-primary/40 text-primary shrink-0"
                >
                  <Percent className="w-2.5 h-2.5 mr-0.5" />
                  {discountType === "Percentage"
                    ? `${discountVal}%`
                    : `₹${discountVal}`}
                </Badge>
              )}
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

          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold text-foreground">
                ₹{totalRevenue.toFixed(2)}
              </span>
            </div>
            {/* Discount row */}
            {discountType && discountVal > 0 && entries.length > 0 && (
              <div
                className="flex justify-between text-sm rounded-md bg-primary/5 px-2 py-1.5"
                data-ocid="sales.discount.section"
              >
                <span className="text-primary flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  Discount (
                  {discountType === "Percentage"
                    ? `${discountVal}%`
                    : `₹${discountVal} fixed`}
                  )
                </span>
                <span className="font-semibold text-primary">
                  − ₹{discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm font-bold border-t border-border pt-1.5 mt-1">
                <span className="text-foreground">Final Total</span>
                <span className="text-primary">₹{finalTotal.toFixed(2)}</span>
              </div>
            )}
            <Separator className="my-2" />

            {/* Payment section */}
            <div
              className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-2.5"
              data-ocid="sales.payment.section"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" />
                Payment
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="pay-mode-new" className="text-xs">
                    Mode
                  </Label>
                  <Select
                    value={paymentMode}
                    onValueChange={onPaymentModeChange}
                  >
                    <SelectTrigger
                      id="pay-mode-new"
                      className="h-7 text-xs"
                      data-ocid="sales.payment_mode.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["cash", "card", "upi", "bank_transfer", "other"].map(
                        (m) => (
                          <SelectItem key={m} value={m} className="text-xs">
                            {PAYMENT_MODE_LABELS[m] ?? m}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pay-status-new" className="text-xs">
                    Status
                  </Label>
                  <Select
                    value={paymentStatus}
                    onValueChange={(v) => {
                      onPaymentStatusChange(v);
                      if (v === "paid") onAmountPaidChange(finalTotal);
                      if (v === "unpaid") onAmountPaidChange(0);
                    }}
                  >
                    <SelectTrigger
                      id="pay-status-new"
                      className="h-7 text-xs"
                      data-ocid="sales.payment_status.select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid" className="text-xs">
                        Paid
                      </SelectItem>
                      <SelectItem value="unpaid" className="text-xs">
                        Unpaid
                      </SelectItem>
                      <SelectItem value="partial" className="text-xs">
                        Partial
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {paymentStatus === "partial" && (
                <div className="space-y-1">
                  <Label htmlFor="amount-paid-new" className="text-xs">
                    Amount Paid (₹)
                  </Label>
                  <div className="relative">
                    <Wallet className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                    <Input
                      id="amount-paid-new"
                      type="number"
                      min={0}
                      max={finalTotal}
                      step={0.01}
                      value={amountPaid || ""}
                      onChange={(e) => {
                        const v = Number.parseFloat(e.target.value);
                        onAmountPaidChange(
                          Number.isNaN(v) ? 0 : Math.min(v, finalTotal),
                        );
                      }}
                      className="h-7 text-xs pl-6"
                      placeholder="0.00"
                      data-ocid="sales.amount_paid.input"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Balance Due</span>
                    <span className="text-destructive font-medium">
                      ₹{balanceDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              {paymentStatus === "paid" && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Fully paid — ₹{finalTotal.toFixed(2)}
                </p>
              )}
              {paymentStatus === "unpaid" && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Balance due — ₹{finalTotal.toFixed(2)}
                </p>
              )}
            </div>

            <Button
              type="button"
              className="w-full mt-1"
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
                `Confirm Sale · ₹${finalTotal.toFixed(2)}`
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Edit Sale Modal ──────────────────────────────────────────────────────────

interface EditSaleModalProps {
  sale: Sale | null;
  products: Product[];
  inventoryLevels: InventoryLevel[];
  warehouseName: string;
  onClose: () => void;
}

function EditSaleModal({
  sale,
  products,
  inventoryLevels,
  warehouseName,
  onClose,
}: EditSaleModalProps) {
  const { data: originalItems = [], isLoading: loadingItems } = useGetSaleItems(
    sale?.id ?? null,
  );
  const updateSale = useUpdateSale();

  // Build editable cart from original sale items
  const [editCart, setEditCart] = useState<CartEntry[]>([]);
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [paymentStatus, setPaymentStatus] = useState<string>("paid");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [productSearch, setProductSearch] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  useEffect(() => {
    if (!originalItems.length || !products.length) return;
    const entries: CartEntry[] = originalItems
      .map((item: SaleItem) => {
        const product = products.find(
          (p) => p.id.toString() === item.product_id.toString(),
        );
        if (!product) return null;
        return {
          product,
          quantity: Number(item.quantity),
          salePrice: item.actual_sale_price,
        };
      })
      .filter((e): e is CartEntry => e !== null);
    setEditCart(entries);
    // Set payment defaults from sale if fields exist
    const s = sale as Sale & {
      payment_mode?: string;
      payment_status?: string;
      amount_paid?: number;
    };
    if (s?.payment_mode) setPaymentMode(s.payment_mode);
    if (s?.payment_status) setPaymentStatus(s.payment_status);
    if (s?.amount_paid !== undefined) setAmountPaid(s.amount_paid);
    else if (sale) setAmountPaid(sale.total_revenue);
  }, [originalItems, products, sale]);

  const subtotal = editCart.reduce(
    (sum, e) => sum + e.salePrice * e.quantity,
    0,
  );

  // Read discount info from sale (if present) — read-only display
  const discountApplied =
    (sale as Sale & { discount_applied?: number })?.discount_applied ?? 0;
  const finalTotal = subtotal - discountApplied;
  const balanceDue = Math.max(0, finalTotal - amountPaid);

  const warehouseProductsFiltered = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 10);
    const q = productSearch.toLowerCase();
    return products.filter((p) => {
      const stock = getStockForWarehouse(p.id, inventoryLevels, warehouseName);
      return (
        stock > BigInt(0) &&
        (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      );
    });
  }, [products, inventoryLevels, warehouseName, productSearch]);

  const cartProductIds = new Set(editCart.map((e) => e.product.id.toString()));

  function updateQty(id: bigint, qty: number) {
    const stock = getStockForWarehouse(id, inventoryLevels, warehouseName);
    const capped = Math.min(qty, Number(stock));
    if (capped <= 0) {
      toast.warning("Insufficient stock");
      return;
    }
    setEditCart((prev) =>
      prev.map((e) =>
        e.product.id.toString() === id.toString()
          ? { ...e, quantity: capped }
          : e,
      ),
    );
  }

  function removeItem(id: bigint) {
    setEditCart((prev) =>
      prev.filter((e) => e.product.id.toString() !== id.toString()),
    );
  }

  function addProduct(product: Product) {
    if (cartProductIds.has(product.id.toString())) return;
    setEditCart((prev) => [
      ...prev,
      { product, quantity: 1, salePrice: product.mrp },
    ]);
    setShowAddProduct(false);
    setProductSearch("");
  }

  async function handleSave() {
    if (!sale) return;
    if (editCart.length === 0) {
      toast.error("Add at least one item to the order");
      return;
    }

    // Dry-run: verify stock for any new/increased items
    for (const entry of editCart) {
      const origItem = originalItems.find(
        (i: SaleItem) =>
          i.product_id.toString() === entry.product.id.toString(),
      );
      const origQty = origItem ? Number(origItem.quantity) : 0;
      if (entry.quantity > origQty) {
        const availableStock = getStockForWarehouse(
          entry.product.id,
          inventoryLevels,
          warehouseName,
        );
        const additionalNeeded = entry.quantity - origQty;
        if (BigInt(additionalNeeded) > availableStock) {
          toast.error(
            `Insufficient stock for "${entry.product.name}". Only ${availableStock.toString()} additional units available.`,
          );
          return;
        }
      }
    }

    const input: UpdateSaleInputUI = {
      sale_id: sale.id,
      items: editCart.map((e) => ({
        product_id: e.product.id,
        quantity: BigInt(e.quantity),
        actual_sale_price: e.salePrice,
      })),
      payment_mode: paymentMode,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
    };

    try {
      await updateSale.mutateAsync(input);
      toast.success("Order updated successfully");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update order";
      toast.error(msg);
    }
  }

  if (!sale) return null;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-ocid="sales.edit_order.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Edit className="w-4 h-4 text-primary" />
            Edit Order #{sale.id.toString()}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {formatDate(sale.timestamp)} · {sale.customer_name}
          </p>
        </DialogHeader>

        {loadingItems ? (
          <div className="space-y-2 py-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Discount info banner (read-only) */}
            {discountApplied > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <Tag className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Customer discount{" "}
                  <span className="font-semibold text-primary">
                    -{formatCurrency(discountApplied)}
                  </span>{" "}
                  will be re-applied automatically
                </p>
              </div>
            )}

            {/* Items list */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Items
              </p>
              {editCart.length === 0 && (
                <div
                  className="text-center py-6 text-muted-foreground text-sm rounded-lg border border-dashed border-border"
                  data-ocid="sales.edit_order.items.empty_state"
                >
                  No items — add at least one product
                </div>
              )}
              {editCart.map((entry, idx) => (
                <div
                  key={entry.product.id.toString()}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  data-ocid={`sales.edit_order.item.${idx + 1}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ₹{entry.salePrice.toFixed(2)} × {entry.quantity} ={" "}
                      <span className="text-primary font-medium">
                        ₹{(entry.salePrice * entry.quantity).toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                      onClick={() =>
                        entry.quantity > 1
                          ? updateQty(entry.product.id, entry.quantity - 1)
                          : removeItem(entry.product.id)
                      }
                      aria-label="Decrease"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-8 text-center text-sm tabular-nums">
                      {entry.quantity}
                    </span>
                    <button
                      type="button"
                      className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                      onClick={() =>
                        updateQty(entry.product.id, entry.quantity + 1)
                      }
                      aria-label="Increase"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      className="w-6 h-6 ml-1 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => removeItem(entry.product.id)}
                      aria-label="Remove"
                      data-ocid={`sales.edit_order.delete_button.${idx + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add product */}
              {showAddProduct ? (
                <div className="rounded-lg border border-border p-2 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 h-8 text-sm"
                      placeholder="Search products…"
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      autoFocus
                      data-ocid="sales.edit_order.product_search_input"
                    />
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {warehouseProductsFiltered.map((p) => (
                      <button
                        key={p.id.toString()}
                        type="button"
                        disabled={cartProductIds.has(p.id.toString())}
                        onClick={() => addProduct(p)}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm text-left transition-colors ${cartProductIds.has(p.id.toString()) ? "opacity-40 cursor-not-allowed" : "hover:bg-muted"}`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">
                          ₹{p.mrp.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="w-full h-7 text-xs"
                    onClick={() => {
                      setShowAddProduct(false);
                      setProductSearch("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs border-dashed"
                  onClick={() => setShowAddProduct(true)}
                  data-ocid="sales.edit_order.add_item_button"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
                </Button>
              )}
            </div>

            {/* Payment section */}
            <div className="space-y-3 pt-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Payment
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger
                      className="h-9"
                      data-ocid="sales.edit_order.payment_mode_select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Status</Label>
                  <Select
                    value={paymentStatus}
                    onValueChange={(v) => {
                      setPaymentStatus(v);
                      if (v === "paid") setAmountPaid(finalTotal);
                      if (v === "unpaid") setAmountPaid(0);
                    }}
                  >
                    <SelectTrigger
                      className="h-9"
                      data-ocid="sales.edit_order.payment_status_select"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {paymentStatus === "partial" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Amount Paid (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    max={finalTotal}
                    value={amountPaid}
                    onChange={(e) => {
                      const v = Number.parseFloat(e.target.value);
                      if (!Number.isNaN(v))
                        setAmountPaid(Math.min(v, finalTotal));
                    }}
                    className="h-9"
                    data-ocid="sales.edit_order.amount_paid_input"
                  />
                </div>
              )}
            </div>

            {/* Order summary */}
            <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountApplied > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountApplied)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1">
                <span>Total</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
              {paymentStatus === "partial" && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Balance Due</span>
                  <span>{formatCurrency(balanceDue)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-ocid="sales.edit_order.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={
              updateSale.isPending || loadingItems || editCart.length === 0
            }
            data-ocid="sales.edit_order.save_button"
          >
            {updateSale.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Saving…
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Read-Only Order View Modal ───────────────────────────────────────────────

interface ReadOnlyOrderModalProps {
  sale: Sale | null;
  onClose: () => void;
}

function ReadOnlyOrderModal({ sale, onClose }: ReadOnlyOrderModalProps) {
  const { data: items = [], isLoading } = useGetSaleItems(sale?.id ?? null);

  if (!sale) return null;

  const discountApplied =
    (sale as Sale & { discount_applied?: number }).discount_applied ?? 0;
  const subtotal = sale.total_revenue + discountApplied;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-ocid="sales.view_order.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-primary" />
            Order #{sale.id.toString()}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {formatDate(sale.timestamp)} · {sale.customer_name}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Items
              </p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No items found
                </p>
              ) : (
                items.map((item: SaleItem, idx: number) => (
                  <div
                    key={`${item.sale_id}-${item.product_id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                    data-ocid={`sales.view_order.item.${idx + 1}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.product_name_snapshot}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ₹{item.actual_sale_price.toFixed(2)} ×{" "}
                        {Number(item.quantity)} ={" "}
                        <span className="text-primary font-medium">
                          ₹
                          {(
                            item.actual_sale_price * Number(item.quantity)
                          ).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground tabular-nums flex-shrink-0">
                      ×{Number(item.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Totals */}
            <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 border border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountApplied > 0 && (
                <div className="flex justify-between text-sm text-primary">
                  <span>Discount</span>
                  <span>-{formatCurrency(discountApplied)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-1.5 mt-1">
                <span>Total</span>
                <span>{formatCurrency(sale.total_revenue)}</span>
              </div>
            </div>

            {/* Payment info */}
            {(() => {
              const s = sale as Sale & {
                payment_mode?: string;
                payment_status?: string;
                amount_paid?: number;
              };
              return s.payment_mode || s.payment_status ? (
                <div className="rounded-lg bg-muted/20 border border-border px-3 py-2.5 space-y-1 text-sm">
                  {s.payment_mode && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mode</span>
                      <span className="font-medium">
                        {PAYMENT_MODE_LABELS[s.payment_mode] ?? s.payment_mode}
                      </span>
                    </div>
                  )}
                  {s.payment_status && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span
                        className={`font-medium capitalize ${String(s.payment_status) === "paid" ? "text-primary" : String(s.payment_status) === "unpaid" ? "text-destructive" : "text-accent-foreground"}`}
                      >
                        {s.payment_status}
                      </span>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-ocid="sales.view_order.close_button"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Order History Panel ──────────────────────────────────────────────────────

function OrderHistoryPanel({
  sales,
  isLoading,
  onEditSale,
  onPrintReceipt,
  canEdit,
}: {
  sales: Sale[];
  isLoading: boolean;
  onEditSale: (sale: Sale) => void;
  onPrintReceipt: (sale: Sale) => void;
  canEdit: boolean;
}) {
  const sorted = useMemo(
    () => [...sales].sort((a, b) => Number(b.timestamp) - Number(a.timestamp)),
    [sales],
  );

  if (isLoading) {
    return (
      <div className="space-y-3" data-ocid="sales.history.loading_state">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div
        className="flex flex-col items-center gap-3 py-12 text-muted-foreground"
        data-ocid="sales.history.empty_state"
      >
        <Clock className="w-10 h-10 opacity-30" />
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">No orders yet</p>
          <p className="text-xs mt-0.5">Completed sales will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((sale, idx) => {
        const saleWithPayment = sale as Sale & {
          payment_status?: string;
          payment_mode?: string;
          discount_applied?: number;
        };
        const paymentStatus = saleWithPayment.payment_status ?? "paid";
        const paymentMode = saleWithPayment.payment_mode;
        const discountApplied = saleWithPayment.discount_applied ?? 0;

        return (
          <div
            key={sale.id.toString()}
            className="rounded-lg border border-border bg-card p-4 stagger-item"
            style={{ animationDelay: `${idx * 0.04}s` }}
            data-ocid={`sales.history.item.${idx + 1}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold">
                    Order #{sale.id.toString()}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PAYMENT_STATUS_COLORS[paymentStatus] ?? PAYMENT_STATUS_COLORS.paid}`}
                  >
                    {paymentStatus.charAt(0).toUpperCase() +
                      paymentStatus.slice(1)}
                  </span>
                  {paymentMode && (
                    <span className="text-xs text-muted-foreground">
                      {PAYMENT_MODE_LABELS[paymentMode] ?? paymentMode}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatDate(sale.timestamp)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <User className="w-3 h-3" /> {sale.customer_name}
                </p>
              </div>
              <div className="text-right flex-shrink-0 space-y-1">
                <p className="text-sm font-semibold text-primary">
                  {formatCurrency(sale.total_revenue)}
                </p>
                {discountApplied > 0 && (
                  <p className="text-xs text-muted-foreground">
                    -{formatCurrency(discountApplied)} disc.
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => onPrintReceipt(sale)}
                data-ocid={`sales.history.print_button.${idx + 1}`}
              >
                <Printer className="w-3 h-3" />
                Print Receipt
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => onEditSale(sale)}
                  data-ocid={`sales.history.edit_button.${idx + 1}`}
                >
                  <Edit className="w-3 h-3" />
                  Edit Order
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sales Page ───────────────────────────────────────────────────────────────

export function SalesPage({ onNavigate }: SalesPageProps) {
  const { userProfile } = useProfile();
  const warehouseName = userProfile?.warehouse_name ?? "";

  // Role-based permissions
  const canEdit =
    userProfile?.role === UserRole.admin ||
    userProfile?.role === UserRole.superAdmin;

  const { data: products = [], isLoading: loadingProducts } = useGetProducts();
  const { data: inventoryLevels = [], isLoading: loadingInventory } =
    useGetInventoryLevels();
  const { data: rawCustomers = [], isLoading: loadingCustomers } =
    useGetCustomers();
  const { data: sales = [], isLoading: loadingSales } = useGetSales();
  const createSale = useCreateSale();

  // Enrich customers with any locally-stored notes (discount fields now from backend)
  const customers: CustomerPublicWithDiscount[] = useMemo(
    () =>
      rawCustomers.map((c) => {
        const stored = getStoredCustomerDiscount(c.id.toString());
        const notesText = c.notes.length > 0 ? c.notes[0] : stored.notes;
        return { ...c, notesText };
      }),
    [rawCustomers],
  );

  const [cart, setCart] = useState<CartEntry[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerPublicWithDiscount | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [activeTab, setActiveTab] = useState<string>("new-sale");

  // Payment state for new sales
  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amountPaid, setAmountPaid] = useState(0);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      if (prev.find((e) => e.product.id.toString() === product.id.toString()))
        return prev;
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

    // Compute discount for storage on the sale record
    const subtotal = cart.reduce((s, e) => s + e.salePrice * e.quantity, 0);
    const { discountAmount, finalTotal } = calcDiscount(
      subtotal,
      selectedCustomer.discount_applicable as DiscountType | undefined,
      selectedCustomer.discount_value,
    );
    const effectiveAmountPaid =
      paymentStatus === "paid"
        ? finalTotal
        : paymentStatus === "unpaid"
          ? 0
          : amountPaid;

    // DRY-RUN VALIDATION NOTES:
    // Stock-PO Loop: stock verified above; IC canister atomically deducts batches (FIFO)
    //   and rolls back on trap — no partial update possible.
    // Discount/Order Edit Collision: calcDiscount recomputes fresh on every confirm,
    //   so edits always use the latest subtotal. Balance = finalTotal - effectiveAmountPaid.
    // Governance Gatekeeper: backend checks profile active_window before createSale resolves.

    try {
      const saleId = await createSale.mutateAsync({
        cart_items: cartItems,
        customer_id: selectedCustomer.id,
        // Extended payment/discount fields; passed through useCreateSale which extracts only base fields for backend
        ...(discountAmount > 0 && {
          discount_applied: discountAmount,
          discount_type: selectedCustomer.discount_applicable,
          original_subtotal: subtotal,
        }),
        payment_mode: paymentMode,
        payment_status: paymentStatus,
        amount_paid: effectiveAmountPaid,
        balance_due: Math.max(0, finalTotal - effectiveAmountPaid),
      });
      if (saleId === null || saleId === undefined) {
        toast.error("Sale failed — insufficient inventory");
        return;
      }
      setCart([]);
      setSelectedCustomer(null);
      setPaymentMode("cash");
      setPaymentStatus("paid");
      setAmountPaid(0);
      toast.success("Sale confirmed!");
      onNavigate("/receipt", saleId as bigint);
    } catch {
      toast.error("Failed to create sale. Please try again.");
    }
  };

  const isLoading = loadingProducts || loadingInventory || loadingCustomers;

  return (
    <div className="space-y-4" data-ocid="sales.page">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        data-ocid="sales.tabs"
      >
        <TabsList className="w-full sm:w-auto" data-ocid="sales.tab_list">
          <TabsTrigger
            value="new-sale"
            className="flex items-center gap-1.5"
            data-ocid="sales.new_sale.tab"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            New Sale
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center gap-1.5"
            data-ocid="sales.history.tab"
          >
            <Clock className="w-3.5 h-3.5" />
            Order History
            {sales.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                {sales.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── New Sale Tab ── */}
        <TabsContent value="new-sale" className="mt-4 space-y-4">
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

              <Card className="card-elevated" data-ocid="sales.cart.panel">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[500px] flex flex-col overflow-y-auto">
                  <CartPanel
                    entries={cart}
                    selectedCustomer={selectedCustomer}
                    onUpdateQty={updateQty}
                    onUpdatePrice={updatePrice}
                    onRemove={removeFromCart}
                    onClear={() => setCart([])}
                    onConfirm={confirmSale}
                    isConfirming={createSale.isPending}
                    inventoryLevels={inventoryLevels}
                    warehouseName={warehouseName}
                    paymentMode={paymentMode}
                    paymentStatus={paymentStatus}
                    amountPaid={amountPaid}
                    onPaymentModeChange={setPaymentMode}
                    onPaymentStatusChange={setPaymentStatus}
                    onAmountPaidChange={setAmountPaid}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ── Order History Tab ── */}
        <TabsContent value="history" className="mt-4">
          <Card className="card-elevated" data-ocid="sales.history.panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OrderHistoryPanel
                sales={sales}
                isLoading={loadingSales}
                onEditSale={(sale) => {
                  if (canEdit) setEditSale(sale);
                  else setViewSale(sale);
                }}
                onPrintReceipt={(sale) => onNavigate("/receipt", sale.id)}
                canEdit={canEdit}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <QuickAddCustomerModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onCustomerCreated={(c) => {
          setSelectedCustomer({
            ...c,
            notesText: undefined,
          } as CustomerPublicWithDiscount);
          setShowQuickAdd(false);
        }}
      />

      {canEdit ? (
        <EditSaleModal
          sale={editSale}
          products={products}
          inventoryLevels={inventoryLevels}
          warehouseName={warehouseName}
          onClose={() => setEditSale(null)}
        />
      ) : (
        <ReadOnlyOrderModal sale={viewSale} onClose={() => setViewSale(null)} />
      )}
    </div>
  );
}
