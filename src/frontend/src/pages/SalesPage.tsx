import { Variant_active_lead_inactive } from "@/backend";
import { createActor } from "@/backend";
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
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useAddPaymentEntry,
  useCheckCustomerDuplicate,
  useCreateCustomerFromSales,
  useCreateReturnOrder,
  useCreateSale,
  useGetCustomerOrders,
  useGetCustomers,
  useGetInventoryLevels,
  useGetLastSaleForCustomer,
  useGetPaymentHistory,
  useGetProducts,
  useGetSaleItems,
  useGetSales,
  useGetUsersByProfile,
  useUpdatePaymentStatus,
  useUpdateSale,
} from "@/hooks/useBackend";
import type { ReturnOrderItem } from "@/hooks/useBackend";
import { calcDiscount, getStoredCustomerDiscount } from "@/lib/discountStore";
import type {
  CartItem,
  CustomerPublic,
  CustomerPublicWithDiscount,
  DiscountType,
  InventoryLevel,
  Product,
  Sale,
  SaleItem,
  UpdateSaleInputUI,
} from "@/types";
import { UserRole } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Edit,
  FileText,
  Minus,
  Package,
  Percent,
  Plus,
  Printer,
  RefreshCw,
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

// ─── Goal Master (graceful — may not be in backend yet) ──────────────────────

interface GoalMasterPublic {
  id: bigint;
  name: string;
  description: string;
  product_bundle: bigint[];
}

