import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateCategory,
  useCreateProduct,
  useDeleteCategory,
  useDeleteProduct,
  useGetCategories,
  useGetInventoryLevels,
  useGetProducts,
  useUpdateCategory,
  useUpdateProduct,
} from "@/hooks/useBackend";
import { downloadCsvTemplate, exportToCsv, parseCsvFile } from "@/lib/csvUtils";
import type {
  Category,
  CategoryInput,
  InventoryLevel,
  Product,
  ProductInput,
} from "@/types";
import {
  Download,
  Package,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface ProductsPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

// ── Category Dialog ──────────────────────────────────────────────────────────

interface CategoryDialogProps {
  open: boolean;
  editing: Category | null;
  onClose: () => void;
}

function CategoryDialog({ open, editing, onClose }: CategoryDialogProps) {
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const [name, setName] = useState(editing?.name ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");

  useEffect(() => {
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
  }, [editing]);

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setName(editing?.name ?? "");
      setDescription(editing?.description ?? "");
    } else {
      onClose();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const input: CategoryInput = {
      name: name.trim(),
      description: description.trim(),
    };
    try {
      if (editing) {
        await updateCategory.mutateAsync({ id: editing.id, input });
        toast.success("Category updated");
      } else {
        await createCategory.mutateAsync(input);
        toast.success("Category created");
      }
      onClose();
    } catch {
      toast.error("Failed to save category");
    }
  }

  const loading = createCategory.isPending || updateCategory.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent data-ocid="category.dialog">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Category" : "Add Category"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Name *</Label>
            <Input
              id="cat-name"
              data-ocid="category.name.input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Herbal Teas"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Description</Label>
            <Textarea
              id="cat-desc"
              data-ocid="category.description.textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this category"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="category.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              data-ocid="category.submit_button"
            >
              {loading ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Product Dialog ───────────────────────────────────────────────────────────

interface ProductDialogProps {
  open: boolean;
  editing: Product | null;
  categories: Category[];
  onClose: () => void;
}

const EMPTY_PRODUCT: ProductInput = {
  sku: "",
  name: "",
  category_id: BigInt(0),
  volume_points: 0,
  earn_base: 0,
  mrp: 0,
  hsn_code: "",
};

function ProductDialog({
  open,
  editing,
  categories,
  onClose,
}: ProductDialogProps) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [form, setForm] = useState<ProductInput>(EMPTY_PRODUCT);
  const [skuError, setSkuError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              sku: editing.sku,
              name: editing.name,
              category_id: editing.category_id,
              volume_points: editing.volume_points,
              earn_base: editing.earn_base,
              mrp: editing.mrp,
              hsn_code: editing.hsn_code,
            }
          : EMPTY_PRODUCT,
      );
      setSkuError("");
    }
  }, [open, editing]);

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) onClose();
  }

  function setField<K extends keyof ProductInput>(
    key: K,
    value: ProductInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "sku") setSkuError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.sku.trim()) return;
    if (form.category_id === BigInt(0)) {
      toast.error("Please select a category");
      return;
    }
    try {
      if (editing) {
        const ok = await updateProduct.mutateAsync({
          id: editing.id,
          input: form,
        });
        if (!ok) {
          toast.error("Failed to update product");
          return;
        }
        toast.success("Product updated");
      } else {
        const result = await createProduct.mutateAsync(form);
        if (result === null) {
          setSkuError("SKU already exists. Please use a unique SKU.");
          return;
        }
        toast.success("Product created");
      }
      onClose();
    } catch {
      toast.error("Failed to save product");
    }
  }

  const loading = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-lg max-h-[90vh] overflow-y-auto"
        data-ocid="product.dialog"
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-name">Product Name *</Label>
              <Input
                id="prod-name"
                data-ocid="product.name.input"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="e.g. Ashwagandha Powder"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-sku">SKU *</Label>
              <Input
                id="prod-sku"
                data-ocid="product.sku.input"
                value={form.sku}
                onChange={(e) => setField("sku", e.target.value)}
                placeholder="e.g. AWG-200"
                required
                disabled={!!editing}
              />
              {skuError && (
                <p
                  className="text-xs text-destructive"
                  data-ocid="product.sku.field_error"
                >
                  {skuError}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-category">Category *</Label>
            <Select
              value={
                form.category_id !== BigInt(0)
                  ? form.category_id.toString()
                  : ""
              }
              onValueChange={(v) => setField("category_id", BigInt(v))}
            >
              <SelectTrigger
                id="prod-category"
                data-ocid="product.category.select"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id.toString()} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="prod-mrp">MRP (₹) *</Label>
              <Input
                id="prod-mrp"
                type="number"
                min={0}
                step="0.01"
                data-ocid="product.mrp.input"
                value={form.mrp || ""}
                onChange={(e) =>
                  setField("mrp", Number.parseFloat(e.target.value) || 0)
                }
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-vp">Volume Points *</Label>
              <Input
                id="prod-vp"
                type="number"
                min={0}
                step="0.01"
                data-ocid="product.volume_points.input"
                value={form.volume_points || ""}
                onChange={(e) =>
                  setField(
                    "volume_points",
                    Number.parseFloat(e.target.value) || 0,
                  )
                }
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-earn">Earn Base (₹) *</Label>
              <Input
                id="prod-earn"
                type="number"
                min={0}
                step="0.01"
                data-ocid="product.earn_base.input"
                value={form.earn_base || ""}
                onChange={(e) =>
                  setField("earn_base", Number.parseFloat(e.target.value) || 0)
                }
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-hsn">HSN Code *</Label>
            <Input
              id="prod-hsn"
              data-ocid="product.hsn_code.input"
              value={form.hsn_code}
              onChange={(e) => setField("hsn_code", e.target.value)}
              placeholder="e.g. 1211"
              required
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="product.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              data-ocid="product.submit_button"
            >
              {loading ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk Upload: Categories ───────────────────────────────────────────────────

interface CatUploadRow {
  name: string;
  description: string;
  error?: string;
}

interface BulkCategoryUploadDialogProps {
  open: boolean;
  onClose: () => void;
}

function BulkCategoryUploadDialog({
  open,
  onClose,
}: BulkCategoryUploadDialogProps) {
  const createCategory = useCreateCategory();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CatUploadRow[]>([]);
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseCsvFile(file);
      const validated: CatUploadRow[] = parsed.map((row) => {
        const name = row.name?.trim() ?? "";
        if (!name)
          return {
            name,
            description: row.description ?? "",
            error: "Name is required",
          };
        return { name, description: row.description?.trim() ?? "" };
      });
      setRows(validated);
      setSummary(null);
    } catch {
      toast.error("Failed to parse CSV file");
    }
  }

  async function handleImport() {
    const valid = rows.filter((r) => !r.error);
    if (valid.length === 0) return;
    setImporting(true);
    let imported = 0;
    let errors = 0;
    for (const row of valid) {
      try {
        await createCategory.mutateAsync({
          name: row.name,
          description: row.description,
        });
        imported++;
      } catch {
        errors++;
      }
    }
    setSummary({ imported, errors });
    setImporting(false);
    toast.success(`${imported} categories imported`);
  }

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => !!r.error).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-xl max-h-[80vh] flex flex-col"
        data-ocid="categories.bulk_upload.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Bulk Upload Categories
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsvTemplate("categories_template.csv", [
                  "name",
                  "description",
                ])
              }
              data-ocid="categories.bulk_upload.download_template_button"
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
                data-ocid="categories.bulk_upload.file_input"
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
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={`${row.name}-${row.description}`}
                        className={`border-b border-border last:border-0 ${row.error ? "bg-destructive/5" : ""}`}
                      >
                        <td className="px-3 py-2">
                          {row.name || <em className="opacity-50">empty</em>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">
                          {row.description || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.error ? (
                            <span className="text-destructive">
                              {row.error}
                            </span>
                          ) : (
                            <span className="text-primary">✓ Valid</span>
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
                {summary.imported} imported
                {summary.errors > 0 && `, ${summary.errors} failed`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-ocid="categories.bulk_upload.cancel_button"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={validCount === 0 || importing || !!summary}
            data-ocid="categories.bulk_upload.import_button"
          >
            {importing ? "Importing…" : `Import ${validCount} Categories`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Bulk Upload: Products ─────────────────────────────────────────────────────

interface ProdUploadRow {
  sku: string;
  name: string;
  category_name: string;
  volume_points: string;
  earn_base: string;
  mrp: string;
  hsn_code: string;
  error?: string;
}

interface BulkProductUploadDialogProps {
  open: boolean;
  onClose: () => void;
  categories: Category[];
}

function BulkProductUploadDialog({
  open,
  onClose,
  categories,
}: BulkProductUploadDialogProps) {
  const createProduct = useCreateProduct();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ProdUploadRow[]>([]);
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

  function validate(row: Record<string, string>): ProdUploadRow {
    const sku = row.sku?.trim() ?? "";
    const name = row.name?.trim() ?? "";
    const category_name = row.category_name?.trim() ?? "";
    const mrpRaw = row.mrp?.trim() ?? "";
    const errors: string[] = [];
    if (!sku) errors.push("SKU required");
    if (!name) errors.push("Name required");
    if (!category_name) errors.push("Category name required");
    else if (
      !categories.find(
        (c) => c.name.toLowerCase() === category_name.toLowerCase(),
      )
    ) {
      errors.push(`Category "${category_name}" not found`);
    }
    const mrp = Number.parseFloat(mrpRaw);
    if (Number.isNaN(mrp) || mrp < 0) errors.push("Valid MRP required");
    return {
      sku,
      name,
      category_name,
      volume_points: row.volume_points?.trim() ?? "0",
      earn_base: row.earn_base?.trim() ?? "0",
      mrp: mrpRaw,
      hsn_code: row.hsn_code?.trim() ?? "",
      error: errors.length > 0 ? errors.join("; ") : undefined,
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
    let imported = 0;
    let errors = 0;
    for (const row of valid) {
      const cat = categories.find(
        (c) => c.name.toLowerCase() === row.category_name.toLowerCase(),
      );
      if (!cat) {
        errors++;
        continue;
      }
      try {
        const result = await createProduct.mutateAsync({
          sku: row.sku,
          name: row.name,
          category_id: cat.id,
          volume_points: Number.parseFloat(row.volume_points) || 0,
          earn_base: Number.parseFloat(row.earn_base) || 0,
          mrp: Number.parseFloat(row.mrp) || 0,
          hsn_code: row.hsn_code,
        });
        if (result === null) errors++;
        else imported++;
      } catch {
        errors++;
      }
    }
    setSummary({ imported, errors });
    setImporting(false);
    toast.success(`${imported} products imported`);
  }

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => !!r.error).length;

  const TEMPLATE_HEADERS = [
    "sku",
    "name",
    "category_name",
    "volume_points",
    "earn_base",
    "mrp",
    "hsn_code",
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] flex flex-col"
        data-ocid="products.bulk_upload.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            Bulk Upload Products
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          <p className="text-xs text-muted-foreground">
            Category name must match an existing category exactly
            (case-insensitive).
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsvTemplate("products_template.csv", TEMPLATE_HEADERS)
              }
              data-ocid="products.bulk_upload.download_template_button"
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
                data-ocid="products.bulk_upload.file_input"
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
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      {["SKU", "Name", "Category", "MRP", "Status"].map((h) => (
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
                        key={`${row.sku}-${row.name}`}
                        className={`border-b border-border last:border-0 ${row.error ? "bg-destructive/5" : ""}`}
                      >
                        <td className="px-3 py-2 font-mono">
                          {row.sku || "—"}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[120px]">
                          {row.name || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {row.category_name || "—"}
                        </td>
                        <td className="px-3 py-2">₹{row.mrp || "—"}</td>
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
                {summary.imported} products imported
                {summary.errors > 0 && `, ${summary.errors} failed`}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            data-ocid="products.bulk_upload.cancel_button"
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={validCount === 0 || importing || !!summary}
            data-ocid="products.bulk_upload.import_button"
          >
            {importing ? "Importing…" : `Import ${validCount} Products`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Categories Tab ───────────────────────────────────────────────────────────

interface CategoriesTabProps {
  categories: Category[];
  isLoading: boolean;
}

function CategoriesTab({ categories, isLoading }: CategoriesTabProps) {
  const deleteCategory = useDeleteCategory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCategory.mutateAsync(deleteTarget.id);
      toast.success("Category deleted");
    } catch {
      toast.error("Failed to delete category");
    } finally {
      setDeleteTarget(null);
    }
  }

  function handleExport() {
    const data = categories.map((c) => ({
      name: c.name,
      description: c.description,
    }));
    exportToCsv("categories.csv", data);
    toast.success("Categories exported");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {categories.length}{" "}
          {categories.length === 1 ? "category" : "categories"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={categories.length === 0}
            data-ocid="categories.export_button"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkOpen(true)}
            data-ocid="categories.upload_button"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload
          </Button>
          <Button size="sm" onClick={openAdd} data-ocid="category.add_button">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-ocid="categories.table">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                  Description
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                ["s1", "s2", "s3"].map((sk) => (
                  <tr key={sk} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Skeleton className="h-4 w-48" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-8 w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center"
                    data-ocid="categories.empty_state"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Tag className="w-8 h-8 opacity-40" />
                      <p className="font-medium">No categories yet</p>
                      <p className="text-xs">
                        Add your first product category to get started.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                categories.map((cat, idx) => (
                  <tr
                    key={cat.id.toString()}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    data-ocid={`categories.item.${idx + 1}`}
                  >
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {cat.description || (
                        <span className="italic opacity-50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(cat)}
                          aria-label="Edit category"
                          data-ocid={`categories.edit_button.${idx + 1}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(cat)}
                          aria-label="Delete category"
                          data-ocid={`categories.delete_button.${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CategoryDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
      />

      <BulkCategoryUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="category.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="category.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="category.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Products Tab ─────────────────────────────────────────────────────────────

interface ProductsTabProps {
  products: Product[];
  categories: Category[];
  inventoryLevels: InventoryLevel[];
  isLoading: boolean;
}

function ProductsTab({
  products,
  categories,
  inventoryLevels,
  isLoading,
}: ProductsTabProps) {
  const deleteProduct = useDeleteProduct();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [bulkOpen, setBulkOpen] = useState(false);

  const stockMap = new Map<string, bigint>();
  for (const lvl of inventoryLevels) {
    stockMap.set(lvl.product_id.toString(), lvl.total_qty);
  }

  const categoryMap = new Map<string, string>();
  for (const cat of categories) {
    categoryMap.set(cat.id.toString(), cat.name);
  }

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      filterCategory === "all" || p.category_id.toString() === filterCategory;
    return matchSearch && matchCat;
  });

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteProduct.mutateAsync(deleteTarget.id);
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeleteTarget(null);
    }
  }

  function handleExport() {
    const data = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      category_name: categoryMap.get(p.category_id.toString()) ?? "",
      volume_points: p.volume_points,
      earn_base: p.earn_base,
      mrp: p.mrp,
      hsn_code: p.hsn_code,
    }));
    exportToCsv("products.csv", data);
    toast.success("Products exported");
  }

  const LOW_STOCK_THRESHOLD = BigInt(10);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-ocid="products.search_input"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger
              className="w-full sm:w-44"
              data-ocid="products.category.select"
            >
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id.toString()} value={cat.id.toString()}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={products.length === 0}
            className="flex-1 sm:flex-none"
            data-ocid="products.export_button"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkOpen(true)}
            className="flex-1 sm:flex-none"
            data-ocid="products.upload_button"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Upload
          </Button>
          <Button
            size="sm"
            onClick={openAdd}
            className="flex-1 sm:flex-none"
            data-ocid="product.add_button"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full text-sm min-w-[640px]"
            data-ocid="products.table"
          >
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Name / SKU
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  MRP (₹)
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Vol. Pts
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Earn Base
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Stock
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                ["r1", "r2", "r3", "r4"].map((rk) => (
                  <tr key={rk} className="border-b border-border last:border-0">
                    {["c1", "c2", "c3", "c4", "c5", "c6", "c7"].map((ck) => (
                      <td key={ck} className="px-4 py-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center"
                    data-ocid="products.empty_state"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Package className="w-8 h-8 opacity-40" />
                      <p className="font-medium">
                        {products.length === 0
                          ? "No products yet"
                          : "No products match your filter"}
                      </p>
                      {products.length === 0 && (
                        <p className="text-xs">
                          Add your first product to get started.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((product, idx) => {
                  const stock =
                    stockMap.get(product.id.toString()) ?? BigInt(0);
                  const isLow = stock < LOW_STOCK_THRESHOLD;
                  const catName =
                    categoryMap.get(product.category_id.toString()) ?? "—";
                  return (
                    <tr
                      key={product.id.toString()}
                      className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                      data-ocid={`products.item.${idx + 1}`}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {product.sku}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">
                          {catName}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        ₹{product.mrp.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {product.volume_points}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        ₹{product.earn_base.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 tabular-nums text-xs font-medium ${
                            isLow ? "text-destructive" : "text-foreground"
                          }`}
                        >
                          {stock.toString()}
                          {isLow && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-1 py-0"
                            >
                              Low
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(product)}
                            aria-label="Edit product"
                            data-ocid={`products.edit_button.${idx + 1}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(product)}
                            aria-label="Delete product"
                            data-ocid={`products.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ProductDialog
        open={dialogOpen}
        editing={editing}
        categories={categories}
        onClose={() => setDialogOpen(false)}
      />

      <BulkProductUploadDialog
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        categories={categories}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="product.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deleteTarget?.name}</strong>? This cannot be undone and
              may affect inventory data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="product.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="product.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ProductsPage({ onNavigate: _onNavigate }: ProductsPageProps) {
  const { data: products = [], isLoading: productsLoading } = useGetProducts();
  const { data: categories = [], isLoading: categoriesLoading } =
    useGetCategories();
  const { data: inventoryLevels = [] } = useGetInventoryLevels();

  return (
    <div className="space-y-6" data-ocid="products.page">
      <div>
        <h1 className="text-2xl font-display font-semibold tracking-tight">
          Products & Categories
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your product catalogue and categories
        </p>
      </div>

      <Tabs defaultValue="products" data-ocid="products.tab">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger
            value="products"
            className="flex-1 sm:flex-none"
            data-ocid="products.products.tab"
          >
            <Package className="w-4 h-4 mr-1.5" />
            Products
            {products.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                {products.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="categories"
            className="flex-1 sm:flex-none"
            data-ocid="products.categories.tab"
          >
            <Tag className="w-4 h-4 mr-1.5" />
            Categories
            {categories.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                {categories.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <ProductsTab
            products={products}
            categories={categories}
            inventoryLevels={inventoryLevels}
            isLoading={productsLoading}
          />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab
            categories={categories}
            isLoading={categoriesLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
