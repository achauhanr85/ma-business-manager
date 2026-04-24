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
import type {
  Category,
  CategoryInput,
  InventoryLevel,
  Product,
  ProductInput,
} from "@/types";
import { Package, Pencil, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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

  // Sync form fields whenever the editing prop changes (e.g. switching between categories)
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

  // Sync form fields whenever editing changes OR dialog opens — this is the
  // fix for the blank edit form bug: useState initializer only runs at mount,
  // so we must explicitly hydrate form state on each editing change.
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
    if (!isOpen) {
      onClose();
    }
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.length}{" "}
          {categories.length === 1 ? "category" : "categories"}
        </p>
        <Button size="sm" onClick={openAdd} data-ocid="category.add_button">
          <Plus className="w-4 h-4 mr-1.5" />
          Add Category
        </Button>
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
        <Button
          size="sm"
          onClick={openAdd}
          className="w-full sm:w-auto"
          data-ocid="product.add_button"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Product
        </Button>
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