function useGetGoalMasterData(profileKey: string | null) {
  const { actor, isFetching } = useActor(createActor);
  return useQuery<GoalMasterPublic[]>({
    queryKey: ["goal-master-data", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getGoalMasterData !== "function") return [];
      try {
        const result = await (
          a.getGoalMasterData as (pk: string) => Promise<GoalMasterPublic[]>
        )(profileKey);
        return result ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

// ─── Extract sale ID safely from backend result ───────────────────────────────
// Backend createSale() may return a bare bigint OR { id: bigint } depending on version.
function extractSaleId(result: unknown): bigint | null {
  if (result === null || result === undefined) return null;
  if (typeof result === "bigint") return result === BigInt(0) ? null : result;
  if (typeof result === "object" && result !== null && "id" in result) {
    const id = (result as { id: bigint }).id;
    if (typeof id === "bigint") return id === BigInt(0) ? null : id;
  }
  return null;
}

interface SalesPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

interface CartEntry {
  product: Product;
  quantity: number;
  salePrice: number;
  product_instructions?: string;
  is_loaned_item?: boolean;
  /** Only relevant for return orders — true means restock, false means write-off */
  is_usable?: boolean;
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
  // Include both regular batches at this warehouse AND loaned batches assigned to this warehouse
  const warehouseQty = level.batches
    .filter(
      (b) =>
        b.warehouse_name === warehouseName ||
        (b.is_loaned && b.warehouse_name === warehouseName),
    )
    .reduce((sum, b) => sum + b.quantity_remaining, BigInt(0));
  return warehouseQty;
}

/** Returns the quantity of loaned batches for a product at the given warehouse */
function getLoanedStockForWarehouse(
  productId: bigint,
  levels: InventoryLevel[],
  warehouseName: string,
): bigint {
  const level = levels.find(
    (l) => l.product_id.toString() === productId.toString(),
  );
  if (!level) return BigInt(0);
  return level.batches
    .filter(
      (b) =>
        b.is_loaned && (!warehouseName || b.warehouse_name === warehouseName),
    )
    .reduce((sum, b) => sum + b.quantity_remaining, BigInt(0));
}

/** Returns true if all available stock for a product at the warehouse is loaned */
function isProductFullyLoaned(
  productId: bigint,
  levels: InventoryLevel[],
  warehouseName: string,
): boolean {
  const level = levels.find(
    (l) => l.product_id.toString() === productId.toString(),
  );
  if (!level) return false;
  const batches = warehouseName
    ? level.batches.filter((b) => b.warehouse_name === warehouseName)
    : level.batches;
  if (batches.length === 0) return false;
  return batches.every((b) => b.is_loaned);
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
  returned: "bg-muted/40 text-muted-foreground border-border",
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

  // Only active customers can be added to a sale
  const activeCustomers = useMemo(
    () =>
      customers.filter(
        (c) => c.customer_type === Variant_active_lead_inactive.active,
      ),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeCustomers.slice(0, 10);
    // Search across ALL customers to detect non-active matches
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, activeCustomers, query]);

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
              filtered.map((c, idx) => {
                const isActive =
                  c.customer_type === Variant_active_lead_inactive.active;
                return (
                  <button
                    key={c.id.toString()}
                    type="button"
                    disabled={!isActive}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      !isActive
                        ? "opacity-50 cursor-not-allowed bg-muted/10"
                        : selected?.id.toString() === c.id.toString()
                          ? "bg-primary/5 text-primary hover:bg-primary/10"
                          : "text-foreground hover:bg-muted"
                    }`}
                    onClick={() => {
                      if (!isActive) return;
                      onSelect(c);
                      setOpen(false);
                      setQuery("");
                    }}
                    data-ocid={`sales.customer_list.item.${idx + 1}`}
                    title={
                      !isActive
                        ? "This customer is not active. Only Active customers can be added to a sale."
                        : undefined
                    }
                  >
                    <span className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-xs font-semibold text-secondary-foreground uppercase">
                      {c.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.phone && (
                        <p className="text-xs text-muted-foreground">
                          {c.phone}
                        </p>
                      )}
                      {!isActive && (
                        <p className="text-xs text-destructive">
                          Not active — cannot add to sale
                        </p>
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
                );
              })
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
  const createCustomer = useCreateCustomerFromSales();

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
        customer_type: Variant_active_lead_inactive.active,
        medical_issue_ids: [],
        primary_goal_ids: [],
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
  onAddToCart: (product: Product, isLoaned: boolean) => void;
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
          const loanedQty = getLoanedStockForWarehouse(
            product.id,
            inventoryLevels,
            warehouseName,
          );
          const hasLoaned = loanedQty > BigInt(0);
          const isFullyLoaned = isProductFullyLoaned(
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
              onClick={() => onAddToCart(product, isFullyLoaned)}
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
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {hasLoaned && (
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400"
                  >
                    Loaned ({loanedQty.toString()})
                  </Badge>
                )}
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

// ─── Last Order Summary Panel ─────────────────────────────────────────────────

interface LastOrderSummaryProps {
  customerId: bigint | null;
  onCopyOrder: (
    items: Array<{ productId: bigint; qty: number; price: number }>,
    note: string,
  ) => void;
}

function LastOrderSummary({ customerId, onCopyOrder }: LastOrderSummaryProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: orders = [], isLoading } = useGetCustomerOrders(customerId);

  const lastOrder = useMemo(() => {
    if (orders.length === 0) return null;
    return [...orders].sort(
      (a, b) => Number(b.timestamp) - Number(a.timestamp),
    )[0];
  }, [orders]);

  if (!customerId || isLoading) return null;
  if (!lastOrder) return null;

  return (
    <div
      className="rounded-lg border border-border bg-muted/20 overflow-hidden"
      data-ocid="sales.last_order.panel"
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        data-ocid="sales.last_order.toggle"
      >
        <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
          <Clock className="w-3.5 h-3.5" />
          Last Order — {formatDate(lastOrder.timestamp)}
        </span>
        <ChevronRight
          className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="space-y-1">
            {lastOrder.items.map((item, idx) => (
              <div
                key={`${item.product_id.toString()}-${idx}`}
                className="flex justify-between text-xs"
              >
                <span className="text-foreground truncate">
                  {item.product_name}
                </span>
                <span className="text-muted-foreground ml-2 flex-shrink-0">
                  ×{Number(item.quantity)} @ ₹
                  {item.actual_sale_price.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs font-semibold pt-1 border-t border-border">
            <span className="text-muted-foreground">Total</span>
            <span className="text-primary">
              {formatCurrency(lastOrder.total_revenue)}
            </span>
          </div>
          {lastOrder.sale_note && (
            <p className="text-xs text-muted-foreground italic">
              {lastOrder.sale_note}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs gap-1.5"
            onClick={() =>
              onCopyOrder(
                lastOrder.items.map((i) => ({
                  productId: i.product_id,
                  qty: Number(i.quantity),
                  price: i.actual_sale_price,
                })),
                lastOrder.sale_note ?? "",
              )
            }
            data-ocid="sales.copy_previous_order.button"
          >
            <RefreshCw className="w-3 h-3" /> Copy Previous Order
          </Button>
        </div>
      )}
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
  saleNote,
  paymentDueDate,
  orderType,
  onPaymentModeChange,
  onPaymentStatusChange,
  onAmountPaidChange,
  onSaleNoteChange,
  onPaymentDueDateChange,
  onOrderTypeChange,
  onToggleUsable,
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
  saleNote: string;
  paymentDueDate: string;
  orderType: string;
  onPaymentModeChange: (v: string) => void;
  onPaymentStatusChange: (v: string) => void;
  onAmountPaidChange: (v: number) => void;
  onSaleNoteChange: (v: string) => void;
  onPaymentDueDateChange: (v: string) => void;
  onOrderTypeChange: (v: string) => void;
  onToggleUsable: (id: bigint, isUsable: boolean) => void;
}) {
  const totalRevenue = entries.reduce(
    (sum, e) => sum + e.salePrice * e.quantity,
    0,
  );

  const discountType = selectedCustomer?.discount_applicable as
    | DiscountType
    | undefined;
  const discountVal = selectedCustomer?.discount_value ?? 0;
  const { discountAmount, finalTotal } = calcDiscount(
    totalRevenue,
    discountType,
    discountVal,
  );

  const balanceDue =
    paymentStatus === "partial"
      ? Math.max(0, finalTotal - amountPaid)
      : paymentStatus === "paid"
        ? 0
        : finalTotal;

  const canConfirm = entries.length > 0 && !!selectedCustomer && !isConfirming;
  const isReturnOrder = orderType === "return";
  const restockCount = isReturnOrder
    ? entries.filter((e) => e.is_usable !== false).length
    : 0;
  const writeOffCount = isReturnOrder
    ? entries.filter((e) => e.is_usable === false).length
    : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Order Summary</span>
          {entries.length > 0 && (
            <Badge variant="secondary" className="text-xs h-4 px-1">
              {entries.length}
            </Badge>
          )}
        </div>
        {entries.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive text-xs h-6"
            data-ocid="sales.cart.clear_button"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Customer badge below header */}
      {selectedCustomer && (
        <div className="mb-2 flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/8 border border-primary/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <p className="text-xs font-semibold text-foreground truncate">
            {selectedCustomer.name}
          </p>
          {discountType && discountVal > 0 && (
            <Badge
              variant="outline"
              className="text-xs border-primary/40 text-primary shrink-0 ml-auto h-4 px-1"
            >
              <Percent className="w-2 h-2 mr-0.5" />
              {discountType === "Percentage"
                ? `${discountVal}%`
                : `₹${discountVal}`}
            </Badge>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground py-6"
          data-ocid="sales.cart.empty_state"
        >
          <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-xs font-medium">Cart is empty</p>
          <p className="text-xs mt-0.5 opacity-70">Click products to add</p>
        </div>
      ) : (
        <>
          {/* Cart items — compact */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5 min-h-0">
            {entries.map((entry, idx) => {
              const maxQty = Number(
                getStockForWarehouse(
                  entry.product.id,
                  inventoryLevels,
                  warehouseName,
                ),
              );
              const itemIsUsable = entry.is_usable !== false;
              return (
                <div
                  key={entry.product.id.toString()}
                  className={`rounded border bg-card py-1.5 px-2 space-y-1 ${
                    isReturnOrder && !itemIsUsable
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border"
                  }`}
                  data-ocid={`sales.cart.item.${idx + 1}`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">
                        {entry.product.name}
                      </p>
                      {entry.is_loaned_item && (
                        <Badge
                          variant="outline"
                          className="text-xs border-amber-500/50 text-amber-600 shrink-0 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 h-4 px-1"
                        >
                          Loaned
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-primary font-semibold flex-shrink-0">
                      ₹{(entry.salePrice * entry.quantity).toFixed(0)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.product.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      aria-label="Remove item"
                      data-ocid={`sales.cart.delete_button.${idx + 1}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Qty stepper */}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        onClick={() =>
                          onUpdateQty(
                            entry.product.id,
                            Math.max(1, entry.quantity - 1),
                          )
                        }
                        aria-label="Decrease"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <Input
                        type="number"
                        min={1}
                        max={maxQty}
                        value={entry.quantity}
                        onChange={(e) => {
                          const v = Number.parseInt(e.target.value, 10);
                          if (!Number.isNaN(v) && v > 0)
                            onUpdateQty(entry.product.id, v);
                        }}
                        className="h-5 text-center text-xs w-9 px-0.5"
                        data-ocid={`sales.cart.qty_input.${idx + 1}`}
                      />
                      <button
                        type="button"
                        className="w-5 h-5 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                        onClick={() =>
                          onUpdateQty(entry.product.id, entry.quantity + 1)
                        }
                        aria-label="Increase"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    {/* Price input */}
                    <div className="relative flex-1">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        ₹
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={entry.salePrice}
                        onChange={(e) => {
                          const v = Number.parseFloat(e.target.value);
                          if (!Number.isNaN(v) && v >= 0)
                            onUpdatePrice(entry.product.id, v);
                        }}
                        className="h-5 text-xs pl-4"
                        data-ocid={`sales.cart.price_input.${idx + 1}`}
                      />
                    </div>
                  </div>
                  {/* Usable/Non-usable toggle — only shown for return orders */}
                  {isReturnOrder && (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <button
                        type="button"
                        onClick={() => onToggleUsable(entry.product.id, true)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                          itemIsUsable
                            ? "border-primary/50 bg-primary/10 text-primary font-medium"
                            : "border-border text-muted-foreground hover:border-primary/30"
                        }`}
                        data-ocid={`sales.cart.usable_toggle.${idx + 1}`}
                        aria-pressed={itemIsUsable}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Usable
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleUsable(entry.product.id, false)}
                        className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                          !itemIsUsable
                            ? "border-destructive/50 bg-destructive/10 text-destructive font-medium"
                            : "border-border text-muted-foreground hover:border-destructive/30"
                        }`}
                        data-ocid={`sales.cart.nonusable_toggle.${idx + 1}`}
                        aria-pressed={!itemIsUsable}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                        Non-usable
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!selectedCustomer && (
            <div
              className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded bg-destructive/5 border border-destructive/20"
              data-ocid="sales.customer_required_warning"
            >
              <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">
                Select a customer to proceed
              </p>
            </div>
          )}

          {/* Return restock/write-off summary */}
          {isReturnOrder && entries.length > 0 && (
            <div
              className="mt-2 flex items-center gap-3 px-2 py-1.5 rounded border border-border bg-muted/30 text-xs"
              data-ocid="sales.return_summary.section"
            >
              {restockCount > 0 && (
                <span className="flex items-center gap-1 text-primary">
                  <CheckCircle2 className="w-3 h-3" />
                  {restockCount} will be restocked
                </span>
              )}
              {writeOffCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <Trash2 className="w-3 h-3" />
                  {writeOffCount} written off
                </span>
              )}
            </div>
          )}

          {/* Totals */}
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">₹{totalRevenue.toFixed(2)}</span>
            </div>
            {discountType && discountVal > 0 && entries.length > 0 && (
              <div
                className="flex justify-between text-xs"
                data-ocid="sales.discount.section"
              >
                <span className="text-primary flex items-center gap-0.5">
                  <Percent className="w-2.5 h-2.5" />
                  Discount
                </span>
                <span className="font-semibold text-primary">
                  − ₹{discountAmount.toFixed(2)}
                </span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-xs font-bold border-t border-border pt-1 mt-0.5">
                <span>Total</span>
                <span className="text-primary">₹{finalTotal.toFixed(2)}</span>
              </div>
            )}

            <Separator className="my-1.5" />

            {/* Order type */}
            <div className="flex items-center gap-2">
              <Label className="text-xs w-16 flex-shrink-0">Type</Label>
              <Select value={orderType} onValueChange={onOrderTypeChange}>
                <SelectTrigger
                  className="h-6 text-xs flex-1"
                  data-ocid="sales.order_type.select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard" className="text-xs">
                    Standard
                  </SelectItem>
                  <SelectItem value="return" className="text-xs">
                    Return
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment — side by side */}
            <div
              className="rounded border border-border bg-muted/20 p-2 space-y-1.5"
              data-ocid="sales.payment.section"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Payment
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label htmlFor="pay-mode-new" className="text-xs">
                    Mode
                  </Label>
                  <Select
                    value={paymentMode}
                    onValueChange={onPaymentModeChange}
                  >
                    <SelectTrigger
                      id="pay-mode-new"
                      className="h-6 text-xs mt-0.5"
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
                <div>
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
                      className="h-6 text-xs mt-0.5"
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
                <div className="space-y-0.5">
                  <Label htmlFor="amount-paid-new" className="text-xs">
                    Amount Paid (₹)
                  </Label>
                  <div className="relative">
                    <Wallet className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
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
                      className="h-6 text-xs pl-5"
                      placeholder="0.00"
                      data-ocid="sales.amount_paid.input"
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Balance</span>
                    <span className="text-destructive font-medium">
                      ₹{balanceDue.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              {(paymentStatus === "partial" || paymentStatus === "unpaid") && (
                <div className="space-y-0.5">
                  <Label
                    htmlFor="payment-due-date"
                    className="text-xs flex items-center gap-0.5"
                  >
                    <Calendar className="w-3 h-3" /> Due Date
                  </Label>
                  <Input
                    id="payment-due-date"
                    type="date"
                    value={paymentDueDate}
                    onChange={(e) => onPaymentDueDateChange(e.target.value)}
                    className="h-6 text-xs"
                    min={new Date().toISOString().split("T")[0]}
                    data-ocid="sales.payment_due_date.input"
                  />
                </div>
              )}
              {paymentStatus === "paid" && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Paid — ₹
                  {finalTotal.toFixed(2)}
                </p>
              )}
            </div>

            {/* Sale Note */}
            <div className="space-y-0.5">
              <Label
                htmlFor="sale-note"
                className="text-xs flex items-center gap-0.5"
              >
                <FileText className="w-3 h-3" /> Sale Note
              </Label>
              <Textarea
                id="sale-note"
                value={saleNote}
                onChange={(e) => onSaleNoteChange(e.target.value)}
                placeholder="Add a note for this sale…"
                className="text-xs min-h-[44px] resize-none"
                data-ocid="sales.sale_note.textarea"
              />
            </div>

            <Button
              type="button"
              className="w-full mt-1 h-8 text-sm"
              onClick={onConfirm}
              disabled={!canConfirm}
              title={!selectedCustomer ? "Select a customer first" : undefined}
              data-ocid="sales.confirm_button"
            >
              {isConfirming ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                `Confirm · ₹${finalTotal.toFixed(2)}`
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

  const [editCart, setEditCart] = useState<CartEntry[]>([]);
  const [paymentMode, setPaymentMode] = useState<string>("cash");
  const [paymentStatus, setPaymentStatus] = useState<string>("paid");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentDueDate, setPaymentDueDate] = useState<string>("");
  const [saleNote, setSaleNote] = useState<string>("");
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
        const entry: CartEntry = {
          product,
          quantity: Number(item.quantity),
          salePrice: item.actual_sale_price,
          product_instructions: item.product_instructions,
        };
        return entry;
      })
      .filter((e): e is CartEntry => e !== null);
    setEditCart(entries);
    const s = sale as Sale & {
      payment_mode?: string;
      payment_status?: string;
      amount_paid?: number;
      payment_due_date?: string;
      sale_note?: string;
    };
    if (s?.payment_mode) setPaymentMode(s.payment_mode);
    if (s?.payment_status) setPaymentStatus(s.payment_status);
    if (s?.amount_paid !== undefined) setAmountPaid(s.amount_paid);
    else if (sale) setAmountPaid(sale.total_revenue);
    if (s?.payment_due_date) setPaymentDueDate(s.payment_due_date);
    if (s?.sale_note) setSaleNote(s.sale_note);
  }, [originalItems, products, sale]);

  const subtotal = editCart.reduce(
    (sum, e) => sum + e.salePrice * e.quantity,
    0,
  );

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
        ...(e.product_instructions && {
          product_instructions: e.product_instructions,
        }),
      })),
      payment_mode: paymentMode,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      ...(paymentDueDate && { payment_due_date: paymentDueDate }),
      ...(saleNote && { sale_note: saleNote }),
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

              {(paymentStatus === "partial" || paymentStatus === "unpaid") && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Payment Due Date
                  </Label>
                  <Input
                    type="date"
                    value={paymentDueDate}
                    onChange={(e) => setPaymentDueDate(e.target.value)}
                    className="h-9"
                    data-ocid="sales.edit_order.payment_due_date_input"
                  />
                </div>
              )}
            </div>

            {/* Sale note */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Sale Note
              </Label>
              <Textarea
                value={saleNote}
                onChange={(e) => setSaleNote(e.target.value)}
                placeholder="Add a note for this sale…"
                className="text-sm min-h-[60px] resize-none"
                data-ocid="sales.edit_order.sale_note_textarea"
              />
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
  sellerName?: string;
}

