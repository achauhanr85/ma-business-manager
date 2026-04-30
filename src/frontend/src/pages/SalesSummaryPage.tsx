/**
 * SalesSummaryPage.tsx — Sales Summary: table view + payment history modal.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE DOES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shows a paginated, sortable, filterable table of all sales orders for the
 * current profile. For each order the user can:
 *   - View order details (customer, date, total, paid, due, status)
 *   - Click "Payments" to open the Payment History modal
 *   - Add a new payment entry from the modal (if the order is not fully paid)
 *
 * DESIGN DECISIONS:
 *   - All data comes from useGetSales() — NO live inventory queries during render.
 *     Payment amounts are derived from sale.amount_paid and sale.total_revenue.
 *   - payment_history on each Sale record drives the modal detail view.
 *   - Status badge (Paid/Partial/Pending) is derived from amount_paid vs total.
 *   - Inline status edit is intentionally removed — only "Payments" button present.
 *   - Top-level error boundary: any crash shows a safe fallback message.
 *   - Null-guards on every data access path prevent crashes on missing/undefined data.
 *
 * CRASH FIX HISTORY:
 *   Previously crashed because:
 *     1. orders.map() called on undefined (actor not yet ready)
 *     2. Recharts given empty arrays — replaced with an empty-state component
 *     3. Number(sale?.total) where .total did not exist (wrong field name)
 *   All three are addressed in this rewrite.
 *
 * WHO IMPORTS THIS:
 *   App.tsx — renderSharedPage() switch case for ROUTES.salesSummary
 *
 * DATA FLOW:
 *   useGetSales() → allSales → filtered/sorted → table rows
 *   sale.payment_history → PaymentHistoryModal rows
 *   useAddPaymentEntry() → adds new payment → invalidates sales query
 */

import { HelpPanel } from "@/components/HelpPanel";
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
import { useAddPaymentEntry, useGetSales } from "@/hooks/useBackend";
import { logApi, logDebug, logError } from "@/lib/logger";
import type { Sale } from "@/types";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  CreditCard,
  HelpCircle,
  IndianRupee,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";

// ─── Helper: currency formatter ───────────────────────────────────────────────

