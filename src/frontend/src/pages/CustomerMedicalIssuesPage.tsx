/*
 * PAGE: CustomerMedicalIssuesPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Master data management for customer medical issues. Admin creates/edits/
 *   deletes medical issue definitions (e.g. "Diabetes", "Hypertension") that
 *   can be assigned to individual customers for tracking health context.
 *
 * ROLE ACCESS:
 *   admin, superAdmin (impersonating) — staff view only, no edit
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ profileKey resolved: ImpersonationContext.activeProfileKey if set,
 *      │    else ProfileContext.userProfile.profile_key
 *      │    (CRITICAL: impersonation-aware so Super Admin manages the correct
 *      │     profile's medical issues when impersonating)
 *      └─ useGetMedicalIssueMasterData(profileKey) → loads issues list
 *   2. Issue list rendering
 *      ├─ Loading → skeleton rows
 *      ├─ Error / no profileKey → "Select a business profile" message
 *      ├─ Empty → empty state with Add button
 *      └─ Data → list of issues with Edit / Delete buttons per row
 *   3. Add medical issue
 *      ├─ "Add Issue" button → IssueDialog opens in CREATE mode (editing = null)
 *      ├─ IssueDialog validates: name required + checks for DUPLICATE name
 *      │    (case-insensitive) against currently loaded issues list BEFORE backend
 *      │    → inline error shown if duplicate found, submission blocked
 *      ├─ useCreateMedicalIssueMaster.mutateAsync({ profileKey, name, description })
 *      │    → backend also enforces uniqueness; error surfaced in UI if rejected
 *      └─ success → toast + list refetches (React Query invalidation)
 *   4. Edit medical issue
 *      ├─ Pencil icon → IssueDialog opens in EDIT mode (editing = issue)
 *      ├─ IssueDialog pre-fills form with current name/description
 *      ├─ Duplicate check EXCLUDES the issue currently being edited
 *      ├─ useUpdateMedicalIssueMaster.mutateAsync({ id, name, description })
 *      └─ success → toast + list refetches
 *   5. Delete medical issue
 *      ├─ Trash icon → AlertDialog shows "Are you sure you want to delete [name]?"
 *      ├─ Confirm → useDeleteMedicalIssueMaster.mutateAsync(id)
 *      └─ success → toast + list refetches
 *   6. CSV export / import
 *      ├─ Export → CSV download
 *      └─ Import → CSV parse → createMedicalIssueMaster per row
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - dialogOpen: boolean = false                    // IssueDialog open state
 *   - editingIssue: MedicalIssueMasterPublic | null  // null = create mode
 *   - deleteTarget: MedicalIssueMasterPublic | null  // pending delete confirm
 *   - profileKey: string                             // impersonation-aware key
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   none — data loads via React Query (useGetMedicalIssueMasterData) on profileKey change
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - openAdd: clears editing, opens dialog in create mode
 *   - openEdit: sets editing issue, opens dialog in edit mode
 *   - handleDelete: calls useDeleteMedicalIssueMaster after AlertDialog confirmation
 *   - IssueDialog.handleSubmit: validates uniqueness, then calls create or update
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
  useCreateMedicalIssueMaster,
  useDeleteMedicalIssueMaster,
  useGetMedicalIssueMasterData,
  useUpdateMedicalIssueMaster,
} from "@/hooks/useBackend";
import type { MedicalIssueMasterPublic } from "@/hooks/useBackend";
import { ROLES } from "@/types";
import { Activity, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface CustomerMedicalIssuesPageProps {
  onNavigate?: (path: string) => void;
}

// ─── Local form state ─────────────────────────────────────────────────────────

interface IssueFormState {
  name: string;
  description: string;
}

const EMPTY_FORM: IssueFormState = { name: "", description: "" };

// ─── Issue Form Dialog ────────────────────────────────────────────────────────
//
// Used for both CREATE and EDIT mode depending on whether `editing` is null.
//
// UNIQUE NAME VALIDATION:
//   Before calling the backend, we check if an issue with the same name already
//   exists in the loaded list. Gives instant feedback without a backend round-trip.
//   The backend will also reject duplicates — if it returns an error, we surface it.
//
//   CREATE: checks ALL existing issues (case-insensitive).
//   EDIT:   checks all issues EXCEPT the one currently being edited
//           (so an issue can keep its own name when only updating description).

interface IssueDialogProps {
  open: boolean;
  editing: MedicalIssueMasterPublic | null;
  profileKey: string;
  existingIssues: MedicalIssueMasterPublic[]; // loaded list for duplicate check
  onClose: () => void;
}

function IssueDialog({
  open,
  editing,
  profileKey,
  existingIssues,
  onClose,
}: IssueDialogProps) {
  const createIssue = useCreateMedicalIssueMaster();
  const updateIssue = useUpdateMedicalIssueMaster();
  const [form, setForm] = useState<IssueFormState>(EMPTY_FORM);
  // nameError holds the inline duplicate error message (empty string = no error)
  const [nameError, setNameError] = useState<string>("");
  const prevOpenRef = useRef(open);

  // Reset form and clear errors whenever the dialog opens or switches mode
  if (prevOpenRef.current !== open) {
    prevOpenRef.current = open;
    if (open) {
      setTimeout(() => {
        setForm(
          editing
            ? { name: editing.name, description: editing.description }
            : EMPTY_FORM,
        );
        setNameError(""); // clear any previous error when dialog re-opens
      }, 0);
    }
  }

  /**
   * Check if the given name already exists in the loaded issues list.
   *
   * @param name - the name to check (trimmed + lowercased for comparison)
   * @returns true if a DIFFERENT issue already has this name
   *
   * Why "different issue": when editing, the issue being edited is excluded
   * so it can keep its own name when only updating the description.
   */
  function isDuplicateName(name: string): boolean {
    const normalised = name.trim().toLowerCase();
    return existingIssues.some(
      (i) =>
        i.name.toLowerCase() === normalised &&
        // Exclude the issue being edited so it can keep its own name
        (!editing || i.id !== editing.id),
    );
  }

  /**
   * handleSubmit — validates the form, checks for duplicate names, then calls
   * the appropriate backend mutation (create or update).
   *
   * Validation order:
   *   1. Name must not be empty
   *   2. Name must not duplicate an existing issue (client-side check)
   *   3. Call backend — surface any backend error (e.g. race condition duplicate)
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Step 1: name required check
    if (!form.name.trim()) {
      toast.error("Issue name is required");
      return;
    }

    // Step 2: client-side duplicate name check for instant feedback
    if (isDuplicateName(form.name)) {
      setNameError("A medical issue with this name already exists");
      return;
    }

    // Clear any previous duplicate error before submitting
    setNameError("");

    try {
      if (editing) {
        // UPDATE MODE
        await updateIssue.mutateAsync({
          id: editing.id,
          name: form.name.trim(),
          description: form.description,
        });
        toast.success("Medical issue updated");
      } else {
        // CREATE MODE
        await createIssue.mutateAsync({
          profileKey,
          name: form.name.trim(),
          description: form.description,
        });
        toast.success("Medical issue created");
      }
      onClose();
    } catch (err) {
      // Surface backend error — if it says "already exists", show inline error
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes("already exists") ||
        msg.toLowerCase().includes("duplicate")
      ) {
        setNameError("A medical issue with this name already exists");
      } else {
        toast.error(
          editing
            ? "Failed to update medical issue"
            : "Failed to create medical issue",
        );
      }
    }
  }

  const loading = createIssue.isPending || updateIssue.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm" data-ocid="medical_issue.dialog">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit Medical Issue" : "Add Medical Issue"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="issue-name">Issue Name *</Label>
            <Input
              id="issue-name"
              data-ocid="medical_issue.name.input"
              value={form.name}
              onChange={(e) => {
                // Clear the duplicate error whenever the user changes the name field
                setForm((p) => ({ ...p, name: e.target.value }));
                if (nameError) setNameError("");
              }}
              placeholder="e.g. Diabetes, Hypertension"
              required
              autoFocus
              className={nameError ? "border-destructive" : ""}
            />
            {/* Inline duplicate name error — shown when user tries to submit a duplicate */}
            {nameError && (
              <p
                className="text-xs text-destructive flex items-center gap-1"
                data-ocid="medical_issue.name.field_error"
              >
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue-desc">Description</Label>
            <Textarea
              id="issue-desc"
              data-ocid="medical_issue.description.textarea"
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              placeholder="Additional details about this medical issue…"
              rows={3}
              className="text-sm resize-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="medical_issue.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              data-ocid="medical_issue.save_button"
            >
              {loading ? "Saving…" : editing ? "Update Issue" : "Add Issue"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────

function exportIssuesCSV(issues: MedicalIssueMasterPublic[]) {
  const header = "id,name,description";
  const rows = issues.map(
    (i) =>
      `${i.id},"${i.name.replace(/"/g, '""')}","${i.description.replace(/"/g, '""')}"`,
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "medical_issues.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function downloadIssueTemplate() {
  const csv =
    'name,description\n"Diabetes","Type 2 diabetes management"\n"Hypertension","High blood pressure"';
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "medical_issues_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CustomerMedicalIssuesPage({
  onNavigate: _onNavigate,
}: CustomerMedicalIssuesPageProps) {
  const { userProfile, superAdminActiveProfileKey, profile } = useProfile();
  const { isImpersonating, profileKey: impersonatedProfileKey } =
    useImpersonation();

  // IMPERSONATION FIX: Super Admin has no profile_key on their own userProfile record.
  // When impersonating, use the impersonatedProfileKey from ImpersonationContext first
  // (set when they click "View As" on a profile), then fall back to
  // superAdminActiveProfileKey (set from backend on SA login), then userProfile/profile.
  // Priority: impersonation key > superAdminActiveProfileKey > userProfile.profile_key
  const profileKey = isImpersonating
    ? impersonatedProfileKey || superAdminActiveProfileKey
    : (userProfile?.profile_key ?? profile?.profile_key ?? null);

  const {
    data: issues = [],
    isLoading,
    isError,
  } = useGetMedicalIssueMasterData(profileKey);
  const deleteIssueMut = useDeleteMedicalIssueMaster();
  const createIssueForImport = useCreateMedicalIssueMaster();

  const role = userProfile?.role as string | undefined;
  const canEdit =
    role === ROLES.ADMIN ||
    role === ROLES.STAFF ||
    role === "superAdmin" ||
    role === undefined;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MedicalIssueMasterPublic | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<MedicalIssueMasterPublic | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(issue: MedicalIssueMasterPublic) {
    setEditing(issue);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteIssueMut.mutateAsync(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deleted`);
    } catch {
      toast.error("Failed to delete medical issue");
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
        await createIssueForImport.mutateAsync({
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

  // No profile key — show a helpful message.
  // Distinguish impersonation with no profile selected vs. normal user with no profile.
  if (!profileKey) {
    const message = isImpersonating
      ? "No profile selected for impersonation. Please select a profile from the Super Admin dashboard."
      : "Select a business profile to manage medical issues.";
    return (
      <div className="space-y-4" data-ocid="medical_issues.page">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-display font-semibold tracking-tight">
            Customer Medical Issues
          </h1>
        </div>
        <div
          className="flex flex-col items-center gap-3 py-16 text-muted-foreground rounded-lg border border-dashed border-border"
          data-ocid="medical_issues.empty_state"
        >
          <Activity className="w-12 h-12 opacity-20" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="medical_issues.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            Customer Medical Issues
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define medical conditions to associate with customers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportIssuesCSV(issues)}
            disabled={issues.length === 0}
            data-ocid="medical_issues.export_button"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={downloadIssueTemplate}
            data-ocid="medical_issues.template_button"
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
                data-ocid="medical_issues.import_button"
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
              <Button onClick={openAdd} data-ocid="medical_issues.add_button">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Medical Issue
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          data-ocid="medical_issues.error_state"
        >
          Failed to load medical issues. Please refresh and try again.
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div
          className="rounded-lg border border-border overflow-hidden"
          data-ocid="medical_issues.loading_state"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Issue Name", "Description", "Actions"].map((h) => (
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
      ) : issues.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-16 text-muted-foreground rounded-lg border border-dashed border-border"
          data-ocid="medical_issues.empty_state"
        >
          <Activity className="w-12 h-12 opacity-20" />
          <div className="text-center">
            <p className="font-medium text-foreground">
              No medical issues defined yet
            </p>
            <p className="text-xs mt-0.5">
              Add medical conditions to track customer health context
            </p>
          </div>
          {canEdit && (
            <Button
              size="sm"
              onClick={openAdd}
              data-ocid="medical_issues.empty_add_button"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add First Issue
            </Button>
          )}
        </div>
      ) : (
        <div
          className="rounded-lg border border-border overflow-hidden"
          data-ocid="medical_issues.table"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Issue Name
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
              {issues.map((issue, idx) => (
                <tr
                  key={issue.id.toString()}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                  data-ocid={`medical_issues.item.${idx + 1}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                        <Activity className="w-3.5 h-3.5 text-destructive" />
                      </div>
                      <span className="font-medium">{issue.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    <span className="line-clamp-2">
                      {issue.description || "—"}
                    </span>
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => openEdit(issue)}
                          aria-label="Edit issue"
                          data-ocid={`medical_issues.edit_button.${idx + 1}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(issue)}
                          aria-label="Delete issue"
                          data-ocid={`medical_issues.delete_button.${idx + 1}`}
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
      )}

      {/* Issue form dialog — pass existingIssues so the dialog can check for duplicates */}
      <IssueDialog
        open={dialogOpen}
        editing={editing}
        profileKey={profileKey}
        existingIssues={issues}
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
        <AlertDialogContent data-ocid="medical_issues.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Medical Issue?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>"{deleteTarget?.name}"</strong>? This will remove it from
              the medical issues list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="medical_issues.delete.cancel_button">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-ocid="medical_issues.delete.confirm_button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
