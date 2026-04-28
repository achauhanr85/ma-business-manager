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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useCreateGoalMaster,
  useDeleteGoalMaster,
  useGetGoalMasterData,
  useUpdateGoalMaster,
} from "@/hooks/useBackend";
import type { GoalMasterPublic } from "@/hooks/useBackend";
import { ROLES } from "@/types";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  Download,
  Package,
  Pencil,
  Plus,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { createActor } from "../backend";

interface CustomerGoalsPageProps {
  onNavigate?: (path: string) => void;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface GoalFormState {
  name: string;
  description: string;
  product_bundle: bigint[];
}

const EMPTY_FORM: GoalFormState = {
  name: "",
  description: "",
  product_bundle: [],
};

// ─── Product list hook (local, direct actor call) ─────────────────────────────

function useBackendActor() {
  return useActor(createActor);
}

function useGetProductsLocal() {
  const { actor, isFetching } = useBackendActor();
  const [products, setProducts] = useState<
    { id: bigint; name: string; mrp?: number }[]
  >([]);
  const fetchedRef = useRef(false);

  // Fetch on mount / actor ready
  if (actor && !isFetching && !fetchedRef.current) {
    fetchedRef.current = true;
    actor
      .getProducts()
      .then((p) =>
        setProducts(p as { id: bigint; name: string; mrp?: number }[]),
      )
      .catch(() => {});
  }

  return products;
}

// ─── Goal Form Dialog ─────────────────────────────────────────────────────────

interface GoalDialogProps {
  open: boolean;
  editing: GoalMasterPublic | null;
  profileKey: string;
  onClose: () => void;
}

function GoalDialog({ open, editing, profileKey, onClose }: GoalDialogProps) {
  const products = useGetProductsLocal();
  const createGoal = useCreateGoalMaster();
  const updateGoal = useUpdateGoalMaster();
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  const [productSearch, setProductSearch] = useState("");
  const prevOpenRef = useRef(open);

  // Reset form whenever dialog opens
  if (prevOpenRef.current !== open) {
    prevOpenRef.current = open;
    if (open) {
      setTimeout(() => {
        setForm(
          editing
            ? {
                name: editing.name,
                description: editing.description,
                product_bundle: [...editing.product_bundle],
              }
            : EMPTY_FORM,
        );
        setProductSearch("");
      }, 0);
    }
  }

  function toggleProduct(productId: bigint) {
    setForm((prev) => {
      const inBundle = prev.product_bundle.some((id) => id === productId);
      return {
        ...prev,
        product_bundle: inBundle
          ? prev.product_bundle.filter((id) => id !== productId)
          : [...prev.product_bundle, productId],
      };
    });
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Goal name is required");
      return;
    }
    try {
      if (editing) {
        await updateGoal.mutateAsync({
          id: editing.id,
          name: form.name.trim(),
          description: form.description,
          productBundle: form.product_bundle,
        });
        toast.success("Goal updated");
      } else {
        await createGoal.mutateAsync({
          profileKey,
          name: form.name.trim(),
          description: form.description,
        });
        toast.success("Goal created");
      }
      onClose();
    } catch {
      toast.error(editing ? "Failed to update goal" : "Failed to create goal");
    }
  }