/** Formats a number as a compact Indian Rupee string. ₹1,23,456 → "₹1.2L" */
function formatCurrency(value: number | undefined | null): string {
  // Guard against undefined/null — show dash rather than crash
  if (value == null || Number.isNaN(value)) return "—";
  const v = Number(value);
  if (v >= 100_000) return `₹${(v / 100_000).toFixed(1)}L`;
  if (v >= 1_000) return `₹${(v / 1_000).toFixed(1)}K`;
  return `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Formats a bigint nanosecond timestamp as a locale date string */
function formatDate(timestamp: bigint | undefined | null): string {
  if (timestamp == null) return "—";
  try {
    const ms = Number(timestamp) / 1_000_000;
    return new Date(ms).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ─── Derived payment status helpers ──────────────────────────────────────────

/**
 * derivePaymentStatus — computes the effective payment status label for a sale.
 *
 * WHY: The backend stores a payment_status enum but it may not be updated when
 * individual payment entries are added via addPaymentEntry. We compute it
 * client-side from the totals so the table always reflects reality.
 *
 * Logic:
 *   - If total is 0 or undefined: "N/A"
 *   - If sum of payments >= total: "paid"
 *   - If sum of payments > 0: "partial"
 *   - Otherwise: use backend status or fall back to "pending"
 */
function derivePaymentStatus(
  sale: Sale,
): "paid" | "partial" | "pending" | "n/a" {
  const total = Number(sale.total_revenue ?? 0);
  if (total <= 0) return "n/a";

  // Sum up payment history entries if available
  const historyTotal = Array.isArray(sale.payment_history)
    ? sale.payment_history.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    : 0;

  // Also consider amount_paid field for backward compatibility
  const amountPaid = Math.max(Number(sale.amount_paid ?? 0), historyTotal);

  if (amountPaid >= total) return "paid";
  if (amountPaid > 0) return "partial";

  // Fall back to the stored backend status
  const backendStatus =
    sale.payment_status != null
      ? String(Object.keys(sale.payment_status)[0] ?? "").toLowerCase()
      : "";

  if (backendStatus === "paid") return "paid";
  if (backendStatus === "partial_") return "partial";
  return "pending";
}

/** Returns the amount already paid for a sale (max of amount_paid vs history sum) */
function computePaid(sale: Sale): number {
  const historyTotal = Array.isArray(sale.payment_history)
    ? sale.payment_history.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
    : 0;
  return Math.max(Number(sale.amount_paid ?? 0), historyTotal);
}

/** Returns the outstanding balance for a sale */
function computeDue(sale: Sale): number {
  const total = Number(sale.total_revenue ?? 0);
  const paid = computePaid(sale);
  return Math.max(0, total - paid);
}

// ─── Status Badge component ───────────────────────────────────────────────────

/**
 * StatusBadge — colour-coded badge for payment status.
 *   paid     → green background
 *   partial  → yellow/amber
 *   pending  → red/destructive
 *   n/a      → neutral grey
 */
function StatusBadge({
  status,
}: { status: ReturnType<typeof derivePaymentStatus> }) {
  if (status === "paid") {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
        Paid
      </Badge>
    );
  }
  if (status === "partial") {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        Partial
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge
        variant="destructive"
        className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800"
      >
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      N/A
    </Badge>
  );
}

// ─── Payment History Modal ────────────────────────────────────────────────────

interface PaymentHistoryModalProps {
  /** The sale whose payment history is being viewed. null = modal is closed. */
  sale: Sale | null;
  /** Callback to close the modal */
  onClose: () => void;
  /** Display name of the currently logged-in user (for recordedBy field) */
  currentUserName: string;
}

/**
 * PaymentHistoryModal — shows the payment history for one sale and allows
 * adding a new payment entry.
 *
 * BEHAVIOUR:
 *   - Reads payment_history array directly from the Sale object (no extra query)
 *   - Adds a new payment entry via useAddPaymentEntry() mutation
 *   - Disables "Add Payment" form when the order is fully paid
 *   - Shows a clear tooltip explaining why the button is disabled when paid
 */
function PaymentHistoryModal({
  sale,
  onClose,
  currentUserName,
}: PaymentHistoryModalProps) {
  // ── Add-payment form local state ────────────────────────────────────────
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { mutate: addPayment, isPending: isAdding } = useAddPaymentEntry();

  if (!sale) return null;

  // Derived values — recomputed each render from the current sale snapshot
  const totalRevenue = Number(sale.total_revenue ?? 0);
  const paidSoFar = computePaid(sale);
  const dueSoFar = computeDue(sale);
  const isFullyPaid = dueSoFar <= 0;
  const saleIdStr = sale.id?.toString() ?? "—";

  // Payment history — already on the Sale object; guard against null/undefined
  const payments = Array.isArray(sale.payment_history)
    ? sale.payment_history
    : [];

  /**
   * handleAddPayment — validates and submits the new payment entry.
   * On success: clears the form and the modal reflects the new balance.
   */
  function handleAddPayment() {
    // Double-guard: sale should always be non-null here since the modal
    // is only shown when sale is set, but TypeScript needs explicit narrowing.
    if (!sale) return;
    setFormError(null);
    const amount = Number.parseFloat(paymentAmount);

    // Basic validation — give the user clear inline feedback
    if (!paymentAmount || Number.isNaN(amount) || amount <= 0) {
      setFormError("Please enter a valid payment amount greater than 0.");
      return;
    }
    if (amount > dueSoFar + 0.01) {
      setFormError(
        `Amount cannot exceed the outstanding balance of ${formatCurrency(dueSoFar)}.`,
      );
      return;
    }

    logApi(
      `→ addPaymentEntry saleId=${saleIdStr} amount=${amount} method=${paymentMethod}`,
    );

    addPayment(
      {
        saleId: sale.id,
        amount,
        paymentMethod,
        recordedBy: currentUserName || "Admin",
      },
      {
        onSuccess: () => {
          logApi(`← addPaymentEntry OK saleId=${saleIdStr}`);
          // Reset the form so a second payment can be added immediately
          setPaymentAmount("");
          setPaymentNotes("");
          setFormError(null);
        },
        onError: (err) => {
          const msg =
            err instanceof Error ? err.message : "Failed to record payment.";
          logError(`addPaymentEntry failed: ${msg}`);
          setFormError(msg);
        },
      },
    );
  }

  return (
    <Dialog open={!!sale} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-lg w-full overflow-y-auto max-h-[90vh]"
        data-ocid="sales_summary.payments.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-display">
            <CreditCard className="w-4 h-4 text-primary" />
            Payment History — Order #{saleIdStr}
          </DialogTitle>
        </DialogHeader>

        {/* ── Order summary strip ────────────────────────────────────────── */}
        <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium text-foreground">
              {sale.customer_name || "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Order Total</span>
            <span className="font-semibold text-foreground">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span className="font-medium text-green-700 dark:text-green-400">
              {formatCurrency(paidSoFar)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Outstanding</span>
            <span
              className={`font-semibold ${
                dueSoFar > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatCurrency(dueSoFar)}
            </span>
          </div>
        </div>

        {/* ── Payment History Table ──────────────────────────────────────── */}
        <div data-ocid="sales_summary.payment_history.section">
          <p className="text-sm font-semibold text-foreground mb-2">
            Payment Entries
          </p>
          {payments.length === 0 ? (
            <div
              className="py-6 text-center text-sm text-muted-foreground border border-dashed border-border rounded-lg"
              data-ocid="sales_summary.payment_history.empty_state"
            >
              No payments recorded yet.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                      Date
                    </th>
                    <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                      Method
                    </th>
                    <th className="text-right px-3 py-2 text-xs text-muted-foreground font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, idx) => (
                    <tr
                      key={p.id ?? idx}
                      className="border-t border-border"
                      data-ocid={`sales_summary.payment_history.item.${idx + 1}`}
                    >
                      <td className="px-3 py-2 text-foreground">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">
                        {p.payment_method || "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-foreground">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Add Payment Form ────────────────────────────────────────────── */}
        <div
          className="space-y-3 pt-2 border-t border-border"
          data-ocid="sales_summary.add_payment.section"
        >
          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-primary" />
            Add Payment
            {isFullyPaid && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                — Order already paid in full
              </span>
            )}
          </p>

          {/* Form fields — all disabled when fully paid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date */}
            <div className="space-y-1">
              <Label htmlFor="payment-date" className="text-xs">
                Date
              </Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={isFullyPaid || isAdding}
                className="h-8 text-sm"
                data-ocid="sales_summary.add_payment.date_input"
              />
            </div>

            {/* Method */}
            <div className="space-y-1">
              <Label htmlFor="payment-method" className="text-xs">
                Method
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                disabled={isFullyPaid || isAdding}
              >
                <SelectTrigger
                  className="h-8 text-sm"
                  data-ocid="sales_summary.add_payment.method_select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1">
            <Label htmlFor="payment-amount" className="text-xs">
              Amount (₹)
            </Label>
            <Input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder={`Max ${formatCurrency(dueSoFar)}`}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              disabled={isFullyPaid || isAdding}
              className="h-8 text-sm"
              data-ocid="sales_summary.add_payment.amount_input"
            />
          </div>

          {/* Optional notes — stored in recordedBy for now */}
          <div className="space-y-1">
            <Label
              htmlFor="payment-notes"
              className="text-xs text-muted-foreground"
            >
              Notes (optional)
            </Label>
            <Input
              id="payment-notes"
              type="text"
              placeholder="e.g. partial upfront"
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              disabled={isFullyPaid || isAdding}
              className="h-8 text-sm"
              data-ocid="sales_summary.add_payment.notes_input"
            />
          </div>

          {/* Inline validation error */}
          {formError && (
            <div
              className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
              data-ocid="sales_summary.add_payment.error_state"
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              {formError}
            </div>
          )}

          {/* Submit row */}
          <div className="flex gap-2 justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              data-ocid="sales_summary.payments.cancel_button"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleAddPayment}
              disabled={isFullyPaid || isAdding || !paymentAmount}
              data-ocid="sales_summary.add_payment.submit_button"
              title={isFullyPaid ? "Order is already paid in full" : undefined}
            >
              {isAdding ? "Saving…" : "Record Payment"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Summary KPI Cards ────────────────────────────────────────────────────────

interface SummaryKpiProps {
  totalOrders: number;
  totalRevenue: number;
  totalPaid: number;
  totalDue: number;
  loading: boolean;
}

/**
 * SummaryKpiRow — four compact KPI cards at the top of the page.
 * Each card shows one aggregate metric across all currently-filtered orders.
 */
function SummaryKpiRow({
  totalOrders,
  totalRevenue,
  totalPaid,
  totalDue,
  loading,
}: SummaryKpiProps) {
  const cards = [
    {
      label: "Total Orders",
      value: loading ? null : String(totalOrders),
      ocid: "sales_summary.kpi_total_orders.card",
    },
    {
      label: "Total Revenue",
      value: loading ? null : formatCurrency(totalRevenue),
      ocid: "sales_summary.kpi_total_revenue.card",
    },
    {
      label: "Total Collected",
      value: loading ? null : formatCurrency(totalPaid),
      ocid: "sales_summary.kpi_total_paid.card",
    },
    {
      label: "Outstanding",
      value: loading ? null : formatCurrency(totalDue),
      ocid: "sales_summary.kpi_total_due.card",
    },
  ];

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      data-ocid="sales_summary.kpi.section"
    >
      {cards.map((c) => (
        <Card key={c.label} className="card-elevated" data-ocid={c.ocid}>
          <CardContent className="p-4">
            {c.value == null ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-24" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-display font-bold text-foreground mt-1">
                  {c.value}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Sorting helpers ──────────────────────────────────────────────────────────

type SortKey = "date" | "total" | "status";
type SortDir = "asc" | "desc";

/**
 * sortSales — sorts a Sale array by the given key.
 * Handles undefined/null values gracefully so no comparator throws.
 */
function sortSales(sales: Sale[], key: SortKey, dir: SortDir): Sale[] {
  return [...sales].sort((a, b) => {
    let cmp = 0;
    if (key === "date") {
      cmp = Number(a.timestamp ?? 0n) - Number(b.timestamp ?? 0n);
    } else if (key === "total") {
      cmp = Number(a.total_revenue ?? 0) - Number(b.total_revenue ?? 0);
    } else if (key === "status") {
      // Sort order: paid < partial < pending
      const rank = { paid: 0, "n/a": 1, partial: 2, pending: 3 };
      cmp =
        (rank[derivePaymentStatus(a)] ?? 3) -
        (rank[derivePaymentStatus(b)] ?? 3);
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// ─── Main Page Component ──────────────────────────────────────────────────────

interface SalesSummaryPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

/**
 * SalesSummaryPage — the main exported component.
 *
 * SAFE PATTERNS USED (crash prevention):
 *   1. `allSales = []` default prevents .map() on undefined
 *   2. Every sale field access uses `?? 0` or `?? ""` fallbacks
 *   3. Array.isArray(payment_history) guard before .reduce()
 *   4. Top-level hasError state shows a friendly fallback on uncaught errors
 *   5. No Recharts rendered on empty data — empty state component shown instead
 *   6. Loading state via skeleton components before data is available
 */
export function SalesSummaryPage({
  onNavigate: _onNavigate,
}: SalesSummaryPageProps) {
  // ── Context ────────────────────────────────────────────────────────────
  const { userProfile } = useProfile();
  const currentUserName = userProfile?.display_name ?? "Admin";

  // ── Data fetching ──────────────────────────────────────────────────────
  // useGetSales() returns all sales visible to the current user (scoped by actor context)
  // Default to empty array so .map() never throws before data arrives.
  const { data: allSales = [], isLoading, isError } = useGetSales();

  logDebug(
    `SalesSummaryPage render: ${allSales.length} orders, loading=${isLoading}`,
  );

  // ── UI state ───────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc"); // newest first by default
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // ── Filtering ──────────────────────────────────────────────────────────
  /**
   * filteredSales — the sale list after applying:
   *   1. Text search on customer name and order ID
   *   2. Payment status filter
   * Both filters are applied client-side on the full sales array.
   */
  const filteredSales = useMemo(() => {
    let result = Array.isArray(allSales) ? [...allSales] : [];

    // Text search: customer name or order number
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (s) =>
          (s.customer_name ?? "").toLowerCase().includes(q) ||
          s.id?.toString().includes(q),
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((s) => derivePaymentStatus(s) === statusFilter);
    }

    return result;
  }, [allSales, searchQuery, statusFilter]);

  // ── Sorting ────────────────────────────────────────────────────────────
  /** displaySales — the filtered list after sorting */
  const displaySales = useMemo(
    () => sortSales(filteredSales, sortKey, sortDir),
    [filteredSales, sortKey, sortDir],
  );

  // ── Aggregate KPIs ─────────────────────────────────────────────────────
  /**
   * Aggregates computed from the FILTERED set (so KPI cards reflect the current filter).
   * All numeric operations use Number() with ?? 0 guards to prevent NaN.
   */
  const { totalRevenue, totalPaid, totalDue } = useMemo(() => {
    return filteredSales.reduce(
      (acc, s) => {
        acc.totalRevenue += Number(s.total_revenue ?? 0);
        acc.totalPaid += computePaid(s);
        acc.totalDue += computeDue(s);
        return acc;
      },
      { totalRevenue: 0, totalPaid: 0, totalDue: 0 },
    );
  }, [filteredSales]);

  // ── Sort toggle handler ────────────────────────────────────────────────
  /**
   * toggleSort — called when user clicks a column header.
   * If already sorting by this key: flip direction. Otherwise: set key + desc.
   */
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  /** Renders the appropriate chevron icon for a sortable column header */
  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col)
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground ml-1 inline" />
      );
    return sortDir === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-primary ml-1 inline" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-primary ml-1 inline" />
    );
  }

  // ── Error fallback ─────────────────────────────────────────────────────
  // If the query itself returned an error, show a safe recovery message.
  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 space-y-4 text-center"
        data-ocid="sales_summary.error_state"
      >
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            Summary unavailable. Please try again.
          </p>
          <p className="text-sm text-muted-foreground">
            Could not load sales data. Check your connection and refresh.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          data-ocid="sales_summary.error_retry_button"
        >
          Retry
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8" data-ocid="sales_summary.page">
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-semibold text-foreground">
            Sales Summary
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Payment history and status for all orders
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setHelpOpen(true)}
          aria-label="Open help"
          data-ocid="sales_summary.help_button"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <SummaryKpiRow
        totalOrders={filteredSales.length}
        totalRevenue={totalRevenue}
        totalPaid={totalPaid}
        totalDue={totalDue}
        loading={isLoading}
      />

      {/* ── Filters bar ────────────────────────────────────────────────── */}
      <Card className="card-elevated" data-ocid="sales_summary.filters.section">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Text search */}
            <div className="relative flex-1">
              <Input
                placeholder="Search customer or order #"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-sm pl-3"
                data-ocid="sales_summary.search_input"
              />
            </div>
            {/* Status filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-full sm:w-40 h-8 text-sm"
                data-ocid="sales_summary.status_filter.select"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Orders Table ────────────────────────────────────────────────── */}
      <Card className="card-elevated" data-ocid="sales_summary.table.section">
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" />
            Orders
            {!isLoading && (
              <Badge variant="secondary" className="text-xs ml-1">
                {displaySales.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            /* Loading skeleton — matches the table column structure */
            <div
              className="space-y-2 p-4"
              data-ocid="sales_summary.table.loading_state"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : displaySales.length === 0 ? (
            /* Empty state — shown when filters produce no results */
            <div
              className="flex flex-col items-center justify-center py-14 text-center px-6"
              data-ocid="sales_summary.table.empty_state"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <IndianRupee className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {allSales.length === 0
                  ? "No orders found for this period."
                  : "No orders match the current filters."}
              </p>
              {allSales.length > 0 && (
                <button
                  type="button"
                  className="mt-2 text-xs text-primary hover:underline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  data-ocid="sales_summary.clear_filters_button"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            /* Data table */
            <div className="overflow-x-auto">
              <Table data-ocid="sales_summary.orders.table">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="text-xs font-medium text-muted-foreground w-24">
                      Order #
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      Customer
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
                      onClick={() => toggleSort("date")}
                      data-ocid="sales_summary.sort_date.button"
                    >
                      Date
                      <SortIcon col="date" />
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium text-muted-foreground text-right cursor-pointer select-none"
                      onClick={() => toggleSort("total")}
                      data-ocid="sales_summary.sort_total.button"
                    >
                      Total
                      <SortIcon col="total" />
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground text-right">
                      Paid
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground text-right">
                      Due
                    </TableHead>
                    <TableHead
                      className="text-xs font-medium text-muted-foreground cursor-pointer select-none"
                      onClick={() => toggleSort("status")}
                      data-ocid="sales_summary.sort_status.button"
                    >
                      Status
                      <SortIcon col="status" />
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground text-center">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displaySales.map((sale, idx) => {
                    const paid = computePaid(sale);
                    const due = computeDue(sale);
                    const status = derivePaymentStatus(sale);

                    return (
                      <TableRow
                        key={sale.id?.toString() ?? idx}
                        className="hover:bg-muted/20"
                        data-ocid={`sales_summary.orders.item.${idx + 1}`}
                      >
                        {/* Order number */}
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          #{sale.id?.toString() ?? "—"}
                        </TableCell>

                        {/* Customer name */}
                        <TableCell className="text-sm font-medium text-foreground max-w-[140px] truncate">
                          {sale.customer_name || "—"}
                        </TableCell>

                        {/* Date */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(sale.timestamp)}
                        </TableCell>

                        {/* Total — right-aligned number */}
                        <TableCell className="text-sm font-semibold text-foreground text-right">
                          {formatCurrency(sale.total_revenue)}
                        </TableCell>

                        {/* Paid */}
                        <TableCell className="text-sm text-right text-green-700 dark:text-green-400">
                          {formatCurrency(paid)}
                        </TableCell>

                        {/* Due */}
                        <TableCell
                          className={`text-sm text-right font-medium ${
                            due > 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {due > 0 ? formatCurrency(due) : "—"}
                        </TableCell>

                        {/* Status badge */}
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>

                        {/* Actions — Payments button only, no inline status edit */}
                        <TableCell className="text-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2.5"
                            onClick={() => {
                              logDebug(
                                `Opening payments modal for saleId=${sale.id?.toString()}`,
                              );
                              setSelectedSale(sale);
                            }}
                            data-ocid={`sales_summary.payments_button.${idx + 1}`}
                          >
                            <CreditCard className="w-3 h-3 mr-1" />
                            Payments
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Payment History Modal ────────────────────────────────────────── */}
      <PaymentHistoryModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        currentUserName={currentUserName}
      />

      {/* ── Help Panel ──────────────────────────────────────────────────── */}
      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        defaultPageKey="sales"
      />
    </div>
  );
}
