import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetProfile, useGetSaleItems } from "@/hooks/useBackend";
import { useActor } from "@caffeineai/core-infrastructure";
import { ArrowLeft, Download, MessageCircle, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { createActor } from "../backend";
import type { Sale, SaleItem } from "../types";

interface ReceiptPageProps {
  saleId: bigint | null;
  onNavigate: (path: string, saleId?: bigint) => void;
}

function formatTimestamp(ts: bigint): string {
  // ts is in nanoseconds
  const ms = Number(ts / BigInt(1_000_000));
  const d = new Date(ms);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildWhatsAppText(
  sale: Sale,
  items: SaleItem[],
  businessName: string,
): string {
  const header = `*${businessName} — Receipt*\n`;
  const date = `Date: ${formatTimestamp(sale.timestamp)}\n\n`;
  const itemLines = items
    .map(
      (item) =>
        `• ${item.product_name_snapshot} x${item.quantity} @ ₹${item.actual_sale_price.toFixed(2)} = ₹${(Number(item.quantity) * item.actual_sale_price).toFixed(2)}`,
    )
    .join("\n");
  const totals = `\n\n*Total: ₹${sale.total_revenue.toFixed(2)}*\nVolume Points: ${sale.total_volume_points}`;
  return encodeURIComponent(header + date + itemLines + totals);
}

export function ReceiptPage({ saleId, onNavigate }: ReceiptPageProps) {
  const { actor } = useActor(createActor);
  const [sale, setSale] = useState<Sale | null>(null);
  const [loadingSale, setLoadingSale] = useState(true);

  const { data: saleItems = [], isLoading: loadingItems } =
    useGetSaleItems(saleId);
  const { data: profile } = useGetProfile();

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

  const businessName = profile?.business_name || "MA Herb";
  const isLoading = loadingSale || loadingItems;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!sale) return;
    const text = buildWhatsAppText(sale, saleItems, businessName);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  if (!saleId) {
    return (
      <div
        className="flex flex-col items-center justify-center py-20 text-muted-foreground"
        data-ocid="receipt.empty_state"
      >
        <Printer className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-base font-medium">No sale selected</p>
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
        <CardContent className="p-6 space-y-5">
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
              {/* Header */}
              <div className="text-center space-y-1">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">🌿</span>
                  <h1 className="text-2xl font-bold text-foreground font-display">
                    {businessName}
                  </h1>
                </div>
                {profile?.fssai_number && (
                  <p className="text-xs text-muted-foreground">
                    FSSAI: {profile.fssai_number}
                  </p>
                )}
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
              </div>

              <Separator />

              {/* Sale Meta */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Receipt ID
                  </p>
                  <p className="font-mono font-medium">
                    #{sale.id.toString().padStart(6, "0")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Date &amp; Time
                  </p>
                  <p className="font-medium">
                    {formatTimestamp(sale.timestamp)}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Items Table */}
              <div data-ocid="receipt.items.table">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                        Product
                      </th>
                      <th className="text-right py-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                        Qty
                      </th>
                      <th className="text-right py-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                        Price
                      </th>
                      <th className="text-right py-2 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleItems.map((item, idx) => (
                      <tr
                        key={`${item.sale_id}-${item.product_id}`}
                        className="border-b border-border/50"
                        data-ocid={`receipt.item.${idx + 1}`}
                      >
                        <td className="py-2.5">
                          <p className="font-medium">
                            {item.product_name_snapshot}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            MRP: ₹{item.mrp_snapshot.toFixed(2)} ·{" "}
                            {item.volume_points_snapshot} VP
                          </p>
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {item.quantity.toString()}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          ₹{item.actual_sale_price.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-medium">
                          ₹
                          {(
                            Number(item.quantity) * item.actual_sale_price
                          ).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2" data-ocid="receipt.totals.section">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Total Volume Points
                  </span>
                  <Badge variant="secondary">
                    {sale.total_volume_points} VP
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Estimated Profit
                  </span>
                  <span
                    className={
                      sale.total_profit >= 0
                        ? "text-primary font-medium"
                        : "text-destructive font-medium"
                    }
                  >
                    ₹{sale.total_profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold mt-1 pt-1 border-t border-border">
                  <span>Grand Total</span>
                  <span className="text-primary">
                    ₹{sale.total_revenue.toFixed(2)}
                  </span>
                </div>
              </div>

              <Separator />

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  Thank you for your purchase!
                </p>
                <p>This is a computer-generated receipt</p>
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
