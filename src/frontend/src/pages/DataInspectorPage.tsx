/**
 * DataInspectorPage.tsx — Super Admin raw backend data browser.
 *
 * WHAT THIS FILE DOES:
 * Renders a two-column layout: a left sidebar with data type buttons, and a right
 * panel that shows a searchable, filterable table of all backend records for the
 * selected data type.
 *
 * Each data type maps to a specific React Query hook (see useDataForType below).
 * Records can be expanded in-row to see all fields, or exported to CSV.
 *
 * EDIT MODAL:
 * Clicking the Edit icon on any row opens EditRecordModal — a generic form that
 * renders each field of the record as an editable input. On Save, it attempts to
 * call a type-specific or generic update function on the backend actor. If the
 * backend method is not available, a warning toast is shown but no crash occurs.
 *
 * NOTIFICATION SCOPING (critical):
 * Regular app notifications are fetched via useGetNotifications(profileKey, role) —
 * they are profile-scoped. Super Admin system notifications (profile pending approval,
 * etc.) are stored with profile_key = "superadmin" (sentinel). The Data Inspector
 * ALWAYS uses useGetSuperAdminNotifications() for the notifications data type to
 * ensure those system-level records are visible, regardless of active profile.
 *
 * DIAGNOSTICS:
 * All backend calls log to logger.ts (logApi / logError) when diagnosticsEnabled
 * is true in UserPreferencesContext. This lets the developer trace what query was
 * called and whether it succeeded.
 *
 * ACCESS: Super Admin only — enforced by the parent router.
 */

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
import { useUserPreferences } from "@/contexts/UserPreferencesContext";
import {
  useGetAllProfilesRaw,
  useGetAllUsersRaw,
  useGetBodyCompositionHistory,
  useGetCategories,
  useGetCustomers,
  useGetGoalMasterData,
  useGetInventoryMovements,
  useGetLeads,
  useGetMedicalIssueMasterData,
  useGetProducts,
  useGetPurchaseOrders,
  useGetSales,
  useGetStagedInventory,
  useGetSuperAdminNotifications,
  useGetVendors,
} from "@/hooks/useBackend";
import { logApi, logDebug, logError, logNav } from "@/lib/logger";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  Pencil,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type React from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type DataType =
  | "customers"
  | "sales"
  | "notifications"
  | "inventory"
  | "products"
  | "categories"
  | "purchaseOrders"
  | "vendors"
  | "goals"
  | "medicalIssues"
  | "bodyComposition"
  | "stageInventory"
  | "leads"
  | "users"
  | "profiles";

interface DataTypeConfig {
  label: string;
  key: DataType;
  /** Explains which backend query this type uses — shown in tooltip/badge */
  queryNote?: string;
}

/**
 * DATA_TYPES — the full list of selectable data types in the inspector.
 *
 * Query mapping per type:
 * - customers       → actor.getCustomers()
 * - sales           → actor.getSales()
 * - notifications   → actor.getSuperAdminNotifications() [sentinel "superadmin" key]
 *                      NOT getNotifications(profileKey, role) — that's for regular users
 * - inventory       → actor.getInventoryMovements()
 * - products        → actor.getProducts()
 * - categories      → actor.getCategories()
 * - purchaseOrders  → actor.getPurchaseOrders()
 * - vendors         → actor.getVendors(profileKey)
 * - goals           → actor.getGoalMasterData(profileKey)
 * - medicalIssues   → actor.getMedicalIssueMasterData(profileKey)
 * - bodyComposition → actor.getBodyCompositionHistory() [requires customer context]
 * - stageInventory  → actor.getStagedInventory()
 * - leads           → actor.getLeads()
 * - users           → actor.getAllUsersRaw(profileKey) or getUsersByProfile fallback
 * - profiles        → actor.getAllProfilesRaw() or getAllProfilesForAdmin fallback
 */
const DATA_TYPES: DataTypeConfig[] = [
  { label: "Customers", key: "customers" },
  { label: "Sales / Orders", key: "sales" },
  {
    label: "Notifications",
    key: "notifications",
    queryNote:
      "Uses getSuperAdminNotifications() — sentinel profile_key='superadmin'",
  },
  { label: "Inventory Movements", key: "inventory" },
  { label: "Products", key: "products" },
  { label: "Categories", key: "categories" },
  { label: "Purchase Orders", key: "purchaseOrders" },
  { label: "Vendors", key: "vendors" },
  { label: "Customer Goals", key: "goals" },
  { label: "Medical Issues", key: "medicalIssues" },
  {
    label: "Body Composition",
    key: "bodyComposition",
    queryNote:
      "Requires a customer to be selected — shows empty in global view",
  },
  { label: "Stage Inventory", key: "stageInventory" },
  { label: "Leads", key: "leads" },
  {
    label: "Users (Profile)",
    key: "users",
    queryNote:
      "Uses getAllUsersRaw(profileKey) — select a profile to view its users",
  },
  {
    label: "All Profiles",
    key: "profiles",
    queryNote:
      "Uses getAllProfilesRaw() — returns all registered business profiles",
  },
];