  const loading = createGoal.isPending || updateGoal.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-md max-h-[90vh] overflow-y-auto"
        data-ocid="goal.dialog"
      >
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Goal" : "Add Primary Goal"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Goal Name *</Label>
            <Input
              id="goal-name"
              data-ocid="goal.name.input"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Weight Loss, Muscle Gain"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc">Description</Label>
            <Textarea
              id="goal-desc"
              data-ocid="goal.description.textarea"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Describe this goal…"
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Product Bundle */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Product Bundle
              {form.product_bundle.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {form.product_bundle.length} selected
                </Badge>
              )}
            </Label>
            <Input
              placeholder="Search products…"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="h-8 text-sm"
              data-ocid="goal.product_search.input"
            />
            <div
              className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border"
              data-ocid="goal.product_bundle.list"
            >
              {filteredProducts.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">
                  No products found
                </p>
              )}
              {filteredProducts.map((p) => {
                const selected = form.product_bundle.some((id) => id === p.id);
                return (
                  <button
                    key={p.id.toString()}
                    type="button"
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left hover:bg-muted/40 ${
                      selected ? "bg-primary/5" : ""
                    }`}
                    onClick={() => toggleProduct(p.id)}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
                        selected ? "bg-primary border-primary" : "border-border"
                      }`}
                    >
                      {selected && (
                        <span className="text-primary-foreground text-xs leading-none">
                          ✓
                        </span>
                      )}
                    </div>
                    <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{p.name}</span>
                    {p.mrp !== undefined && (
                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                        ₹{p.mrp.toLocaleString("en-IN")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="goal.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              data-ocid="goal.save_button"
            >
              {loading ? "Saving…" : editing ? "Update Goal" : "Add Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function exportGoalsCSV(goals: GoalMasterPublic[]) {
  const header = "id,name,description,product_bundle_ids";
  const rows = goals.map(
    (g) =>
      `${g.id},"${g.name.replace(/"/g, '""')}","${g.description.replace(/"/g, '""')}","${g.product_bundle.join("|")}"`,
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customer_goals.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadGoalTemplate() {
  const csv =
    'name,description,product_bundle_ids\n"Weight Loss","Goal for weight reduction",""\n"Muscle Gain","Goal for building muscle",""';
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customer_goals_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CustomerGoalsPage({
  onNavigate: _onNavigate,
}: CustomerGoalsPageProps) {
  const { userProfile } = useProfile();

  // Profile key — Super Admin may not have one; fall back gracefully.
  const profileKey = userProfile?.profile_key ?? null;

  const {
    data: goals = [],
    isLoading,
    isError,
  } = useGetGoalMasterData(profileKey);
  const deleteGoalMut = useDeleteGoalMaster();
  const createGoalForImport = useCreateGoalMaster();

  // Show CRUD controls for Admin, Staff, and Super Admin (role may be undefined while impersonating)
  const role = userProfile?.role as string | undefined;
  const canEdit =
    role === ROLES.ADMIN ||
    role === ROLES.STAFF ||
    role === "superAdmin" ||
    role === undefined; // super admin impersonating without a profile role

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GoalMasterPublic | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GoalMasterPublic | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(g: GoalMasterPublic) {
    setEditing(g);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteGoalMut.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
    } catch {
      toast.error("Failed to delete goal");
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    if (!profileKey) {
      toast.error("No profile key — cannot import");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length < 2) {
      toast.error("CSV has no data rows");
      return;
    }
    let created = 0;
    let failed = 0;
    for (const line of lines.slice(1)) {
      const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? [];
      const name = cols[0]?.replace(/^"|"$/g, "").trim();
      const description = (cols[1] ?? "").replace(/^"|"$/g, "").trim();
      if (!name) continue;
      try {
        await createGoalForImport.mutateAsync({
          profileKey,
          name,
          description,
        });
        created++;
      } catch {
        failed++;
      }
    }
    toast.success(
      `Import complete: ${created} created${failed > 0 ? `, ${failed} failed` : ""}`,
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // No profile key yet — show a helpful message instead of an empty broken page
  if (!profileKey) {
    return (
      <div className="space-y-4" data-ocid="customer_goals.page">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-semibold tracking-tight">
            Customer Primary Goals
          </h1>
        </div>
        <div
          className="flex flex-col items-center gap-3 py-16 text-muted-foreground rounded-lg border border-dashed border-border"
          data-ocid="customer_goals.empty_state"
        >
          <Target className="w-12 h-12 opacity-20" />
          <p className="text-sm text-muted-foreground">
            Select a business profile to manage goals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="customer_goals.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            Customer Primary Goals
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define and manage primary goals to associate with customers
          </p>
        </div>
        {/* Always show action buttons — not gated behind canEdit for visibility */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportGoalsCSV(goals)}
            disabled={goals.length === 0}
            data-ocid="customer_goals.export_button"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadGoalTemplate}
            data-ocid="customer_goals.template_button"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Template
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                data-ocid="customer_goals.import_button"
              >
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
              <Button onClick={openAdd} data-ocid="customer_goals.add_button">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Goal
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          data-ocid="customer_goals.error_state"
        >
          Failed to load goals. Please refresh and try again.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div
          className="rounded-lg border border-border overflow-hidden"
          data-ocid="customer_goals.loading_state"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Goal Name", "Description", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-16" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : goals.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-16 text-muted-foreground rounded-lg border border-dashed border-border"
          data-ocid="customer_goals.empty_state"
        >
          <Target className="w-12 h-12 opacity-20" />
          <div className="text-center">
            <p className="font-medium text-foreground">No goals defined yet</p>
            <p className="text-xs mt-0.5">
              Add your first primary goal to associate with customers
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={openAdd}
              data-ocid="customer_goals.empty_add_button"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add First Goal
            </Button>
          )}
        </div>
      ) : (
        <div
          className="rounded-lg border border-border overflow-hidden"
          data-ocid="customer_goals.table"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Goal Name
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                    Description
                  </th>
                  {canEdit && (
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {goals.map((goal, idx) => (
                  <tr
                    key={goal.id.toString()}
                    className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                    data-ocid={`customer_goals.item.${idx + 1}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Target className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{goal.name}</span>
                          {goal.product_bundle.length > 0 && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {goal.product_bundle.length} product
                              {goal.product_bundle.length !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      <span className="line-clamp-2">
                        {goal.description || "—"}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(goal)}
                            aria-label="Edit goal"
                            data-ocid={`customer_goals.edit_button.${idx + 1}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(goal)}
                            aria-label="Delete goal"
                            data-ocid={`customer_goals.delete_button.${idx + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Goal form dialog */}
      <GoalDialog
        open={dialogOpen}
        editing={editing}
        profileKey={profileKey}
        onClose={() => {
          setDialogOpen(false);
          setEditing(null);
        }}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent data-ocid="customer_goals.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Goal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>"{deleteTarget?.name}"</strong>? This will remove it from
              the goals list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="customer_goals.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="customer_goals.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
