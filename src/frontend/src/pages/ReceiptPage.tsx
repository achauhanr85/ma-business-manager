import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useProfile } from "@/contexts/ProfileContext";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import {
  useGetBodyCompositionHistory,
  useGetBodyInchesHistory,
  useGetCustomer,
  useGetProfile,
  useGetSaleItems,
  useGetUsersByProfile,
} from "@/hooks/useBackend";
import type { BodyInchesEntry } from "@/hooks/useBackend";
import { useActor } from "@caffeineai/core-infrastructure";
import { ArrowLeft, Download, MessageCircle, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { createActor } from "../backend";
import type { BodyCompositionEntry } from "../backend";
import type { Sale, SaleItem } from "../types";

interface ReceiptPageProps {
  saleId: bigint | null;
  onNavigate: (path: string, saleId?: bigint) => void;
}

/** Strip HTML tags for safe plain-text fallback */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function buildWhatsAppText(
  sale: Sale,
  items: SaleItem[],
  businessName: string,
  formatDateFn: (d: bigint) => string,
  sellerName?: string,
): string {
  const header = `*${businessName} — Receipt*\n`;
  const date = `Date: ${formatDateFn(sale.timestamp)}\n`;
  const customer = sale.customer_name
    ? `Customer: ${sale.customer_name}\n`
    : "";
  const sold = sellerName ? `Sold by: ${sellerName}\n\n` : "\n";
  const itemLines = items
    .map(
      (item) =>
        `• ${item.product_name_snapshot} x${item.quantity} @ ₹${item.actual_sale_price.toFixed(2)} = ₹${(Number(item.quantity) * item.actual_sale_price).toFixed(2)}`,
    )
    .join("\n");
  const discountApplied =
    (sale as Sale & { discount_applied?: number }).discount_applied ?? 0;
  const discountLine =
    discountApplied > 0 ? `\nDiscount: -₹${discountApplied.toFixed(2)}` : "";
  const totals = `\n\n*Grand Total: ₹${sale.total_revenue.toFixed(2)}*${discountLine}`;
  const saleNoteVal = (sale as Sale & { sale_note?: string }).sale_note;
  const noteLine = saleNoteVal ? `\n\nNote: ${saleNoteVal}` : "";
  return encodeURIComponent(
    header + date + customer + sold + itemLines + totals + noteLine,
  );
}

// ─── Body Composition Table ───────────────────────────────────────────────────

function BodyCompositionTable({
  entries,
  formatDate,
}: {
  entries: BodyCompositionEntry[];
  formatDate: (d: Date | bigint | number | string) => string;
}) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div className="space-y-2" data-ocid="receipt.body_composition.section">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Body Composition History
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              {[
                "Date",
                "Wt (kg)",
                "Fat %",
                "Visc.",
                "BMR",
                "BMI",
                "Age",
                "Trunk%",
                "Muscle",
              ].map((h) => (
                <th
                  key={h}
                  className="px-2 py-1.5 text-center font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => (
              <tr
                key={entry.id}
                className={`border-b border-border/50 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                data-ocid={`receipt.body_comp.${idx + 1}`}
              >
                <td className="px-2 py-1.5 text-center font-mono whitespace-nowrap">
                  {formatDate(entry.date)}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.weight != null ? entry.weight.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.body_fat != null ? entry.body_fat.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.visceral_fat != null
                    ? entry.visceral_fat.toFixed(0)
                    : "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.bmr != null ? entry.bmr.toFixed(0) : "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.bmi != null ? entry.bmi.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.body_age != null ? String(entry.body_age) : "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.trunk_fat != null ? entry.trunk_fat.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-center tabular-nums">
                  {entry.muscle_mass != null
                    ? entry.muscle_mass.toFixed(1)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Body Inches Table ────────────────────────────────────────────────────────

function BodyInchesTable({
  entries,
  formatDate,
}: {
  entries: BodyInchesEntry[];
  formatDate: (d: Date | bigint | number | string) => string;
}) {
  if (entries.length === 0) return null;

  const sorted = [...entries].sort((a, b) =>
    Number(b.entry_date - a.entry_date),
  );

  const cols = [
    "Date",
    "Chest",
    "Biceps",
    "Waist",
    "Hips",
    "Thighs",
    "Calves",
  ] as const;
  type InchesKey = Exclude<
    keyof BodyInchesEntry,
    | "id"
    | "customer_id"
    | "profile_key"
    | "entry_date"
    | "created_by"
    | "creation_date"
  >;
  const fields: InchesKey[] = [
    "chest",
    "biceps",
    "waist",
    "hips",
    "thighs",
    "calves",
  ];

  return (
    <div className="space-y-2" data-ocid="receipt.body_inches.section">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Body Inches History
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              {cols.map((h) => (
                <th
                  key={h}
                  className="px-2 py-1.5 text-center font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry, idx) => (
              <tr
                key={String(entry.id)}
                className={`border-b border-border/50 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                data-ocid={`receipt.body_inches.${idx + 1}`}
              >
                <td className="px-2 py-1.5 text-center font-mono whitespace-nowrap">
                  {formatDate(entry.entry_date)}
                </td>
                {fields.map((field) => (
                  <td
                    key={field}
                    className="px-2 py-1.5 text-center tabular-nums"
                  >
                    {entry[field] != null
                      ? `${(entry[field] as number).toFixed(1)}"`
                      : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Receipt Page ─────────────────────────────────────────────────────────────

export function ReceiptPage({ saleId, onNavigate }: ReceiptPageProps) {
  const { actor } = useActor(createActor);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loadingSale, setLoadingSale] = useState(true);
  const { formatDate, defaultReceiptLanguage } = useUserPreferences();
  const [receiptLang, setReceiptLang] = useState<string>(
    defaultReceiptLanguage,
  );

  // Sync default receipt language when preferences load
  useEffect(() => {
    setReceiptLang(defaultReceiptLanguage);
  }, [defaultReceiptLanguage]);

  const { data: saleItems = [], isLoading: loadingItems } =
    useGetSaleItems(saleId);
  const { data: profile } = useGetProfile();
  const { userProfile } = useProfile();
  const profileKey = userProfile?.profile_key ?? profile?.profile_key ?? "";

  // Load sale data
  useEffect(() => {
    if (!actor || !saleId) {
      setLoadingSale(false);
      return;
    }
    setLoadingSale(true);
    actor
      .getSale(saleId)
      .then((result) => setSale(result))
      .finally(() => setLoadingSale(false));
  }, [actor, saleId]);

  const customerId = sale?.customer_id ?? null;
  const { data: bodyCompHistory = [] } =
    useGetBodyCompositionHistory(customerId);
  const { data: bodyInchesHistory = [] } = useGetBodyInchesHistory(
    customerId,
    profileKey,
  );
  const { data: customer } = useGetCustomer(customerId);

  // Fetch profile users to resolve sold_by name
  const { data: profileUsers = [] } = useGetUsersByProfile(profileKey || null);
  const soldByRaw = (sale as (Sale & { sold_by?: string }) | null)?.sold_by;
  const sellerUser = soldByRaw
    ? profileUsers.find((u) => {
        const uid =
          typeof u.principal?.toText === "function"
            ? u.principal.toText()
            : String(u.principal);
        return uid === soldByRaw;
      })
    : null;
  const sellerName =
    sellerUser?.display_name ??
    (soldByRaw ? `${soldByRaw.slice(0, 10)}…` : null);

  const businessName = profile?.business_name || "Indi Negocio Livre";
  const isLoading = loadingSale || loadingItems;

  const discountApplied =
    (sale as (Sale & { discount_applied?: number }) | null)?.discount_applied ??
    0;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!sale) return;
    // Use customer phone if available, else open generic
    const phone = customer?.phone?.replace(/\D/g, "") ?? "";
    const text = buildWhatsAppText(
      sale,
      saleItems,
      businessName,
      formatDate,
      sellerName ?? undefined,
    );
    const url = phone
      ? `https://wa.me/${phone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!saleId) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 text-muted-foreground"
        data-ocid="receipt.empty_state"
      >
        <Printer className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-base font-medium">Please confirm a sale first</p>
        <p className="text-sm mt-1 text-muted-foreground">
          Confirm a sale from the Sales page and the receipt will appear here.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => onNavigate("/sales")}
          data-ocid="receipt.back_button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sales
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-ocid="receipt.page">
      {/* Action bar (hidden on print) */}
      <div className="flex flex-wrap gap-2 items-center justify-between print:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate("/sales")}
          data-ocid="receipt.back_button"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Sales
        </Button>

        {/* Receipt language selector */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Language:</Label>
          <Select value={receiptLang} onValueChange={setReceiptLang}>
            <SelectTrigger
              className="h-8 text-xs w-28"
              data-ocid="receipt.language_select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en" className="text-xs">
                English
              </SelectItem>
              <SelectItem value="gu" className="text-xs">
                Gujarati
              </SelectItem>
              <SelectItem value="hi" className="text-xs">
                Hindi
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleWhatsApp}
            disabled={!sale}
            className="text-primary border-primary/30 hover:bg-primary/10 hover:border-primary/50"
            data-ocid="receipt.whatsapp_button"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Share via WhatsApp
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={!sale}
            data-ocid="receipt.download_button"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Receipt
          </Button>
        </div>
      </div>

      {/* Receipt Card */}
      <Card className="card-elevated print:shadow-none print:border-none">
        <CardContent className="p-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-40" />
              <Separator />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : !sale ? (
            <div
              className="text-center py-10 text-muted-foreground"
              data-ocid="receipt.error_state"
            >
              <p>Receipt not found</p>
            </div>
          ) : (
            <>
              {/* ── HEADER ROW: Business info left, Logo right ─────────────── */}
              <div className="flex items-start justify-between gap-4">
                {/* Business info — left */}
                <div className="space-y-0.5 min-w-0">
                  <h1 className="text-lg font-bold text-foreground font-display leading-tight">
                    {businessName}
                  </h1>
                  {profile?.business_address && (
                    <p className="text-xs text-muted-foreground">
                      {profile.business_address}
                    </p>
                  )}
                  {profile?.phone_number && (
                    <p className="text-xs text-muted-foreground">
                      📞 {profile.phone_number}
                    </p>
                  )}
                  {profile?.email && (
                    <p className="text-xs text-muted-foreground">
                      ✉ {profile.email}
                    </p>
                  )}
                  {profile?.fssai_number && (
                    <p className="text-xs text-muted-foreground">
                      FSSAI: {profile.fssai_number}
                    </p>
                  )}
                  {(profile as typeof profile & { instagram_handle?: string })
                    ?.instagram_handle && (
                    <p className="text-xs text-muted-foreground">
                      📸 @
                      {
                        (
                          profile as typeof profile & {
                            instagram_handle?: string;
                          }
                        ).instagram_handle
                      }
                    </p>
                  )}
                </div>
                {/* Logo — right */}
                {profile?.logo_url ? (
                  <img
                    src={profile.logo_url}
                    alt={`${businessName} logo`}
                    className="h-14 max-w-[100px] object-contain flex-shrink-0"
                  />
                ) : (
                  <span className="text-3xl flex-shrink-0">🌿</span>
                )}
              </div>

              <Separator />

              {/* ── SUB-HEADER ROW: Customer left, Receipt meta right ──────── */}
              <div
                className="flex flex-wrap items-start justify-between gap-3"
                data-ocid="receipt.meta.section"
              >
                {/* Customer info — left */}
                <div
                  className="space-y-0.5 min-w-0"
                  data-ocid="receipt.customer.section"
                >
                  {sale.customer_name && (
                    <p className="text-sm font-semibold text-foreground">
                      {sale.customer_name}
                    </p>
                  )}
                  {customer?.phone && (
                    <p className="text-xs text-muted-foreground">
                      {customer.phone}
                    </p>
                  )}
                  {customer?.address && (
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      {customer.address}
                    </p>
                  )}
                  {sellerName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sold by:{" "}
                      <span className="font-medium text-foreground">
                        {sellerName}
                      </span>
                    </p>
                  )}
                </div>
                {/* Receipt meta — right */}
                <div className="text-right space-y-0.5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Receipt
                  </p>
                  <p className="font-mono font-semibold text-sm">
                    #{sale.id.toString().padStart(6, "0")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(sale.timestamp)}
                  </p>
                  {sale.payment_status && (
                    <p className="text-xs font-medium capitalize">
                      {String(sale.payment_status).replace("_", " ")}
                      {sale.payment_mode
                        ? ` · ${String(sale.payment_mode)}`
                        : ""}
                    </p>
                  )}
                  {sale.payment_due_date && (
                    <p className="text-xs text-destructive">
                      Due: {sale.payment_due_date}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── ITEM GRID ──────────────────────────────────────────────── */}
              <div data-ocid="receipt.items.table">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left py-1.5 px-1 text-muted-foreground font-medium uppercase tracking-wide">
                        Item
                      </th>
                      <th className="text-right py-1.5 px-1 text-muted-foreground font-medium uppercase tracking-wide w-10">
                        Qty
                      </th>
                      <th className="text-right py-1.5 px-1 text-muted-foreground font-medium uppercase tracking-wide w-16">
                        Price
                      </th>
                      <th className="text-right py-1.5 px-1 text-muted-foreground font-medium uppercase tracking-wide w-16">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleItems.map((item, idx) => {
                      // BUG-12: Guard null fields — use stored data only, never re-query inventory
                      const productName = item.product_name_snapshot ?? "";
                      const qty = Number(item.quantity ?? 0);
                      const price = item.actual_sale_price ?? 0;
                      const lineTotal = qty * price;
                      return (
                        <tr
                          key={`${item.sale_id}-${item.product_id}`}
                          className="border-b border-border/40"
                          data-ocid={`receipt.item.${idx + 1}`}
                        >
                          <td className="py-1.5 px-1">
                            <p className="font-medium leading-tight">
                              {productName}
                            </p>
                            {item.product_instructions && (
                              <p className="text-muted-foreground leading-tight mt-0.5 text-xs">
                                {item.product_instructions}
                              </p>
                            )}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums">
                            {qty}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums">
                            ₹{price.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-1 text-right tabular-nums font-medium">
                            ₹{lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="space-y-1" data-ocid="receipt.totals.section">
                {/* BUG-12: guard all null fields — total_revenue and discount_applied from stored sale data */}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">
                    ₹{((sale.total_revenue ?? 0) + discountApplied).toFixed(2)}
                  </span>
                </div>
                {discountApplied > 0 && (
                  <div
                    className="flex justify-between text-xs"
                    data-ocid="receipt.discount.section"
                  >
                    <span className="text-primary">Discount Applied</span>
                    <span className="font-semibold text-primary">
                      − ₹{discountApplied.toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold mt-1 pt-1 border-t border-border">
                  <span>Grand Total</span>
                  <span className="text-primary">
                    ₹{(sale.total_revenue ?? 0).toFixed(2)}
                  </span>
                </div>
                {(sale.amount_paid ?? null) != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span>₹{(sale.amount_paid as number).toFixed(2)}</span>
                  </div>
                )}
                {(sale.balance_due ?? null) != null &&
                  (sale.balance_due as number) > 0 && (
                    <div className="flex justify-between text-xs font-medium text-destructive">
                      <span>Balance Due</span>
                      <span>₹{(sale.balance_due as number).toFixed(2)}</span>
                    </div>
                  )}
              </div>

              <Separator />

              {/* ── THREE NOTES SECTIONS ───────────────────────────────────── */}

              {/* 1. Business Note */}
              {profile?.receipt_notes &&
                stripHtml(profile.receipt_notes).length > 0 && (
                  <div
                    className="space-y-1"
                    data-ocid="receipt.business_note.section"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Business Note
                    </p>
                    <div
                      className="text-xs text-foreground prose prose-sm max-w-none receipt-notes-html"
                      ref={(el) => {
                        if (el && profile?.receipt_notes) {
                          el.innerHTML = profile.receipt_notes;
                        }
                      }}
                    />
                  </div>
                )}

              {/* 2. Sales Note */}
              {(sale as Sale & { sale_note?: string }).sale_note && (
                <div
                  className="space-y-1"
                  data-ocid="receipt.sale_note.section"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sales Note
                  </p>
                  <p className="text-xs text-foreground">
                    {(sale as Sale & { sale_note?: string }).sale_note}
                  </p>
                </div>
              )}

              {/* 3. Customer Notes */}
              {customer?.notes && customer.notes.length > 0 && (
                <div
                  className="space-y-1"
                  data-ocid="receipt.customer_notes.section"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Customer Notes
                  </p>
                  <ul className="space-y-0.5">
                    {customer.notes.map((note, idx) => (
                      <li
                        key={`note-${note.text.slice(0, 20)}-${idx}`}
                        className="text-xs text-foreground flex items-start gap-1.5"
                      >
                        <span className="text-muted-foreground mt-0.5 flex-shrink-0">
                          •
                        </span>
                        <span className="break-words">{note.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ── BODY COMPOSITION HISTORY ──────────────────────────────── */}
              {bodyCompHistory.length > 0 && (
                <>
                  <Separator />
                  <BodyCompositionTable
                    entries={bodyCompHistory}
                    formatDate={formatDate}
                  />
                </>
              )}

              {/* ── BODY INCHES HISTORY ───────────────────────────────────── */}
              {bodyInchesHistory.length > 0 && (
                <>
                  <Separator />
                  <BodyInchesTable
                    entries={bodyInchesHistory}
                    formatDate={formatDate}
                  />
                </>
              )}

              <Separator />

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">
                  Thank you for your purchase!
                </p>
                <p>This is a computer-generated receipt</p>
                {(profile as typeof profile & { instagram_handle?: string })
                  ?.instagram_handle && (
                  <p>
                    Follow us: @
                    {
                      (
                        profile as typeof profile & {
                          instagram_handle?: string;
                        }
                      ).instagram_handle
                    }
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Print styles injected via style tag */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          [data-ocid="receipt.page"], [data-ocid="receipt.page"] * { visibility: visible; }
          [data-ocid="receipt.page"] { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