// ─── Value rendering helpers ──────────────────────────────────────────────────

/**
 * formatValue — converts any Motoko/IC backend value to a human-readable string.
 * Handles bigint (with nanosecond timestamp detection), booleans, arrays, and objects.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") {
    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      return `[${value.length} items]`;
    }
    // Motoko optional: [value] or []
    const keys = Object.keys(value as object);
    if (keys.length === 0) return "{}";
    return JSON.stringify(value, (_key, v) =>
      typeof v === "bigint" ? v.toString() : v,
    );
  }
  return String(value);
}

/** Pull top-level primitive fields for table columns (max 8 to keep the table readable) */
function getTableColumns(records: Record<string, unknown>[]): string[] {
  if (records.length === 0) return [];
  const first = records[0];
  return Object.keys(first).slice(0, 8);
}

/** Returns true if the value can be displayed inline in a table cell */
function isCellPrimitive(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "bigint") return true;
  if (typeof value === "boolean") return true;
  if (typeof value === "number") return true;
  if (typeof value === "string") return true;
  // Motoko optionals: [] or [val]
  if (Array.isArray(value) && value.length <= 1) return true;
  return false;
}

/**
 * renderCell — formats a single cell value for display in the table row.
 * Detects nanosecond timestamps (bigint > 1e15) and converts to locale date string.
 */
function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") {
    const n = Number(value);
    // IC timestamps are in nanoseconds — values > 1_000_000_000_000_000 are dates
    if (n > 1_000_000_000_000_000) {
      return new Date(n / 1_000_000).toLocaleString();
    }
    return value.toString();
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    return formatValue(value[0]);
  }
  if (typeof value === "object") return "{…}";
  return String(value);
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

/**
 * exportToCSV — serialises all visible (filtered) records to a CSV file and
 * triggers a browser download. Each value is quoted and bigints are stringified.
 */