function ReadOnlyOrderModal({
  sale,
  onClose,
  sellerName,
}: ReadOnlyOrderModalProps) {
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
            {sellerName && (
              <span className="ml-2 text-muted-foreground">
                Sold by: {sellerName}
              </span>
            )}
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

// ─── Payments Dialog ──────────────────────────────────────────────────────────

interface PaymentsDialogProps {
  sale: Sale | null;
  onClose: () => void;
  currentUserName: string;
}

function PaymentsDialog({
  sale,
  onClose,
  currentUserName,
}: PaymentsDialogProps) {
  const { data: paymentHistory = [], isLoading: loadingHistory } =
    useGetPaymentHistory(sale?.id ?? null);
  const addPaymentEntry = useAddPaymentEntry();

  const [addAmount, setAddAmount] = useState<string>("");
  const [addMethod, setAddMethod] = useState<string>("cash");
  const [showAddForm, setShowAddForm] = useState(false);

  if (!sale) return null;

  const saleWithPayment = sale as Sale & {
    payment_status?: string;
    total_revenue?: number;
  };
  const isPaid =
    String(saleWithPayment.payment_status ?? "").toLowerCase() === "paid";
  const totalRevenue = saleWithPayment.total_revenue ?? 0;
  const paidSoFar = paymentHistory.reduce((sum, e) => sum + e.amount, 0);
  const remaining = Math.max(0, totalRevenue - paidSoFar);

  async function handleAddPayment() {
    if (!sale) return;
    const amt = Number.parseFloat(addAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      await addPaymentEntry.mutateAsync({
        saleId: sale.id,
        amount: amt,
        paymentMethod: addMethod,
        recordedBy: currentUserName,
      });
      toast.success("Payment recorded");
      setAddAmount("");
      setAddMethod("cash");
      setShowAddForm(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to record payment";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md max-h-[85vh] overflow-y-auto"
        data-ocid="sales.payments.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wallet className="w-4 h-4 text-primary" />
            Payments — Order #{sale.id.toString()}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {sale.customer_name} · Total: {formatCurrency(totalRevenue)}
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/30 border border-border p-3 text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-semibold text-foreground">
                {formatCurrency(totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-sm font-semibold text-primary">
                {formatCurrency(paidSoFar)}
              </p>
            </div>
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-center">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-sm font-semibold text-destructive">
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          {/* Payment history */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Payment History
            </p>
            {loadingHistory ? (
              <div
                className="space-y-2"
                data-ocid="sales.payments.loading_state"
              >
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-lg" />
                ))}
              </div>
            ) : paymentHistory.length === 0 ? (
              <div
                className="text-center py-6 text-sm text-muted-foreground rounded-lg border border-dashed border-border"
                data-ocid="sales.payments.history.empty_state"
              >
                No payments recorded yet
              </div>
            ) : (
              <div className="space-y-2">
                {paymentHistory.map((entry, idx) => (
                  <div
                    key={entry.id.toString()}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                    data-ocid={`sales.payments.history.item.${idx + 1}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {formatCurrency(entry.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {PAYMENT_MODE_LABELS[entry.payment_method] ??
                          entry.payment_method}
                        {entry.recorded_by && ` · ${entry.recorded_by}`}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDate(entry.recorded_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add payment form */}
          {!isPaid &&
            remaining > 0 &&
            (showAddForm ? (
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold text-foreground">
                  Add Payment
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="pay-amount" className="text-xs">
                      Amount (₹)
                    </Label>
                    <Input
                      id="pay-amount"
                      type="number"
                      min={0.01}
                      max={remaining}
                      step={0.01}
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                      placeholder={`Max ${remaining.toFixed(2)}`}
                      className="h-8 text-sm"
                      data-ocid="sales.payments.amount_input"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pay-method" className="text-xs">
                      Method
                    </Label>
                    <Select value={addMethod} onValueChange={setAddMethod}>
                      <SelectTrigger
                        id="pay-method"
                        className="h-8 text-xs"
                        data-ocid="sales.payments.method_select"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PAYMENT_MODE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs">
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={handleAddPayment}
                    disabled={addPaymentEntry.isPending || !addAmount}
                    data-ocid="sales.payments.record_button"
                  >
                    {addPaymentEntry.isPending
                      ? "Recording…"
                      : "Record Payment"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddAmount("");
                    }}
                    data-ocid="sales.payments.cancel_button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setShowAddForm(true)}
                data-ocid="sales.payments.add_payment_button"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Payment
              </Button>
            ))}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-ocid="sales.payments.close_button"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Return Order Dialog (full per-item form) ─────────────────────────────────

interface ReturnOrderDialogProps {
  sale: Sale | null;
  onClose: () => void;
  profileKey: string;
  warehouseId: string;
  currentUserId: string;
  products: Product[];
}

interface ReturnItemRow {
  productId: bigint;
  productName: string;
  originalQty: number;
  returnQty: number;
  unitPrice: number;
  isUsable: boolean;
}

function ReturnOrderDialog({
  sale,
  onClose,
  profileKey,
  warehouseId,
  currentUserId,
  products: _products,
}: ReturnOrderDialogProps) {
  const { data: originalItems = [], isLoading: loadingItems } = useGetSaleItems(
    sale?.id ?? null,
  );
  const createReturnOrder = useCreateReturnOrder();

  const [rows, setRows] = useState<ReturnItemRow[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize rows from original items
  useEffect(() => {
    if (!initialized && originalItems.length > 0) {
      setRows(
        originalItems.map((item) => ({
          productId: item.product_id,
          productName: item.product_name_snapshot ?? "Unknown",
          originalQty: Number(item.quantity ?? 0),
          returnQty: Number(item.quantity ?? 0),
          unitPrice: item.actual_sale_price ?? 0,
          isUsable: true,
        })),
      );
      setInitialized(true);
    }
  }, [originalItems, initialized]);

  if (!sale) return null;

  // Validate 20-day rule
  const saleMs = Number((sale.timestamp ?? BigInt(0)) / BigInt(1_000_000));
  const daysDiff = (Date.now() - saleMs) / (1000 * 60 * 60 * 24);
  const is20DayBlocked = daysDiff > 20;
  const saleDateStr = new Date(saleMs).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const selectedRows = rows.filter((r) => r.returnQty > 0);

  async function handleSubmit() {
    if (!sale) return;
    setValidationError(null);

    if (is20DayBlocked) {
      setValidationError(
        `Return not allowed — sale was on ${saleDateStr} (more than 20 days ago).`,
      );
      return;
    }
    if (selectedRows.length === 0) {
      setValidationError("Select at least one item to return.");
      return;
    }

    const items: ReturnOrderItem[] = selectedRows.map((r) => ({
      product_id: r.productId,
      quantity: BigInt(r.returnQty),
      actual_sale_price: r.unitPrice,
      is_usable: r.isUsable,
    }));

    try {
      await createReturnOrder.mutateAsync({
        originalSaleId: sale.id,
        profileKey,
        warehouseId,
        customerId: sale.customer_id ?? BigInt(0),
        items,
        returnedBy: currentUserId,
      });
      toast.success(
        "Return order created. Usable items added to Stage Inventory for review.",
      );
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create return order";
      toast.error(msg);
    }
  }

  const usableCount = selectedRows.filter((r) => r.isUsable).length;
  const nonUsableCount = selectedRows.filter((r) => !r.isUsable).length;

  return (
    <Dialog open={!!sale} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-ocid="sales.return_order.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="w-4 h-4 text-destructive" />
            Return Order — #{sale.id.toString()}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {sale.customer_name} · Sale date: {saleDateStr}
          </p>
        </DialogHeader>

        {/* 20-day block warning */}
        {is20DayBlocked && (
          <div
            className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5"
            data-ocid="sales.return_order.blocked.error_state"
          >
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">
              Return not allowed — sale was on {saleDateStr}, which is more than
              20 days ago.
            </p>
          </div>
        )}

        {loadingItems ? (
          <div className="space-y-2 py-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select items to return
            </p>

            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No items found
              </p>
            ) : (
              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <div
                    key={row.productId.toString()}
                    className={`rounded-lg border p-3 space-y-2 transition-colors ${
                      row.returnQty > 0
                        ? "border-primary/30 bg-primary/3"
                        : "border-border bg-card opacity-60"
                    }`}
                    data-ocid={`sales.return_order.item.${idx + 1}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {row.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ₹{(row.unitPrice ?? 0).toFixed(2)} · Orig qty:{" "}
                          {row.originalQty}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      returnQty: Math.max(0, r.returnQty - 1),
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <Input
                          type="number"
                          min={0}
                          max={row.originalQty}
                          value={row.returnQty}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value, 10);
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      returnQty: Number.isNaN(v)
                                        ? 0
                                        : Math.min(v, r.originalQty),
                                    }
                                  : r,
                              ),
                            );
                          }}
                          className="h-6 w-12 text-center text-xs px-0.5"
                          data-ocid={`sales.return_order.qty_input.${idx + 1}`}
                        />
                        <button
                          type="button"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted"
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      returnQty: Math.min(
                                        r.originalQty,
                                        r.returnQty + 1,
                                      ),
                                    }
                                  : r,
                              ),
                            )
                          }
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Usable / Non-usable toggle */}
                    {row.returnQty > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, isUsable: true } : r,
                              ),
                            )
                          }
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                            row.isUsable
                              ? "border-primary/50 bg-primary/10 text-primary font-medium"
                              : "border-border text-muted-foreground hover:border-primary/30"
                          }`}
                          data-ocid={`sales.return_order.usable_toggle.${idx + 1}`}
                          aria-pressed={row.isUsable}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Usable
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setRows((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, isUsable: false } : r,
                              ),
                            )
                          }
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border transition-colors ${
                            !row.isUsable
                              ? "border-destructive/50 bg-destructive/10 text-destructive font-medium"
                              : "border-border text-muted-foreground hover:border-destructive/30"
                          }`}
                          data-ocid={`sales.return_order.nonusable_toggle.${idx + 1}`}
                          aria-pressed={!row.isUsable}
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                          Non-usable
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Summary */}
            {selectedRows.length > 0 && (
              <div
                className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/30 text-xs"
                data-ocid="sales.return_order.summary.section"
              >
                <span className="text-muted-foreground">
                  {selectedRows.length} item(s) selected:
                </span>
                {usableCount > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <CheckCircle2 className="w-3 h-3" />
                    {usableCount} usable → Stage Inventory
                  </span>
                )}
                {nonUsableCount > 0 && (
                  <span className="flex items-center gap-1 text-destructive">
                    <Trash2 className="w-3 h-3" />
                    {nonUsableCount} written off
                  </span>
                )}
              </div>
            )}

            {/* Validation error */}
            {validationError && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5"
                data-ocid="sales.return_order.validation.error_state"
              >
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{validationError}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            data-ocid="sales.return_order.cancel_button"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              createReturnOrder.isPending ||
              is20DayBlocked ||
              selectedRows.length === 0
            }
            data-ocid="sales.return_order.submit_button"
          >
            {createReturnOrder.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Processing…
              </span>
            ) : (
              "Create Return Order"
            )}
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
  onViewSale,
  onPrintReceipt,
  canEdit,
  profileKey,
  warehouseId,
  currentUserId,
  products,
}: {
  sales: Sale[];
  isLoading: boolean;
  onEditSale: (sale: Sale) => void;
  onViewSale: (sale: Sale) => void;
  onPrintReceipt: (sale: Sale) => void;
  canEdit: boolean;
  profileKey: string;
  warehouseId: string;
  currentUserId: string;
  products: Product[];
}) {
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [paymentSale, setPaymentSale] = useState<Sale | null>(null);
  const updatePaymentStatus = useUpdatePaymentStatus();
  const { data: profileUsers = [] } = useGetUsersByProfile(profileKey || null);

  const sorted = useMemo(
    () => [...sales].sort((a, b) => Number(b.timestamp) - Number(a.timestamp)),
    [sales],
  );

  // Build a map of principal → display name
  const userNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of profileUsers) {
      const uid =
        typeof u.principal?.toText === "function"
          ? u.principal.toText()
          : String(u.principal);
      map[uid] = u.display_name || `${uid.slice(0, 10)}…`;
    }
    return map;
  }, [profileUsers]);

  async function handleQuickStatusUpdate(sale: Sale, newStatus: string) {
    // Lock paid orders — no change allowed
    const saleWithStatus = sale as Sale & { payment_status?: string };
    const currentStatus = String(saleWithStatus.payment_status ?? "");
    if (currentStatus.toLowerCase() === "paid") {
      toast.info("Paid orders cannot be changed");
      return;
    }
    try {
      const s = sale as Sale & {
        payment_mode?: string;
        amount_paid?: number;
      };
      await updatePaymentStatus.mutateAsync({
        saleId: sale.id,
        status: newStatus,
        paymentMode: s.payment_mode ?? "cash",
        amountPaid:
          newStatus === "paid"
            ? sale.total_revenue
            : newStatus === "unpaid"
              ? 0
              : (s.amount_paid ?? 0),
      });
      toast.success("Payment status updated");
    } catch {
      toast.error("Failed to update payment status");
    }
  }

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
    <>
      <div className="space-y-3">
        {sorted.map((sale, idx) => {
          const saleWithPayment = sale as Sale & {
            payment_status?: string;
            payment_mode?: string;
            discount_applied?: number;
            payment_due_date?: string;
            sold_by?: string;
          };
          const paymentStatus = saleWithPayment.payment_status ?? "paid";
          const paymentMode = saleWithPayment.payment_mode;
          const discountApplied = saleWithPayment.discount_applied ?? 0;
          const isReturned = (paymentStatus as string) === "returned";
          const isPaid = (paymentStatus as string) === "paid";
          const soldByName = saleWithPayment.sold_by
            ? (userNameMap[saleWithPayment.sold_by] ??
              `${saleWithPayment.sold_by.slice(0, 10)}…`)
            : null;

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
                    <User className="w-3 h-3" />{" "}
                    {sale.customer_name ?? "Unknown"}
                  </p>
                  {soldByName && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Sold by:{" "}
                      <span className="font-medium text-foreground">
                        {soldByName}
                      </span>
                    </p>
                  )}
                  {saleWithPayment.payment_due_date && !isReturned && (
                    <p className="text-xs text-destructive mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Due:{" "}
                      {saleWithPayment.payment_due_date}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <p className="text-sm font-semibold text-primary">
                    {formatCurrency(sale.total_revenue ?? 0)}
                  </p>
                  {discountApplied > 0 && (
                    <p className="text-xs text-muted-foreground">
                      -{formatCurrency(discountApplied)} disc.
                    </p>
                  )}
                </div>
              </div>

              {/* Payment status — read-only badge for paid; quick-update select for unpaid/partial */}
              {!isReturned && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  {isPaid ? (
                    <Badge className="text-xs h-6 px-2 bg-primary/10 text-primary border border-primary/30">
                      Paid
                    </Badge>
                  ) : (
                    <Select
                      value={paymentStatus}
                      onValueChange={(v) => handleQuickStatusUpdate(sale, v)}
                    >
                      <SelectTrigger
                        className="h-6 text-xs w-28 px-2"
                        data-ocid={`sales.history.payment_status_select.${idx + 1}`}
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
                  )}
                </div>
              )}

              <div className="mt-3 flex justify-end gap-2 flex-wrap">
                {/* Payments button — shown for unpaid/partial orders */}
                {!isReturned && !isPaid && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => setPaymentSale(sale)}
                    data-ocid={`sales.history.payments_button.${idx + 1}`}
                  >
                    <Wallet className="w-3 h-3" />
                    Payments
                  </Button>
                )}
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
                {canEdit && !isReturned ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onEditSale(sale)}
                      data-ocid={`sales.history.edit_button.${idx + 1}`}
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
                      onClick={() => setReturnSale(sale)}
                      data-ocid={`sales.history.return_button.${idx + 1}`}
                    >
                      <RefreshCw className="w-3 h-3" />
                      Return
                    </Button>
                  </>
                ) : (
                  !isReturned && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => onViewSale(sale)}
                      data-ocid={`sales.history.view_button.${idx + 1}`}
                    >
                      <Package className="w-3 h-3" />
                      View
                    </Button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ReturnOrderDialog
        sale={returnSale}
        onClose={() => setReturnSale(null)}
        profileKey={profileKey}
        warehouseId={warehouseId}
        currentUserId={currentUserId}
        products={products}
      />

      <PaymentsDialog
        sale={paymentSale}
        onClose={() => setPaymentSale(null)}
        currentUserName={currentUserId}
      />
    </>
  );
}

