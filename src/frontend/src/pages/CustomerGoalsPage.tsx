/*
 * PAGE: CustomerGoalsPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Master data management for customer goals. Admin creates/edits/deletes
 *   goal definitions (e.g. "Weight Loss", "Muscle Gain") and can bundle
 *   products to each goal so the cart pre-fills when a goal is selected on a sale.
 *
 * ROLE ACCESS:
 *   admin, superAdmin (impersonating) — staff view only, no edit
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ profileKey resolved: ImpersonationContext.activeProfileKey if set,
 *      │    else ProfileContext.userProfile.profile_key
 *      │    (CRITICAL: must use impersonation-aware key so Super Admin can manage
 *      │     goals for any profile they are currently impersonating)
 *      └─ useGetGoalMasterData(profileKey) → loads goals list for this profile
 *   2. Goal list rendering
 *      ├─ Loading → skeleton rows
 *      ├─ Error / no profileKey → "Select a business profile" message
 *      ├─ Empty → "No goals yet" empty state with Add button
 *      └─ Data → list of goals with Edit / Delete buttons per row
 *   3. Add goal
 *      ├─ "Add Goal" button → GoalDialog opens in CREATE mode (editing = null)
 *      ├─ GoalDialog validates: name required + checks for DUPLICATE name (case-insensitive)
 *      │    against currently loaded goals list BEFORE calling the backend
 *      │    → inline error shown if duplicate found, submission blocked
 *      ├─ useCreateGoalMaster.mutateAsync({ profileKey, name, description })
 *      │    → backend also enforces uniqueness per profile; error surfaced in UI
 *      └─ success → toast + list refetches (React Query invalidation)
 *   4. Edit goal
 *      ├─ Pencil icon on a goal row → GoalDialog opens in EDIT mode (editing = goal)
 *      ├─ GoalDialog pre-fills form with current name/description/product bundle
 *      ├─ Duplicate check EXCLUDES the goal currently being edited
 *      │    (a goal can keep its own name when editing other fields)
 *      ├─ useUpdateGoalMaster.mutateAsync({ id, name, description, productBundle })
 *      └─ success → toast + list refetches
 *   5. Delete goal
 *      ├─ Trash icon → AlertDialog shows "Are you sure you want to delete [name]?"
 *      ├─ Confirm → useDeleteGoalMaster.mutateAsync(id)
 *      └─ success → toast + list refetches
 *   6. Product bundle management
 *      ├─ within GoalDialog: products can be added/removed from the bundle
 *      └─ stored as product_bundle: bigint[] on the goal record
 *   7. CSV export / import
 *      ├─ Export → exportToCsv(goals)
 *      └─ Import → parseCsvFile() → createGoalMaster per row
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - dialogOpen: boolean = false              // GoalDialog open state
 *   - editingGoal: GoalMasterPublic | null     // goal being edited (null = create)
 *   - deleteTarget: GoalMasterPublic | null    // goal pending delete confirm
 *   - profileKey: string                       // impersonation-aware active profile key
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   none — data loads via React Query (useGetGoalMasterData) on profileKey change
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - openAdd: clears editing, opens dialog in create mode
 *   - openEdit: sets editing goal, opens dialog in edit mode
 *   - handleDelete: calls useDeleteGoalMaster after AlertDialog confirmation
 *   - GoalDialog.handleSubmit: validates uniqueness, then calls create or update
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
import { useImpersonation } from "@/contexts/ImpersonationContext";
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
//
// Used for both CREATE and EDIT mode depending on whether `editing` is null.
//
// UNIQUE NAME VALIDATION:
//   Before calling the backend, we check if a goal with the same name already
//   exists in the loaded list. This is a client-side pre-check to give instant
//   feedback without a round-trip. The backend will also reject duplicates —
//   if the backend returns an error, we surface it in the UI as well.
//
//   CREATE: checks ALL existing goals (case-insensitive).
//   EDIT:   checks all goals EXCEPT the one currently being edited
//           (so a goal can keep its own name when only updating description/bundle).

interface GoalDialogProps {
  open: boolean;
  editing: GoalMasterPublic | null;
  profileKey: string;
  existingGoals: GoalMasterPublic[]; // pass the loaded list for duplicate check
  onClose: () => void;
}

function GoalDialog({
  open,
  editing,
  profileKey,
  existingGoals,
  onClose,
}: GoalDialogProps) {
  const products = useGetProductsLocal();
  const createGoal = useCreateGoalMaster();
  const updateGoal = useUpdateGoalMaster();
  const [form, setForm] = useState<GoalFormState>(EMPTY_FORM);
  // nameError holds the inline duplicate error message (empty string = no error)
  const [nameError, setNameError] = useState<string>("");
  const [productSearch, setProductSearch] = useState("");
  const prevOpenRef = useRef(open);

  // Reset form and clear errors whenever the dialog opens/closes
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
        setNameError(""); // clear any previous error when dialog re-opens
      }, 0);
    }
  }

  /**
   * Check if the given name already exists in the loaded goals list.
   *
   * @param name - the name to check (will be trimmed + lowercased for comparison)
   * @returns true if a DIFFERENT goal already has this name
   *
   * Why "different goal": when editing, the goal being edited should be excluded
   * from the check. Otherwise typing the same name back in would incorrectly
   * trigger the "already exists" error.
   */
  function isDuplicateName(name: string): boolean {
    const normalised = name.trim().toLowerCase();
    return existingGoals.some(
      (g) =>
        g.name.toLowerCase() === normalised &&
        // Exclude the goal being edited so it can keep its own name
        (!editing || g.id !== editing.id),
    );
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

  /**
   * handleSubmit — validates the form, checks for duplicate names, then calls
   * the appropriate backend mutation (create or update).
   *
   * Validation order:
   *   1. Name must not be empty
   *   2. Name must not duplicate an existing goal (client-side check)
   *   3. Call backend — surface any backend error (e.g. race condition duplicate)
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Step 1: name required check
    if (!form.name.trim()) {
      toast.error("Goal name is required");
      return;
    }

    // Step 2: client-side duplicate name check
    // This prevents a backend round-trip and gives instant feedback.
    if (isDuplicateName(form.name)) {
      setNameError("A goal with this name already exists");
      return;
    }

    // Clear any previous duplicate error before submitting
    setNameError("");

    try {
      if (editing) {
        // UPDATE MODE: update name, description, and product bundle
        await updateGoal.mutateAsync({
          id: editing.id,
          name: form.name.trim(),
          description: form.description,
          productBundle: form.product_bundle,
        });
        toast.success("Goal updated");
      } else {
        // CREATE MODE: create a new goal in this profile
        await createGoal.mutateAsync({
          profileKey,
          name: form.name.trim(),
          description: form.description,
        });
        toast.success("Goal created");
      }
      onClose();
    } catch (err) {
      // Surface backend error message (e.g. backend duplicate rejection)
      const msg = err instanceof Error ? err.message : String(err);
      // Show a meaningful error — if the backend says "already exists" show that
      if (
        msg.toLowerCase().includes("already exists") ||
        msg.toLowerCase().includes("duplicate")
      ) {
        setNameError("A goal with this name already exists");
      } else {
        toast.error(
          editing ? "Failed to update goal" : "Failed to create goal",
        );
      }
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
              onChange={(e) => {
                // Clear the duplicate error whenever the user changes the name field
                setForm((p) => ({ ...p, name: e.target.value }));
                if (nameError) setNameError("");
              }}
              placeholder="e.g. Weight Loss, Muscle Gain"
              required
              autoFocus
              className={nameError ? "border-destructive" : ""}
            />
            {/* Inline duplicate name error — shown when user tries to submit a duplicate */}
            {nameError && (
              <p
                className="text-xs text-destructive flex items-center gap-1"
                data-ocid="goal.name.field_error"
              >
                {nameError}
              </p>
            )}
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
  const { userProfile, superAdminActiveProfileKey, profile } = useProfile();
  const { isImpersonating, profileKey: impersonatedProfileKey } =
    useImpersonation();

  // IMPERSONATION FIX: Super Admin has no profile_key on their own userProfile record.
  // When impersonating, use the impersonatedProfileKey from ImpersonationContext first
  // (this is set when they click "View As" on a profile), then fall back to
  // superAdminActiveProfileKey (set from backend on SA login), then userProfile/profile.
  // Priority: impersonation key > superAdminActiveProfileKey > userProfile.profile_key > profile.profile_key
  const profileKey = isImpersonating
    ? impersonatedProfileKey || superAdminActiveProfileKey
    : (userProfile?.profile_key ?? profile?.profile_key ?? null);

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

  // No profile key yet — show a helpful message instead of an empty broken page.
  // Distinguish between: Super Admin impersonating with no profile selected vs. normal user with no profile.
  if (!profileKey) {
    const message = isImpersonating
      ? "No profile selected for impersonation. Please select a profile from the Super Admin dashboard."
      : "Select a business profile to manage goals.";
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
          <p className="text-sm text-muted-foreground">{message}</p>
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

      {/* Goal form dialog — pass existingGoals so the dialog can check for duplicates */}
      <GoalDialog
        open={dialogOpen}
        editing={editing}
        profileKey={profileKey}
        existingGoals={goals}
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