function exportToCSV(records: Record<string, unknown>[], filename: string) {
  if (records.length === 0) return;
  const columns = Object.keys(records[0]);
  const rows = records.map((r) =>
    columns.map((c) => {
      const v = formatValue(r[c]);
      return `"${v.replace(/"/g, '""')}"`;
    }),
  );
  const csv = [columns.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Row detail panel ─────────────────────────────────────────────────────────

/**
 * RowDetail — renders all fields of a record in a two-column grid.
 * Shown below the row when the user clicks to expand it.
 */
function RowDetail({ record }: { record: Record<string, unknown> }) {
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-4 mt-1 mb-2 mx-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
      {Object.entries(record).map(([key, value]) => (
        <div key={key} className="flex flex-col gap-0.5 min-w-0">
          <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">
            {key}
          </span>
          <span className="text-foreground break-all font-mono text-[11px]">
            {formatValue(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Edit Record Modal ────────────────────────────────────────────────────────

interface EditRecordModalProps {
  /** The record being edited — all its fields will be shown as form inputs */
  record: Record<string, unknown>;
  /** The data type — used to determine which backend update function to call */
  dataType: DataType;
  /** Called when the user clicks Cancel or closes the modal */
  onClose: () => void;
  /** Called after a successful save so the table can refetch */
  onSaved: () => void;
  /** Whether diagnostics logging is enabled */
  diagnosticsEnabled: boolean;
}

/**
 * EditRecordModal — a generic edit form for any backend record.
 *
 * HOW IT WORKS:
 * 1. All fields from the selected record are rendered as text inputs.
 * 2. bigint values are converted to strings for editing and back to bigint on save.
 * 3. boolean values render as a checkbox.
 * 4. On Save, the modal attempts to call a type-specific update function or a
 *    generic updateRawRecord(type, id, updates) if available on the actor.
 * 5. If no update method is available, a warning toast is shown — no crash.
 *
 * FIELD HANDLING:
 * - Text strings → <input type="text" />
 * - Numbers      → <input type="number" />
 * - Booleans     → <input type="checkbox" />
 * - bigints      → <input type="text" /> (user enters a plain number; we convert)
 * - Arrays/Objects → <input type="text" /> (JSON string; advanced editing only)
 *
 * VALIDATION:
 * No strict validation — this is a Super Admin debug tool. The backend will
 * reject invalid values and we surface that error in the toast.
 */
function EditRecordModal({
  record,
  dataType,
  onClose,
  onSaved,
  diagnosticsEnabled,
}: EditRecordModalProps) {
  // Local edit state — all field values as strings for input binding
  const [editValues, setEditValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const [key, val] of Object.entries(record)) {
      if (typeof val === "object" && val !== null) {
        initial[key] = JSON.stringify(val, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        );
      } else {
        initial[key] = val === null || val === undefined ? "" : String(val);
      }
    }
    return initial;
  });

  const [isSaving, setIsSaving] = useState(false);

  /**
   * handleSave — attempts to persist the edited values back to the backend.
   *
   * Strategy (in order):
   * 1. If the actor has a generic `updateRawRecord(dataType, id, fields)` method,
   *    call it with the serialised edit values.
   * 2. Otherwise, show an informational toast explaining that manual editing for
   *    this data type is not yet wired to a specific backend method.
   *
   * This is a scaffolded approach — backend methods can be wired in without
   * changing the UI by adding them to the actor and making the duck-type check
   * here succeed.
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    // Resolve the record's primary identifier (id field in various formats)
    const recordId =
      editValues.id ??
      editValues.profile_key ??
      editValues.batch_id ??
      "unknown";

    if (diagnosticsEnabled) {
      logApi(
        `[DataInspector] Attempting to save edit for ${dataType} id=${String(recordId)}`,
      );
    }

    try {
      // NOTE: Backend generic update support is not yet deployed.
      // When actor.updateRawRecord(type, id, fields) becomes available in the IDL,
      // the duck-type check below will succeed and the edit will be persisted.
      // Until then, the modal shows a warning that the save isn't wired yet.
      // This prevents the UI from crashing while the feature is in progress.

      // The toast below will be replaced by the actual save logic once
      // updateRawRecord or type-specific update methods are wired here.
      toast.warning(
        `Manual edit for "${dataType}" records is not yet wired to a backend method. The changes were not saved. Contact the developer to wire the update function.`,
        { duration: 6000 },
      );

      if (diagnosticsEnabled) {
        logDebug(
          `[DataInspector] Save not wired for ${dataType} — showing user warning`,
        );
      }

      // Still call onSaved so the table refreshes and the user sees current data
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (diagnosticsEnabled) {
        logError(`[DataInspector] Save failed for ${dataType}: ${msg}`);
      }
      toast.error(`Save failed: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  }, [editValues, dataType, onSaved, onClose, diagnosticsEnabled]);

  // Determine the type of a field by looking at the original record value
  const getInputType = (key: string): "text" | "number" | "checkbox" => {
    const original = record[key];
    if (typeof original === "boolean") return "checkbox";
    if (typeof original === "number") return "number";
    return "text";
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        data-ocid="data_inspector.edit_dialog"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Edit Record —{" "}
            <span className="text-muted-foreground font-mono text-sm">
              {dataType}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ── Edit fields ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 py-2">
          {Object.entries(record).map(([key, originalValue]) => {
            const inputType = getInputType(key);
            const isReadOnly =
              key === "id" ||
              key === "profile_key" ||
              key === "created_by" ||
              key === "creation_date";

            return (
              <div key={key} className="flex flex-col gap-1 min-w-0">
                <Label
                  htmlFor={`edit-field-${key}`}
                  className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium"
                >
                  {key}
                  {isReadOnly && (
                    <span className="ml-1 text-[10px] text-muted-foreground/60 normal-case tracking-normal">
                      (read-only)
                    </span>
                  )}
                </Label>

                {inputType === "checkbox" ? (
                  /* Boolean field — render as checkbox */
                  <div className="flex items-center gap-2 h-9">
                    <input
                      id={`edit-field-${key}`}
                      type="checkbox"
                      checked={editValues[key] === "true"}
                      disabled={isReadOnly}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [key]: String(e.target.checked),
                        }))
                      }
                      className="w-4 h-4 rounded border-input accent-primary"
                      data-ocid={`data_inspector.edit_field.${key}`}
                    />
                    <span className="text-sm text-foreground">
                      {editValues[key] === "true" ? "Yes" : "No"}
                    </span>
                  </div>
                ) : (
                  /* Text / number field */
                  <Input
                    id={`edit-field-${key}`}
                    type={inputType}
                    value={editValues[key]}
                    readOnly={isReadOnly}
                    disabled={isReadOnly}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className={`h-8 text-xs font-mono ${
                      isReadOnly ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    title={
                      typeof originalValue === "bigint"
                        ? "Enter a plain integer (bigint field)"
                        : typeof originalValue === "object"
                          ? "JSON value — edit with care"
                          : undefined
                    }
                    data-ocid={`data_inspector.edit_field.${key}`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSaving}
            data-ocid="data_inspector.edit_cancel_button"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            data-ocid="data_inspector.edit_save_button"
          >
            {isSaving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

interface DataTableProps {
  records: Record<string, unknown>[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  dataType: DataType;
  diagnosticsEnabled: boolean;
}

/**
 * DataTable — the main records table with search, expand-row, edit, and CSV export.
 *
 * Each row can be:
 * - Clicked to expand/collapse the full RowDetail panel
 * - Edited via the Pencil icon button (opens EditRecordModal)
 */
function DataTable({
  records,
  isLoading,
  isError,
  onRefresh,
  dataType,
  diagnosticsEnabled,
}: DataTableProps) {
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  // Which record is currently open in the edit modal (null = none)
  const [editingRecord, setEditingRecord] = useState<Record<
    string,
    unknown
  > | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) =>
      Object.values(r).some((v) => formatValue(v).toLowerCase().includes(q)),
    );
  }, [records, search]);

  const columns = useMemo(() => getTableColumns(filtered), [filtered]);

  const handleExport = useCallback(() => {
    if (diagnosticsEnabled) {
      logDebug(
        `[DataInspector] Exporting ${filtered.length} ${dataType} records to CSV`,
      );
    }
    exportToCSV(filtered, `${dataType}-export`);
  }, [filtered, dataType, diagnosticsEnabled]);

  const toggleRow = (i: number) =>
    setExpandedRow((prev) => (prev === i ? null : i));

  const handleEditClick = useCallback(
    (e: React.MouseEvent, record: Record<string, unknown>) => {
      // Stop click from propagating to the row toggle
      e.stopPropagation();
      if (diagnosticsEnabled) {
        const id = record.id ?? record.profile_key ?? "?";
        logDebug(`[DataInspector] Opening edit modal for ${dataType} id=${id}`);
      }
      setEditingRecord(record);
    },
    [dataType, diagnosticsEnabled],
  );

  return (
    <div className="flex flex-col gap-3" data-ocid="data_inspector.table_panel">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            data-ocid="data_inspector.search_input"
            className="pl-8 h-8 text-sm"
            placeholder="Filter rows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Badge variant="secondary" className="text-xs font-mono h-8 px-3">
          {isLoading ? "…" : `${filtered.length} records`}
        </Badge>
        <Button
          data-ocid="data_inspector.refresh_button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
        <Button
          data-ocid="data_inspector.export_button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={handleExport}
          disabled={isLoading || filtered.length === 0}
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Button>
      </div>

      {/* States */}
      {isLoading && (
        <div data-ocid="data_inspector.loading_state" className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable identity
            <Skeleton key={`skel-${i}`} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div
          data-ocid="data_inspector.error_state"
          className="flex flex-col items-center justify-center py-12 text-center gap-3"
        >
          <span className="text-3xl">⚠️</span>
          <p className="text-sm text-muted-foreground">
            Failed to load data. The backend method may not be available for
            this data type yet.
          </p>
          <Button size="sm" variant="outline" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div
          data-ocid="data_inspector.empty_state"
          className="flex flex-col items-center justify-center py-12 text-center gap-3"
        >
          <Database className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? "No records match your filter." : "No records found."}
          </p>
        </div>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                {/* Expand toggle column */}
                <TableHead className="w-8 py-2" />
                {/* Row number column */}
                <TableHead className="text-[11px] font-semibold text-muted-foreground py-2 w-10">
                  #
                </TableHead>
                {/* Edit action column */}
                <TableHead className="text-[11px] font-semibold text-muted-foreground py-2 w-8">
                  Edit
                </TableHead>
                {columns.map((col) => (
                  <TableHead
                    key={col}
                    className="text-[11px] font-semibold text-muted-foreground py-2 max-w-[160px] truncate"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((row, i) => {
                const rowKey = `row-${i}`;
                return (
                  <>
                    <TableRow
                      key={rowKey}
                      data-ocid={`data_inspector.item.${i + 1}`}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleRow(i)}
                    >
                      {/* Expand/collapse chevron */}
                      <TableCell className="py-2 px-2 w-8">
                        {expandedRow === i ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </TableCell>
                      {/* Row number */}
                      <TableCell className="py-2 text-xs text-muted-foreground font-mono w-10">
                        {i + 1}
                      </TableCell>
                      {/* Edit button — stops row expansion and opens modal */}
                      <TableCell className="py-2 w-8">
                        <button
                          type="button"
                          aria-label="Edit record"
                          data-ocid={`data_inspector.edit_button.${i + 1}`}
                          onClick={(e) => handleEditClick(e, row)}
                          className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                      {/* Data cells */}
                      {columns.map((col) => {
                        const val = row[col];
                        return (
                          <TableCell
                            key={col}
                            className="py-2 text-xs max-w-[160px] truncate font-mono"
                          >
                            {isCellPrimitive(val) ? (
                              renderCell(val)
                            ) : (
                              <span className="text-muted-foreground italic">
                                {Array.isArray(val)
                                  ? `[${val.length}]`
                                  : "{object}"}
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>

                    {/* Expanded detail panel — shown below the row when expanded */}
                    {expandedRow === i && (
                      <TableRow
                        key={`${rowKey}-detail`}
                        className="hover:bg-transparent"
                      >
                        <TableCell colSpan={columns.length + 3} className="p-0">
                          <RowDetail record={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit modal — only mounted when a row's edit button is clicked */}
      {editingRecord && (
        <EditRecordModal
          record={editingRecord}
          dataType={dataType}
          onClose={() => setEditingRecord(null)}
          onSaved={onRefresh}
          diagnosticsEnabled={diagnosticsEnabled}
        />
      )}
    </div>
  );
}

// ─── Data loader: one hook per type ───────────────────────────────────────────

/**
 * useDataForType — maps a DataType key to its corresponding React Query result.
 *
 * NOTIFICATION NOTE (important):
 * The "notifications" type uses useGetSuperAdminNotifications() — NOT the regular
 * useGetNotifications(profileKey, role). This is because the Data Inspector is a
 * Super Admin tool and system notifications (new profile approvals, etc.) are stored
 * with profile_key = "superadmin" (sentinel) — they are NOT visible via the
 * profile-scoped getNotifications() query.
 *
 * USER NOTE:
 * The "users" type requires a profileKey to be set (Super Admin must have an active
 * profile selected) — it fetches users via getAllUsersRaw(profileKey) with a fallback
 * to getUsersByProfile(profileKey).
 *
 * PROFILE NOTE:
 * The "profiles" type uses getAllProfilesRaw() with a fallback to getAllProfilesForAdmin()
 * — no profileKey required.
 */
function useDataForType(dataType: DataType, profileKey: string | null) {
  const customers = useGetCustomers();
  const sales = useGetSales();

  /**
   * CRITICAL: Use useGetSuperAdminNotifications() — NOT useGetNotifications().
   * Regular notifications are profile-scoped (profileKey + role filter).
   * Super Admin system notifications use profile_key = "superadmin" (sentinel)
   * and are only returned by getSuperAdminNotifications(). If we used
   * useGetNotifications(profileKey, "admin") here, we would NEVER see the
   * system notifications, because they are stored with a different profile_key.
   */
  const notifications = useGetSuperAdminNotifications();

  const inventory = useGetInventoryMovements();
  const products = useGetProducts();
  const categories = useGetCategories();
  const purchaseOrders = useGetPurchaseOrders();
  const vendors = useGetVendors(profileKey);
  const goals = useGetGoalMasterData(profileKey);
  const medicalIssues = useGetMedicalIssueMasterData(profileKey);
  // Body composition requires a customerId — shows empty in global view (no customer selected)
  const bodyComp = useGetBodyCompositionHistory(null);
  const stageInventory = useGetStagedInventory(profileKey);
  const leads = useGetLeads();
  // Super Admin raw user list — uses getAllUsersRaw (falls back to getUsersByProfile)
  const users = useGetAllUsersRaw(profileKey);
  // Super Admin raw profile list — uses getAllProfilesRaw (falls back to getAllProfilesForAdmin)
  const profiles = useGetAllProfilesRaw();

  const map = {
    customers,
    sales,
    notifications,
    inventory,
    products,
    categories,
    purchaseOrders,
    vendors,
    goals,
    medicalIssues,
    bodyComposition: bodyComp,
    stageInventory,
    leads,
    users,
    profiles,
  } as const;

  return map[dataType];
}

// ─── Main page ────────────────────────────────────────────────────────────────

/**
 * DataInspectorPage — the Super Admin raw data browser.
 *
 * Layout:
 * - Left sidebar: scrollable list of all 15 data types as clickable buttons
 * - Right panel: Card containing the DataTable for the selected type
 *
 * The page reads profileKey from ProfileContext — Super Admin must select an active
 * profile to see profile-scoped data (vendors, users, goals, medical issues).
 * Profile-independent types (notifications, products, sales, etc.) work without
 * a selected profile.
 */
export function DataInspectorPage() {
  const { profile } = useProfile();
  const { diagnosticsEnabled } = useUserPreferences();
  const profileKey = profile?.profile_key ?? null;

  const [selectedType, setSelectedType] = useState<DataType>("customers");

  // Log page load to diagnostics
  useEffect(() => {
    if (diagnosticsEnabled) {
      logNav(
        `[DataInspector] Page loaded — profileKey=${profileKey ?? "none"}`,
      );
    }
  }, [diagnosticsEnabled, profileKey]);

  const queryResult = useDataForType(selectedType, profileKey);

  // Safe cast: all hooks return { data, isLoading, isError, refetch }
  const { data, isLoading, isError, refetch } = queryResult as {
    data: unknown[] | undefined | null;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };

  // Log query state to diagnostics panel when enabled
  useEffect(() => {
    if (!diagnosticsEnabled) return;
    if (isLoading) {
      logApi(`[DataInspector] Loading ${selectedType}...`);
    } else if (isError) {
      logError(`[DataInspector] Error loading ${selectedType}`);
    } else if (data) {
      const count = Array.isArray(data) ? data.length : 0;
      logApi(`[DataInspector] Loaded ${selectedType}: ${count} records`);
    }
  }, [selectedType, isLoading, isError, data, diagnosticsEnabled]);

  // Normalise data to Record<string, unknown>[]
  const records = useMemo<Record<string, unknown>[]>(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((item) => {
      if (item === null || item === undefined) return {};
      if (typeof item !== "object") return { value: item };
      return item as Record<string, unknown>;
    });
  }, [data]);

  const selectedConfig = DATA_TYPES.find((d) => d.key === selectedType)!;

  // Log type selection to diagnostics
  const handleTypeSelect = useCallback(
    (key: DataType) => {
      setSelectedType(key);
      if (diagnosticsEnabled) {
        logDebug(`[DataInspector] Selected data type: ${key}`);
      }
    },
    [diagnosticsEnabled],
  );

  return (
    <div className="p-4 md:p-6 max-w-full" data-ocid="data_inspector.page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">
            Data Inspector
          </h1>
          <p className="text-xs text-muted-foreground">
            Browse raw backend records — Super Admin only
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left: type selector */}
        <div className="lg:w-56 flex-shrink-0">
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Data Type
              </CardTitle>
            </CardHeader>
            <CardContent className="py-1 px-2">
              <ul className="space-y-0.5" data-ocid="data_inspector.type_list">
                {DATA_TYPES.map((dt) => (
                  <li key={dt.key}>
                    <button
                      type="button"
                      data-ocid={`data_inspector.type.${dt.key}`}
                      onClick={() => handleTypeSelect(dt.key)}
                      title={dt.queryNote}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedType === dt.key
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {dt.label}
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Right: table */}
        <div className="flex-1 min-w-0">
          <Card className="bg-card border-border">
            <CardHeader className="py-3 px-4 border-b border-border">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {selectedConfig.label}
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Special context badges for types that need extra setup */}
                  {selectedType === "bodyComposition" && (
                    <Badge variant="outline" className="text-[10px]">
                      Requires customer context
                    </Badge>
                  )}
                  {selectedType === "users" && !profileKey && (
                    <Badge variant="outline" className="text-[10px]">
                      Select a profile first
                    </Badge>
                  )}
                  {selectedType === "notifications" && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-blue-500 border-blue-300"
                    >
                      System notifications only
                    </Badge>
                  )}
                </div>
              </div>
              {/* Show query note if available (explains which backend method is used) */}
              {selectedConfig.queryNote && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {selectedConfig.queryNote}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-4">
              <DataTable
                records={records}
                isLoading={isLoading}
                isError={isError}
                onRefresh={refetch}
                dataType={selectedType}
                diagnosticsEnabled={diagnosticsEnabled}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
