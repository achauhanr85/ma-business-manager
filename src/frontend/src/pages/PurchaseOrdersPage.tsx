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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateCategory,
  useCreateProduct,
  useCreatePurchaseOrder,
  useGetCategories,
  useGetProducts,
  useGetPurchaseOrders,
  useGetUserProfile,
  useMarkPurchaseOrderReceived,
} from "@/hooks/useBackend";
import { downloadCsvTemplate, exportToCsv, parseCsvFile } from "@/lib/csvUtils";
import type { Category, PurchaseOrder, PurchaseOrderItemInput } from "@/types";
import { POStatus } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
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

// ── Quick Create Product/Category Dialog ─────────────────────────────────────

interface QuickCreateDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  onProductCreated: (productId: string) => void;
}

function QuickCreateDialog({
  open,
  onOpenChange,
  categories,
  onProductCreated,
}: QuickCreateDialogProps) {
  const qc = useQueryClient();
  const createCategory = useCreateCategory();
  const createProduct = useCreateProduct();

  const [activeTab, setActiveTab] = useState<"product" | "category">("product");

  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");
  const [catErrors, setCatErrors] = useState<Record<string, string>>({});

  const [prodForm, setProdForm] = useState({
    sku: "",
    name: "",
    category_id: "",
    volume_points: "",
    earn_base: "",
    mrp: "",
    hsn_code: "",
  });
  const [prodErrors, setProdErrors] = useState<Record<string, string>>({});

  const setField = (field: keyof typeof prodForm, value: string) =>
    setProdForm((f) => ({ ...f, [field]: value }));

  const resetForms = () => {
    setCatName("");
    setCatDesc("");
    setCatErrors({});
    setProdForm({
      sku: "",
      name: "",
      category_id: "",
      volume_points: "",
      earn_base: "",
      mrp: "",
      hsn_code: "",
    });
    setProdErrors({});
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForms();
    onOpenChange(v);
  };

  const handleCreateCategory = async () => {
    const errs: Record<string, string> = {};
    if (!catName.trim()) errs.name = "Category name is required";
    setCatErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await createCategory.mutateAsync({
        name: catName.trim(),
        description: catDesc.trim(),
      });
      await qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(`Category "${catName}" created`);
      setCatName("");
      setCatDesc("");
      setActiveTab("product");
    } catch {
      toast.error("Failed to create category");
    }
  };

  const handleCreateProduct = async () => {
    const errs: Record<string, string> = {};
    if (!prodForm.sku.trim()) errs.sku = "SKU is required";
    if (!prodForm.name.trim()) errs.name = "Product name is required";
    if (!prodForm.category_id) errs.category_id = "Category is required";
    if (!prodForm.mrp || Number(prodForm.mrp) <= 0)
      errs.mrp = "MRP is required";
    setProdErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const newId = await createProduct.mutateAsync({
        sku: prodForm.sku.trim(),
        name: prodForm.name.trim(),
        category_id: BigInt(prodForm.category_id),
        volume_points: Number(prodForm.volume_points) || 0,
        earn_base: Number(prodForm.earn_base) || 0,
        mrp: Number(prodForm.mrp),
        hsn_code: prodForm.hsn_code.trim(),
      });
      if (newId == null) {
        toast.error("SKU already exists. Use a different SKU.");
        return;
      }
      toast.success(`Product "${prodForm.name}" created`);
      onProductCreated(newId.toString());
      handleOpenChange(false);
    } catch {
      toast.error("Failed to create product");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-md"
        data-ocid="purchase_orders.quick_create_dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" />
            Quick Create
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "product" | "category")}
        >
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger
              value="product"
              data-ocid="purchase_orders.quick_create.product_tab"
            >
              New Product
            </TabsTrigger>
            <TabsTrigger
              value="category"
              data-ocid="purchase_orders.quick_create.category_tab"
            >
              New Category
            </TabsTrigger>
          </TabsList>

          <TabsContent value="product" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qc-sku" className="text-xs">
                  SKU <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="qc-sku"
                  placeholder="e.g. HERB-001"
                  value={prodForm.sku}
                  onChange={(e) => setField("sku", e.target.value)}
                  className={prodErrors.sku ? "border-destructive" : ""}
                  data-ocid="purchase_orders.quick_create.sku.input"
                />
                {prodErrors.sku && (
                  <p className="text-xs text-destructive">{prodErrors.sku}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qc-name" className="text-xs">
                  Product Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="qc-name"
                  placeholder="e.g. Tulsi Extract"
                  value={prodForm.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className={prodErrors.name ? "border-destructive" : ""}
                  data-ocid="purchase_orders.quick_create.name.input"
                />
                {prodErrors.name && (
                  <p className="text-xs text-destructive">{prodErrors.name}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qc-category" className="text-xs">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={prodForm.category_id}
                onValueChange={(v) => setField("category_id", v)}
              >
                <SelectTrigger
                  id="qc-category"
                  className={prodErrors.category_id ? "border-destructive" : ""}
                  data-ocid="purchase_orders.quick_create.category.select"
                >
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id.toString()} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                  {categories.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      No categories yet — create one first
                    </div>
                  )}
                </SelectContent>
              </Select>
              {prodErrors.category_id && (
                <p className="text-xs text-destructive">
                  {prodErrors.category_id}
                </p>
              )}
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setActiveTab("category")}
              >
                + Create new category
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qc-mrp" className="text-xs">
                  MRP (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="qc-mrp"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={prodForm.mrp}
                  onChange={(e) => setField("mrp", e.target.value)}
                  className={prodErrors.mrp ? "border-destructive" : ""}
                  data-ocid="purchase_orders.quick_create.mrp.input"
                />
                {prodErrors.mrp && (
                  <p className="text-xs text-destructive">{prodErrors.mrp}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qc-vp" className="text-xs">
                  Volume Pts
                </Label>
                <Input
                  id="qc-vp"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={prodForm.volume_points}
                  onChange={(e) => setField("volume_points", e.target.value)}
                  data-ocid="purchase_orders.quick_create.volume_points.input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qc-earn" className="text-xs">
                  Earn Base
                </Label>
                <Input
                  id="qc-earn"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={prodForm.earn_base}
                  onChange={(e) => setField("earn_base", e.target.value)}
                  data-ocid="purchase_orders.quick_create.earn_base.input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="qc-hsn" className="text-xs">
                HSN Code
              </Label>
              <Input
                id="qc-hsn"
                placeholder="e.g. 1211"
                value={prodForm.hsn_code}
                onChange={(e) => setField("hsn_code", e.target.value)}
                data-ocid="purchase_orders.quick_create.hsn.input"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleOpenChange(false)}
                data-ocid="purchase_orders.quick_create.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateProduct}
                disabled={createProduct.isPending}
                data-ocid="purchase_orders.quick_create.save_product_button"
              >
                {createProduct.isPending ? "Creating…" : "Create & Select"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="category" className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <Label htmlFor="qc-cat-name" className="text-xs">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qc-cat-name"
                placeholder="e.g. Herbal Extracts"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className={catErrors.name ? "border-destructive" : ""}
                data-ocid="purchase_orders.quick_create.cat_name.input"
              />
              {catErrors.name && (
                <p className="text-xs text-destructive">{catErrors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-cat-desc" className="text-xs">
                Description
              </Label>
              <Input
                id="qc-cat-desc"
                placeholder="Optional description"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                data-ocid="purchase_orders.quick_create.cat_desc.input"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("product")}
              >
                Back to Product
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateCategory}
                disabled={createCategory.isPending}
                data-ocid="purchase_orders.quick_create.save_category_button"
              >
                {createCategory.isPending ? "Creating…" : "Create Category"}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk Upload: Purchase Orders ──────────────────────────────────────────────

interface POUploadRow {
  product_sku: string;
  quantity: string;
  unit_cost: string;
  error?: string;
}

interface BulkPOUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

function BulkPOUploadDialog({ open, onClose }: BulkPOUploadDialogProps) {
  const { data: products = [] } = useGetProducts();
  const { data: userProfile } = useGetUserProfile();
  const createPO = useCreatePurchaseOrder();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<POUploadRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<{
    imported: number;
    errors: number;
  } | null>(null);

  function reset() {
    setRows([]);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function validate(row: Record<string, string>): POUploadRow {
    const product_sku = row.product_sku?.trim() ?? "";
    const quantity = row.quantity?.trim() ?? "";
    const unit_cost = row.unit_cost?.trim() ?? "";
    const errs: string[] = [];
    if (!product_sku) errs.push("SKU required");
    else if (
      !products.find((p) => p.sku.toLowerCase() === product_sku.toLowerCase())
    ) {
      errs.push(`SKU "${product_sku}" not found`);
    }
    const qty = Number.parseInt(quantity, 10);
    if (Number.isNaN(qty) || qty <= 0) errs.push("Quantity must be > 0");
    const cost = Number.parseFloat(unit_cost);
    if (Number.isNaN(cost) || cost <= 0) errs.push("Unit cost must be > 0");
    return {
      product_sku,
      quantity,
      unit_cost,
      error: errs.length > 0 ? errs.join("; ") : undefined,
    };
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseCsvFile(file);
      setRows(parsed.map(validate));
      setSummary(null);
    } catch {
      toast.error("Failed to parse CSV file");
    }
  }

  async function handleImport() {
    const valid = rows.filter((r) => !r.error);
    if (valid.length === 0) return;
    setImporting(true);
    // Group all rows into one PO
    const items: PurchaseOrderItemInput[] = [];
    for (const row of valid) {
      const prod = products.find(
        (p) => p.sku.toLowerCase() === row.product_sku.toLowerCase(),
      );
      if (!prod) continue;
      items.push({
        product_id: prod.id,
        quantity: BigInt(Math.round(Number.parseInt(row.quantity, 10))),
        unit_cost: Number.parseFloat(row.unit_cost),
      });
    }
    let imported = 0;
    let errors = 0;
    try {
      await createPO.mutateAsync({
        vendor: "Bulk Import",
        items,
        warehouse_name: userProfile?.warehouse_name ?? "Main",
      });
      imported = items.length;
    } catch {
      errors = valid.length;
    }
    setSummary({ imported, errors });
    setImporting(false);
    if (imported > 0)
      toast.success(`Purchase order created with ${imported} items`);
  }

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => !!r.error).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-xl max-h-[80vh] flex flex-col"
        data-ocid="purchase_orders.bulk_upload.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Bulk Upload Orders
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            All rows will be combined into a single purchase order. Product SKU
            must match an existing product.
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsvTemplate("orders_template.csv", [
                  "product_sku",
                  "quantity",
                  "unit_cost",
                ])
              }
              data-ocid="purchase_orders.bulk_upload.download_template_button"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Download Template
            </Button>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
                data-ocid="purchase_orders.bulk_upload.file_input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Choose CSV
              </Button>
            </div>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">
                  {rows.length} rows
                </span>
                {errorCount > 0 && (
                  <span className="text-destructive">
                    {errorCount} with errors
                  </span>
                )}
                {validCount > 0 && (
                  <span className="text-primary">{validCount} valid</span>
                )}
              </div>
              <div className="border border-border rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {["SKU", "Qty", "Unit Cost (₹)", "Status"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={`${row.product_sku}-${row.quantity}-${row.unit_cost}`}
                        className={`border-b border-border last:border-0 ${row.error ? "bg-destructive/5" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono">
                          {row.product_sku || "—"}
                        </td>
                        <td className="px-3 py-2">{row.quantity || "—"}</td>
                        <td className="px-3 py-2">{row.unit_cost || "—"}</td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span className="text-destructive text-[10px]">
                              {row.error}
                            </span>
                          ) : (
                            <span className="text-primary">✓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {summary && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">Import complete</p>
              <p className="text-muted-foreground">
                {summary.imported > 0
                  ? `Order created with ${summary.imported} items`
                  : "Import failed"}
                {summary.errors > 0 && ` — ${summary.errors} rows failed`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-ocid="purchase_orders.bulk_upload.cancel_button"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={validCount === 0 || importing || !!summary}
            data-ocid="purchase_orders.bulk_upload.import_button"
          >
            {importing ? "Importing…" : `Create Order (${validCount} items)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Create PO Dialog ────────────────────────────────────────────────────────

interface CreatePODialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function CreatePODialog({ open, onOpenChange }: CreatePODialogProps) {
  const { data: products } = useGetProducts();
  const { data: categories } = useGetCategories();
  const createPO = useCreatePurchaseOrder();
  const { data: userProfile } = useGetUserProfile();

  const [vendor, setVendor] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateTargetUid, setQuickCreateTargetUid] = useState<
    string | null
  >(null);

  const resetForm = () => {
    setVendor("");
    setItems([newDraftItem()]);
    setErrors({});
  };

  const addItem = () => setItems((prev) => [...prev, newDraftItem()]);
  const removeItem = (uid: string) =>
    setItems((prev) => prev.filter((item) => item.uid !== uid));

  const updateItem = (uid: string, field: keyof DraftItem, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.uid === uid ? { ...item, [field]: value } : item,
      ),
    );
    const errKey = `${uid}-${field}`;
    if (errors[errKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        next[errKey] = "";
        return next;
      });
    }
  };

  const handleProductCreated = (productId: string) => {
    if (quickCreateTargetUid) {
      updateItem(quickCreateTargetUid, "product_id", productId);
      setQuickCreateTargetUid(null);
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
        warehouse_name: userProfile?.warehouse_name ?? "Main",
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
    <>
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

                    <div className="space-y-1">
                      <Label
                        htmlFor={`po-product-${item.uid}`}
                        className="text-xs"
                      >
                        Product
                      </Label>
                      <div className="flex gap-2">
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
                            {(products ?? []).length === 0 && (
                              <div className="px-2 py-2 text-xs text-muted-foreground text-center">
                                No products yet
                              </div>
                            )}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="px-2 flex-shrink-0"
                          aria-label="Add new product"
                          title="Create new product"
                          onClick={() => {
                            setQuickCreateTargetUid(item.uid);
                            setQuickCreateOpen(true);
                          }}
                          data-ocid={`purchase_orders.add_product_button.${idx + 1}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
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
                      <div className="space-y-1">
                        <Label
                          htmlFor={`po-qty-${item.uid}`}
                          className="text-xs"
                        >
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

      <QuickCreateDialog
        open={quickCreateOpen}
        onOpenChange={setQuickCreateOpen}
        categories={categories ?? []}
        onProductCreated={handleProductCreated}
      />
    </>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export function PurchaseOrdersPage({
  onNavigate: _onNavigate,
}: PurchaseOrdersPageProps) {
  const { data: orders, isLoading } = useGetPurchaseOrders();
  const markReceived = useMarkPurchaseOrderReceived();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

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

  function handleExport() {
    const data = sortedOrders.map((o) => ({
      id: o.id.toString(),
      vendor: o.vendor,
      status: o.status === POStatus.Received ? "Received" : "Pending",
      created_date: formatDate(o.timestamp),
    }));
    exportToCsv("purchase_orders.csv", data);
    toast.success("Orders exported");
  }

  return (
    <div className="space-y-5" data-ocid="purchase_orders.page">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={sortedOrders.length === 0}
            data-ocid="purchase_orders.export_button"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setBulkOpen(true)}
            data-ocid="purchase_orders.upload_button"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload
          </Button>
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
      <BulkPOUploadDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </div>
  );
}