// ─── Sales Page ───────────────────────────────────────────────────────────────

export function SalesPage({ onNavigate }: SalesPageProps) {
  const { userProfile, profile } = useProfile();
  const warehouseName = userProfile?.warehouse_name ?? "";
  const profileKey = userProfile?.profile_key ?? profile?.profile_key ?? "";

  const canEdit =
    userProfile?.role === UserRole.admin ||
    userProfile?.role === UserRole.superAdmin;

  const { data: products = [], isLoading: loadingProducts } = useGetProducts();
  const { data: inventoryLevels = [], isLoading: loadingInventory } =
    useGetInventoryLevels();
  const { data: rawCustomers = [], isLoading: loadingCustomers } =
    useGetCustomers();
  const {
    data: sales = [],
    isLoading: loadingSales,
    error: salesError,
  } = useGetSales();
  const createSale = useCreateSale();

  const customers: CustomerPublicWithDiscount[] = useMemo(
    () =>
      rawCustomers.map((c) => {
        const stored = getStoredCustomerDiscount(c.id.toString());
        const notesText = c.notes.length > 0 ? c.notes[0].text : stored.notes;
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
  const [autoFillDismissed, setAutoFillDismissed] = useState(false);
  const [autoFillDate, setAutoFillDate] = useState<string | null>(null);
  const [returnBlockMsg, setReturnBlockMsg] = useState<string | null>(null);
  // Track which product IDs were in the last order (for return validation)
  const [lastOrderProductIds, setLastOrderProductIds] = useState<Set<string>>(
    new Set(),
  );

  const [paymentMode, setPaymentMode] = useState("cash");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [saleNote, setSaleNote] = useState("");
  const [paymentDueDate, setPaymentDueDate] = useState("");
  const [orderType, setOrderType] = useState("standard");

  // Goal bundle pre-fill prompt state
  // null = no prompt, { bundles, hasLastOrder } = show prompt
  const [goalBundlePrompt, setGoalBundlePrompt] = useState<{
    bundledProductIds: bigint[];
    hasLastOrder: boolean;
  } | null>(null);

  // Fetch goal master data for the profile
  const { data: goalMasterData = [] } = useGetGoalMasterData(
    profileKey || null,
  );

  // Fetch last sale for selected customer
  const { data: lastSale, isFetching: fetchingLastSale } =
    useGetLastSaleForCustomer(selectedCustomer?.id ?? null);

  // When customer changes, check if they have goal-based product bundles to offer
  useEffect(() => {
    if (!selectedCustomer || fetchingLastSale) return;
    if (orderType === "return") return;
    if (cart.length > 0) return; // only trigger when cart is empty

    const primaryGoalIds: bigint[] =
      (
        selectedCustomer as CustomerPublicWithDiscount & {
          primary_goal_ids?: bigint[];
        }
      ).primary_goal_ids ?? [];

    if (primaryGoalIds.length === 0 || goalMasterData.length === 0) return;

    // Collect unique product IDs from all goals this customer has
    const bundledIds = new Set<string>();
    for (const goalId of primaryGoalIds) {
      const goal = goalMasterData.find(
        (g) => g.id.toString() === goalId.toString(),
      );
      if (goal) {
        for (const pid of goal.product_bundle) {
          bundledIds.add(pid.toString());
        }
      }
    }

    if (bundledIds.size === 0) return;

    // Only show bundle prompt if there are bundled products available in inventory
    const availableBundled = [...bundledIds]
      .map((idStr) => products.find((p) => p.id.toString() === idStr))
      .filter(
        (p): p is Product =>
          p !== undefined &&
          getStockForWarehouse(p.id, inventoryLevels, warehouseName) >
            BigInt(0),
      );

    if (availableBundled.length === 0) return;

    setGoalBundlePrompt({
      bundledProductIds: availableBundled.map((p) => p.id),
      hasLastOrder: !!lastSale,
    });
  }, [
    selectedCustomer,
    fetchingLastSale,
    goalMasterData,
    products,
    inventoryLevels,
    warehouseName,
    orderType,
    cart.length,
    lastSale,
  ]);

  // Auto-fill cart when customer is selected and lastSale loads (Standard orders only)
  useEffect(() => {
    if (!selectedCustomer || fetchingLastSale || !lastSale) return;
    if (orderType === "return") return;
    if (autoFillDismissed) return;
    // Only auto-fill if cart is currently empty
    if (cart.length > 0) return;

    const newCart: CartEntry[] = [];
    for (const item of lastSale.items) {
      const product = products.find(
        (p) => p.id.toString() === item.product_id.toString(),
      );
      if (product) {
        newCart.push({
          product,
          quantity: Number(item.quantity),
          salePrice: item.actual_sale_price,
          product_instructions: (product as Product & { instructions?: string })
            .instructions,
        });
      }
    }
    if (newCart.length > 0) {
      setCart(newCart);
      if (lastSale.sale_note) setSaleNote(lastSale.sale_note);
      const dateStr = formatDate(lastSale.timestamp);
      setAutoFillDate(dateStr);
      setGoalBundlePrompt(null);
    }
  }, [
    selectedCustomer,
    lastSale,
    fetchingLastSale,
    products,
    orderType,
    autoFillDismissed,
    cart.length,
  ]);

  // Reset auto-fill dismissed state when customer changes (using ref to avoid lint warning)
  const prevCustomerIdRef = useRef<string | null>(null);
  useEffect(() => {
    const customerId = selectedCustomer?.id?.toString() ?? null;
    if (prevCustomerIdRef.current !== customerId) {
      prevCustomerIdRef.current = customerId;
      setAutoFillDismissed(false);
      setAutoFillDate(null);
      setReturnBlockMsg(null);
      setLastOrderProductIds(new Set());
    }
  });

  // Handle order type change — validate return orders
  const handleOrderTypeChange = (newType: string) => {
    if (newType === "return") {
      if (!selectedCustomer) {
        toast.error("Select a customer before switching to Return order");
        return;
      }
      if (!lastSale) {
        toast.error("No previous order found for this customer");
        return;
      }
      // Validate: last sale must be within 20 days
      const saleMs = Number(lastSale.timestamp / BigInt(1_000_000));
      const daysDiff = (Date.now() - saleMs) / (1000 * 60 * 60 * 24);
      if (daysDiff > 20) {
        const saleDate = new Date(saleMs).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        setReturnBlockMsg(
          `Return not allowed — last sale was on ${saleDate}, which is more than 20 days ago.`,
        );
        toast.error(
          `Return not allowed — last sale was on ${saleDate}, which is more than 20 days ago.`,
        );
        return; // Stay on standard
      }
      // Build set of product IDs from last order for validation
      const productIds = new Set(
        lastSale.items.map((i) => i.product_id.toString()),
      );
      setLastOrderProductIds(productIds);
      setReturnBlockMsg(null);
      // Clear cart when switching to return — user must re-add items
      setCart([]);
    } else {
      setReturnBlockMsg(null);
      setLastOrderProductIds(new Set());
    }
    setOrderType(newType);
  };

  const addToCart = (product: Product, isLoaned = false) => {
    // Return order validation: item must be in last order
    if (orderType === "return" && lastOrderProductIds.size > 0) {
      if (!lastOrderProductIds.has(product.id.toString())) {
        toast.error(
          `"${product.name}" was not part of the last order and cannot be returned.`,
        );
        return;
      }
    }
    setCart((prev) => {
      if (prev.find((e) => e.product.id.toString() === product.id.toString()))
        return prev;
      const productWithInstructions = product as Product & {
        instructions?: string;
      };
      return [
        ...prev,
        {
          product,
          quantity: 1,
          salePrice: product.mrp,
          product_instructions: productWithInstructions.instructions,
          is_loaned_item: isLoaned,
          is_usable: true,
        },
      ];
    });
  };

  const toggleCartItemUsable = (id: bigint, isUsable: boolean) => {
    setCart((prev) =>
      prev.map((e) =>
        e.product.id.toString() === id.toString()
          ? { ...e, is_usable: isUsable }
          : e,
      ),
    );
  };

  const handleCopyPreviousOrder = (
    items: Array<{ productId: bigint; qty: number; price: number }>,
    note: string,
  ) => {
    const newCart: CartEntry[] = [];
    for (const item of items) {
      const product = products.find(
        (p) => p.id.toString() === item.productId.toString(),
      );
      if (product) {
        newCart.push({
          product,
          quantity: item.qty,
          salePrice: item.price,
          product_instructions: (product as Product & { instructions?: string })
            .instructions,
        });
      }
    }
    if (newCart.length > 0) {
      setCart(newCart);
      if (note) setSaleNote(note);
      setAutoFillDismissed(true);
      setAutoFillDate(null);
      setGoalBundlePrompt(null);
      toast.success("Previous order loaded into cart");
    }
  };

  const handleFillFromGoalBundles = () => {
    if (!goalBundlePrompt) return;
    const newCart: CartEntry[] = [];
    for (const productId of goalBundlePrompt.bundledProductIds) {
      const product = products.find(
        (p) => p.id.toString() === productId.toString(),
      );
      if (product) {
        newCart.push({
          product,
          quantity: 1,
          salePrice: product.mrp,
          product_instructions: (product as Product & { instructions?: string })
            .instructions,
          is_usable: true,
        });
      }
    }
    if (newCart.length > 0) {
      setCart(newCart);
      setAutoFillDismissed(true);
      setAutoFillDate(null);
      setGoalBundlePrompt(null);
      toast.success(
        `Cart pre-filled with ${newCart.length} product${newCart.length === 1 ? "" : "s"} from customer's goals`,
      );
    }
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
    // Validate stock for all items before submitting
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
      ...(e.product_instructions && {
        product_instructions: e.product_instructions,
      }),
      ...(e.is_loaned_item !== undefined && {
        is_loaned_item: e.is_loaned_item,
      }),
    }));

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

    try {
      const rawResult = await createSale.mutateAsync({
        cart_items: cartItems,
        customer_id: selectedCustomer.id,
        ...(discountAmount > 0 && {
          discount_applied: discountAmount,
          discount_type: selectedCustomer.discount_applicable,
          original_subtotal: subtotal,
        }),
        payment_mode: paymentMode,
        payment_status: paymentStatus,
        amount_paid: effectiveAmountPaid,
        balance_due: Math.max(0, finalTotal - effectiveAmountPaid),
        ...(saleNote.trim() && { sale_note: saleNote.trim() }),
        ...(paymentDueDate && { payment_due_date: paymentDueDate }),
      });

      // Safely extract the bigint sale ID — backend may return bare bigint or { id: bigint }
      const saleId = extractSaleId(rawResult);
      if (!saleId) {
        toast.error(
          "Sale failed — insufficient inventory. Please refresh and try again.",
        );
        return;
      }

      setCart([]);
      setSelectedCustomer(null);
      setPaymentMode("cash");
      setPaymentStatus("paid");
      setAmountPaid(0);
      setSaleNote("");
      setPaymentDueDate("");
      setOrderType("standard");
      setAutoFillDismissed(false);
      setAutoFillDate(null);
      setGoalBundlePrompt(null);
      toast.success("Sale confirmed!");
      onNavigate("/receipt", saleId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("stock")
      ) {
        toast.error(
          "Sale failed — one or more items are out of stock. Please review your cart.",
        );
      } else if (msg.toLowerCase().includes("customer")) {
        toast.error(
          "Sale failed — customer not found. Please re-select the customer.",
        );
      } else if (
        msg.toLowerCase().includes("actor") ||
        msg.toLowerCase().includes("ready")
      ) {
        toast.error("Connection issue — please wait a moment and try again.");
      } else {
        toast.error("Failed to create sale. Please try again.");
      }
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
                      onSelect={(c) => {
                        setSelectedCustomer(c);
                        if (!c) {
                          setCart([]);
                          setAutoFillDismissed(false);
                          setAutoFillDate(null);
                          setGoalBundlePrompt(null);
                        }
                      }}
                      onQuickAdd={() => setShowQuickAdd(true)}
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Return block message */}
          {returnBlockMsg && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-destructive/30 bg-destructive/5"
              data-ocid="sales.return_block.error_state"
            >
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{returnBlockMsg}</p>
            </div>
          )}

          {/* Auto-fill banner */}
          {autoFillDate && !autoFillDismissed && cart.length > 0 && (
            <div
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-primary/30 bg-primary/5"
              data-ocid="sales.autofill.banner"
            >
              <div className="flex items-center gap-2 min-w-0">
                <RefreshCw className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <p className="text-xs text-primary truncate">
                  Cart pre-filled from last order on {autoFillDate}
                </p>
              </div>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                onClick={() => {
                  setCart([]);
                  setSaleNote("");
                  setAutoFillDismissed(true);
                  setAutoFillDate(null);
                }}
                aria-label="Dismiss auto-fill"
                data-ocid="sales.autofill.dismiss_button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Goal bundle pre-fill prompt */}
          {goalBundlePrompt && cart.length === 0 && !autoFillDismissed && (
            <div
              className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 space-y-2"
              data-ocid="sales.goal_bundle.banner"
            >
              <div className="flex items-start gap-2">
                <Package className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-primary font-medium">
                  This customer has goals with product bundles (
                  {goalBundlePrompt.bundledProductIds.length} product
                  {goalBundlePrompt.bundledProductIds.length === 1 ? "" : "s"}
                  ). Pre-fill cart?
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleFillFromGoalBundles}
                  data-ocid="sales.goal_bundle.yes_button"
                >
                  Yes, use goal products
                </Button>
                {goalBundlePrompt.hasLastOrder && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setGoalBundlePrompt(null);
                      // trigger auto-fill from last order by clearing dismissed flag
                      setAutoFillDismissed(false);
                    }}
                    data-ocid="sales.goal_bundle.use_last_order_button"
                  >
                    Use last order instead
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => {
                    setGoalBundlePrompt(null);
                    setAutoFillDismissed(true);
                  }}
                  data-ocid="sales.goal_bundle.no_button"
                >
                  No, start empty
                </Button>
              </div>
            </div>
          )}

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
              <div className="lg:col-span-2 space-y-3">
                {/* Last order summary panel */}
                {selectedCustomer && (
                  <LastOrderSummary
                    customerId={selectedCustomer.id}
                    onCopyOrder={handleCopyPreviousOrder}
                  />
                )}

                <Card
                  className="card-elevated"
                  data-ocid="sales.products.panel"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Package className="w-4 h-4 text-primary" />
                      Products
                      {orderType === "return" && (
                        <Badge
                          variant="outline"
                          className="text-xs border-destructive/40 text-destructive ml-1"
                        >
                          Return — only last order items allowed
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[460px] flex flex-col">
                    <ProductSearchPanel
                      products={products}
                      inventoryLevels={inventoryLevels}
                      warehouseName={warehouseName}
                      onAddToCart={addToCart}
                      cartEntries={cart}
                    />
                  </CardContent>
                </Card>
              </div>

              <Card className="card-elevated" data-ocid="sales.cart.panel">
                <CardContent className="pt-4 h-[560px] flex flex-col overflow-y-auto px-3">
                  <CartPanel
                    entries={cart}
                    selectedCustomer={selectedCustomer}
                    onUpdateQty={updateQty}
                    onUpdatePrice={updatePrice}
                    onRemove={removeFromCart}
                    onClear={() => {
                      setCart([]);
                      setAutoFillDismissed(true);
                      setAutoFillDate(null);
                    }}
                    onConfirm={confirmSale}
                    isConfirming={createSale.isPending}
                    inventoryLevels={inventoryLevels}
                    warehouseName={warehouseName}
                    paymentMode={paymentMode}
                    paymentStatus={paymentStatus}
                    amountPaid={amountPaid}
                    saleNote={saleNote}
                    paymentDueDate={paymentDueDate}
                    orderType={orderType}
                    onPaymentModeChange={setPaymentMode}
                    onPaymentStatusChange={setPaymentStatus}
                    onAmountPaidChange={setAmountPaid}
                    onSaleNoteChange={setSaleNote}
                    onPaymentDueDateChange={setPaymentDueDate}
                    onOrderTypeChange={handleOrderTypeChange}
                    onToggleUsable={toggleCartItemUsable}
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
              {salesError ? (
                <div
                  className="flex flex-col items-center gap-3 py-12 text-muted-foreground"
                  data-ocid="sales.history.error_state"
                >
                  <AlertCircle className="w-10 h-10 opacity-40 text-destructive" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      Failed to load orders
                    </p>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      Please refresh the page to try again
                    </p>
                  </div>
                </div>
              ) : (
                <OrderHistoryPanel
                  sales={sales}
                  isLoading={loadingSales}
                  onEditSale={(sale) => setEditSale(sale)}
                  onViewSale={(sale) => setViewSale(sale)}
                  onPrintReceipt={(sale) => onNavigate("/receipt", sale.id)}
                  canEdit={canEdit}
                  profileKey={profileKey}
                  warehouseId={warehouseName}
                  currentUserId={userProfile?.display_name ?? ""}
                  products={products}
                />
              )}
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
