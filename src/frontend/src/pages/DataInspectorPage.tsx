/*
 * PAGE: DataInspectorPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Super Admin raw backend data browser. Allows browsing, searching, expanding,
 *   and manually editing any record type across all 15 data types in the canister.
 *   Super Admin sees ALL data — no profileKey filtration applied.
 *
 * ROLE ACCESS:
 *   superAdmin only — enforced by parent router in App.tsx
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ reads profileKey from ProfileContext (used for profile-scoped types only)
 *      ├─ logs page load to diagnostics if enabled
 *      └─ defaults selectedType to "customers"
 *   2. Data type selection
 *      └─ user clicks type button in left sidebar
 *           └─ setSelectedType() → triggers useDataForType(selectedType, profileKey)
 *   3. Data loading (per type)
 *      └─ useDataForType() maps type → React Query hook
 *           ├─ notifications → useGetSuperAdminNotifications() [sentinel "superadmin", NO profileKey filter]
 *           ├─ profiles      → useGetAllProfilesRaw() [all profiles, no filter]
 *           ├─ users         → useGetAllUsersRaw(profileKey) [needs active profile]
 *           └─ all others    → standard hook (getCustomers, getSales, etc.)
 *   4. Render logic
 *      ├─ Loading → skeleton rows
 *      ├─ Error   → error state with Try Again
 *      ├─ Empty   → empty state message
 *      └─ Data    → DataTable with search, expand rows, edit buttons, CSV export
 *   5. Edit flow
 *      ├─ user clicks Pencil icon on a row → opens EditRecordModal
 *      ├─ all fields rendered as inputs; key/audit fields are read-only
 *      ├─ Save → calls type-specific backend mutation
 *      │    ├─ profiles       → useUpdateProfileFields(profileKey, fields)
 *      │    ├─ customers      → useUpdateCustomer(id, input)
 *      │    ├─ products       → useUpdateProduct(id, input)
 *      │    ├─ categories     → useUpdateCategory(id, input)
 *      │    ├─ vendors        → useUpdateVendor(vendorId, input)
 *      │    ├─ goals          → useUpdateGoalMaster(id, name, desc, bundle)
 *      │    ├─ medicalIssues  → useUpdateMedicalIssueMaster(id, name, desc)
 *      │    ├─ stageInventory → useReviewStagedItem (status toggle)
 *      │    ├─ leads          → useCloseLead (is_closed toggle)
 *      │    ├─ notifications  → markNotificationRead (read-only otherwise)
 *      │    └─ bodyComposition / inventoryMovements / sales → read-only, Save disabled
 *      └─ on success: close modal, invalidate query, refresh table
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - selectedType: DataType = "customers"  // active data type shown in table
 *   - profileKey: string | null             // from ProfileContext (impersonation-aware)
 *   - diagnosticsEnabled: boolean           // from UserPreferencesContext
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   - Trigger: [diagnosticsEnabled, profileKey]  →  Action: log page load
 *   - Trigger: [selectedType, isLoading, isError, data, diagnosticsEnabled]  →  Action: log query state
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - handleTypeSelect: updates selectedType, logs to diagnostics
 *   - handleEditClick: opens EditRecordModal for the clicked row
 *   - handleSave (in EditRecordModal): calls type-specific mutation, invalidates cache
 * ─────────────────────────────────────────────────────────────────────────────
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
  useGetAllUsersForAdmin,
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
  useUpdateCategory,
  useUpdateCustomer,
  useUpdateGoalMaster,
  useUpdateMedicalIssueMaster,
  useUpdateProduct,
  useUpdateProfileFields,
  useUpdateVendor,
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
import type { Variant_active_lead_inactive } from "../backend";

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
  /** Explains which backend query this type uses — shown as tooltip/note */
  queryNote?: string;
  /** Whether records of this type are read-only (Save disabled) */
  readOnly?: boolean;
}

/**
 * DATA_TYPES — all 15 selectable data types in the inspector.
 *
 * QUERY MAPPING PER TYPE:
 *   customers       → actor.getCustomers()                        [editable]
 *   sales           → actor.getSales()                            [read-only]
 *   notifications   → actor.getSuperAdminNotifications()          [read-only]
 *                     NOT getNotifications(profileKey, role)!
 *   inventory       → actor.getInventoryMovements()               [read-only]
 *   products        → actor.getProducts()                         [editable]
 *   categories      → actor.getCategories()                       [editable]
 *   purchaseOrders  → actor.getPurchaseOrders()                   [read-only]
 *   vendors         → actor.getVendors(profileKey)                [editable]
 *   goals           → actor.getGoalMasterData(profileKey)         [editable]
 *   medicalIssues   → actor.getMedicalIssueMasterData(profileKey) [editable]
 *   bodyComposition → actor.getBodyCompositionHistory()           [read-only]
 *   stageInventory  → actor.getStagedInventory()                  [read-only]
 *   leads           → actor.getLeads()                            [read-only]
 *   users           → actor.getAllUsersRaw(profileKey)            [read-only]
 *   profiles        → actor.getAllProfilesRaw()                   [editable via updateProfileFields]
 *
 * SUPER ADMIN FILTRATION NOTE:
 * Super Admin sees ALL data — no profileKey filter is applied to global types
 * (customers, sales, products, etc.). Profile-scoped types (vendors, goals,
 * medicalIssues, users) still require a profile selection to be meaningful.
 */
const DATA_TYPES: DataTypeConfig[] = [
  { label: "Customers", key: "customers" },
  {
    label: "Sales / Orders",
    key: "sales",
    readOnly: true,
    queryNote: "Read-only — total/items cannot be changed after creation",
  },
  {
    label: "Notifications",
    key: "notifications",
    readOnly: true,
    queryNote:
      "Uses getSuperAdminNotifications() — sentinel profile_key='superadmin'",
  },
  {
    label: "Inventory Movements",
    key: "inventory",
    readOnly: true,
    queryNote:
      "Read-only audit trail — movements cannot be reversed via inspector",
  },
  { label: "Products", key: "products" },
  { label: "Categories", key: "categories" },
  {
    label: "Purchase Orders",
    key: "purchaseOrders",
    readOnly: true,
    queryNote: "Read-only — use the PO page to modify purchase orders",
  },
  { label: "Vendors", key: "vendors" },
  { label: "Customer Goals", key: "goals" },
  { label: "Medical Issues", key: "medicalIssues" },
  {
    label: "Body Composition",
    key: "bodyComposition",
    readOnly: true,
    queryNote:
      "Read-only — requires a customer to be selected (empty in global view)",
  },
  {
    label: "Stage Inventory",
    key: "stageInventory",
    readOnly: true,
    queryNote: "Read-only — use the Stage Inventory page to review items",
  },
  {
    label: "Leads",
    key: "leads",
    readOnly: true,
    queryNote: "Read-only — manage leads from the Super Admin dashboard",
  },
  {
    label: "Users (Profile)",
    key: "users",
    readOnly: true,
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

// ─── Read-only fields ─────────────────────────────────────────────────────────

/**
 * KEY_FIELDS_READONLY — fields that must never be editable in the inspector.
 * These are primary identifiers, audit timestamps, and foreign keys.
 * Editing them would corrupt data integrity.
 */
const KEY_FIELDS_READONLY = new Set([
  "id",
  "profile_key",
  "profileKey",
  "created_by",
  "creation_date",
  "owner_id",
  "owner",
  "batch_id",
  "sale_id",
  "customer_id",
  "product_id",
  "return_order_id",
]);

// ─── Edit Record Modal ────────────────────────────────────────────────────────

interface EditRecordModalProps {
  /** The record being edited — all its fields will be shown as form inputs */
  record: Record<string, unknown>;
  /** The data type — determines which backend update function to call */
  dataType: DataType;
  /** The active profileKey from ProfileContext (needed for some update functions) */
  profileKey: string | null;
  /** True when this data type is read-only and Save should be disabled */
  isReadOnly: boolean;
  /** Called when the user clicks Cancel or closes the modal */
  onClose: () => void;
  /** Called after a successful save so the table can refetch */
  onSaved: () => void;
  /** Whether diagnostics logging is enabled */
  diagnosticsEnabled: boolean;
}

/**
 * EditRecordModal — generic edit form for any backend record.
 *
 * FLOW:
 *   1. All fields rendered as inputs; KEY_FIELDS_READONLY are disabled.
 *   2. Read-only types (sales, notifications, inventory, etc.) disable Save entirely.
 *   3. On Save, calls the correct mutation for the data type:
 *      - profiles:      updateProfileFields(profileKey, { ...editableFields })
 *      - customers:     updateCustomer(id, input)
 *      - products:      updateProduct(id, input)
 *      - categories:    updateCategory(id, input)
 *      - vendors:       updateVendor(vendorId, input)
 *      - goals:         updateGoalMaster(id, name, description, productBundle)
 *      - medicalIssues: updateMedicalIssueMaster(id, name, description)
 *      - all others:    shows "read-only" toast, no save
 *   4. On success: invalidates the query, closes modal.
 *   5. On error: shows toast with the error message.
 *
 * FIELD TYPE HANDLING:
 *   text strings → <input type="text" />
 *   numbers      → <input type="number" />
 *   booleans     → <input type="checkbox" />
 *   bigints      → <input type="text" /> (user enters plain number)
 *   arrays/objects → <input type="text" /> (JSON string)
 */
function EditRecordModal({
  record,
  dataType,
  profileKey,
  isReadOnly,
  onClose,
  onSaved,
  diagnosticsEnabled,
}: EditRecordModalProps) {
  // Local edit state — all field values stored as strings for input binding
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

  // Mutation hooks — only the ones actually used in handleSave
  const updateProfileFieldsMutation = useUpdateProfileFields();
  const updateCustomerMutation = useUpdateCustomer();
  const updateProductMutation = useUpdateProduct();
  const updateCategoryMutation = useUpdateCategory();
  const updateVendorMutation = useUpdateVendor();
  const updateGoalMasterMutation = useUpdateGoalMaster();
  const updateMedicalIssueMutation = useUpdateMedicalIssueMaster();

  /**
   * handleSave — dispatches the correct update mutation for the current dataType.
   *
   * IMPORTANT DECISIONS:
   * - Key fields (id, profile_key, created_by, etc.) are NEVER sent in the update payload.
   *   They are rendered as disabled in the form but omitted from the mutation args.
   * - bigint fields: user types a plain number string; we convert back to bigint before sending.
   * - For data types without a wired mutation (sales, orders, etc.), we show a toast and abort.
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    // Resolve the record's primary identifier for logging
    const recordId =
      editValues.id ??
      editValues.profile_key ??
      editValues.batch_id ??
      "unknown";

    if (diagnosticsEnabled) {
      logApi(
        `[DataInspector] Attempting save for ${dataType} id=${String(recordId)}`,
      );
    }

    try {
      if (isReadOnly) {
        toast.info("This data type is read-only and cannot be edited here.");
        onClose();
        return;
      }

      // Build a payload of only the non-readonly fields
      const editableFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(editValues)) {
        if (!KEY_FIELDS_READONLY.has(key)) {
          editableFields[key] = value;
        }
      }

      if (dataType === "profiles") {
        // profiles: call updateProfileFields(profileKey, editableFields)
        // The profileKey of the record being edited (not the Super Admin's active profile)
        const targetProfileKey =
          (record.profile_key as string) ?? profileKey ?? "";
        if (!targetProfileKey) {
          toast.error("Cannot update: profile_key is missing from the record.");
          return;
        }
        const ok = await updateProfileFieldsMutation.mutateAsync({
          profileKey: targetProfileKey,
          fields: editableFields,
        });
        if (ok) {
          toast.success("Profile updated successfully.");
        } else {
          toast.error("Update returned false — profile may not exist.");
        }
      } else if (dataType === "customers") {
        // customers: updateCustomer(id, CustomerInput)
        const customerId = BigInt(record.id as string | number);
        // Build the minimum required fields — only send what we have
        // The Data Inspector allows editing text fields; complex fields
        // (notes array, goals array) are preserved from the original record
        const input = {
          name: editableFields.name ?? (record.name as string) ?? "",
          phone: editableFields.phone ?? (record.phone as string) ?? "",
          email: editableFields.email ?? (record.email as string) ?? "",
          address:
            editableFields.address ??
            (record.address as string) ??
            editableFields.address_line1 ??
            (record.address_line1 as string) ??
            "",
          address_line1:
            editableFields.address_line1 ??
            (record.address_line1 as string) ??
            "",
          address_line2:
            editableFields.address_line2 ??
            (record.address_line2 as string) ??
            "",
          city: editableFields.city ?? (record.city as string) ?? "",
          state: editableFields.state ?? (record.state as string) ?? "",
          country: editableFields.country ?? (record.country as string) ?? "",
          pin_code:
            editableFields.pin_code ?? (record.pin_code as string) ?? "",
          date_of_birth: editableFields.dob ?? (record.dob as string) ?? "",
          gender: editableFields.sex ?? (record.sex as string) ?? "",
          note: editableFields.note ?? (record.note as string) ?? "",
          referred_by:
            editableFields.referred_by ?? (record.referred_by as string) ?? "",
          // Preserve complex fields unchanged from the original record
          customer_type: record.customer_type,
          notes: record.notes,
          goals: record.goals,
          medical_issues: record.medical_issues,
        } as Parameters<typeof updateCustomerMutation.mutateAsync>[0]["input"];
        const ok = await updateCustomerMutation.mutateAsync({
          id: customerId,
          input,
        });
        if (ok) toast.success("Customer updated.");
        else toast.error("Update returned false.");
      } else if (dataType === "products") {
        // products: updateProduct(id, ProductInput)
        const productId = BigInt(record.id as string | number);
        const input = {
          name: editableFields.name ?? (record.name as string) ?? "",
          description:
            editableFields.description ?? (record.description as string) ?? "",
          category_id: BigInt(
            editableFields.category_id ?? (record.category_id as string) ?? "0",
          ),
          mrp: Number(editableFields.mrp ?? record.mrp ?? 0),
          cost_price: Number(
            editableFields.cost_price ?? record.cost_price ?? 0,
          ),
          selling_price: Number(
            editableFields.selling_price ?? record.selling_price ?? 0,
          ),
          volume_points: Number(
            editableFields.volume_points ?? record.volume_points ?? 0,
          ),
          barcode: editableFields.barcode ?? (record.barcode as string) ?? "",
          product_instructions:
            editableFields.product_instructions ??
            (record.product_instructions as string) ??
            "",
          serving_size:
            editableFields.serving_size ??
            (record.serving_size as string) ??
            "",
          uom: editableFields.uom ?? (record.uom as string) ?? "",
          uom_value:
            editableFields.uom_value ?? (record.uom_value as string) ?? "",
          sku: editableFields.sku ?? (record.sku as string) ?? "",
          earn_base: Number(editableFields.earn_base ?? record.earn_base ?? 0),
          hsn_code:
            editableFields.hsn_code ?? (record.hsn_code as string) ?? "",
        };
        const ok = await updateProductMutation.mutateAsync({
          id: productId,
          input,
        });
        if (ok) toast.success("Product updated.");
        else toast.error("Update returned false.");
      } else if (dataType === "categories") {
        // categories: updateCategory(id, CategoryInput)
        const catId = BigInt(record.id as string | number);
        const input = {
          name: editableFields.name ?? (record.name as string) ?? "",
          description:
            editableFields.description ?? (record.description as string) ?? "",
        };
        const ok = await updateCategoryMutation.mutateAsync({
          id: catId,
          input,
        });
        if (ok) toast.success("Category updated.");
        else toast.error("Update returned false.");
      } else if (dataType === "vendors") {
        // vendors: updateVendor(vendorId, VendorInput)
        const vendorId = String(record.id ?? record.vendor_id ?? "");
        if (!vendorId) {
          toast.error("Cannot update: vendor id is missing.");
          return;
        }
        const input = {
          name: editableFields.name ?? (record.name as string) ?? "",
          contact_name:
            editableFields.contact_name ??
            (record.contact_name as string) ??
            "",
          phone: editableFields.phone ?? (record.phone as string) ?? "",
          email: editableFields.email ?? (record.email as string) ?? "",
          address: editableFields.address ?? (record.address as string) ?? "",
          is_default: editableFields.is_default === "true",
        };
        const ok = await updateVendorMutation.mutateAsync({
          vendorId,
          input,
        });
        if (ok) toast.success("Vendor updated.");
        else toast.error("Update returned false.");
      } else if (dataType === "goals") {
        // goals: updateGoalMaster(id, name, description, productBundle)
        const goalId = BigInt(record.id as string | number);
        const ok = await updateGoalMasterMutation.mutateAsync({
          id: goalId,
          name: editableFields.name ?? (record.name as string) ?? "",
          description:
            editableFields.description ?? (record.description as string) ?? "",
          productBundle: record.product_bundle as bigint[],
        });
        if (ok) toast.success("Goal updated.");
        else toast.error("Update returned false.");
      } else if (dataType === "medicalIssues") {
        // medicalIssues: updateMedicalIssueMaster(id, name, description)
        const issueId = BigInt(record.id as string | number);
        const ok = await updateMedicalIssueMutation.mutateAsync({
          id: issueId,
          name: editableFields.name ?? (record.name as string) ?? "",
          description:
            editableFields.description ?? (record.description as string) ?? "",
        });
        if (ok) toast.success("Medical issue updated.");
        else toast.error("Update returned false.");
      } else {
        // All other types (sales, purchaseOrders, inventory, stageInventory, etc.) are read-only
        toast.info(
          `"${dataType}" records are read-only. Use the dedicated page to make changes.`,
        );
        onClose();
        return;
      }

      if (diagnosticsEnabled) {
        logDebug(
          `[DataInspector] Save succeeded for ${dataType} id=${String(recordId)}`,
        );
      }

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
  }, [
    editValues,
    dataType,
    record,
    profileKey,
    isReadOnly,
    onSaved,
    onClose,
    diagnosticsEnabled,
    updateProfileFieldsMutation,
    updateCustomerMutation,
    updateProductMutation,
    updateCategoryMutation,
    updateVendorMutation,
    updateGoalMasterMutation,
    updateMedicalIssueMutation,
  ]);

  // Determine the HTML input type for a field based on its original record value
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
            {isReadOnly && (
              <span className="ml-2 text-xs font-normal text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                Read only
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Read-only notice */}
        {isReadOnly && (
          <div className="px-1 py-2 rounded-md bg-muted/50 text-xs text-muted-foreground">
            This data type is read-only. Records can be viewed but not edited
            from the inspector.
          </div>
        )}

        {/* Edit fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 py-2">
          {Object.entries(record).map(([key, originalValue]) => {
            const inputType = getInputType(key);
            // A field is read-only if it's in the locked set OR if the entire type is read-only
            const fieldReadOnly = KEY_FIELDS_READONLY.has(key) || isReadOnly;

            return (
              <div key={key} className="flex flex-col gap-1 min-w-0">
                <Label
                  htmlFor={`edit-field-${key}`}
                  className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium"
                >
                  {key}
                  {KEY_FIELDS_READONLY.has(key) && (
                    <span className="ml-1 text-[10px] text-muted-foreground/60 normal-case tracking-normal">
                      (read-only)
                    </span>
                  )}
                </Label>

                {inputType === "checkbox" ? (
                  <div className="flex items-center gap-2 h-9">
                    <input
                      id={`edit-field-${key}`}
                      type="checkbox"
                      checked={editValues[key] === "true"}
                      disabled={fieldReadOnly}
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
                  <Input
                    id={`edit-field-${key}`}
                    type={inputType}
                    value={editValues[key]}
                    readOnly={fieldReadOnly}
                    disabled={fieldReadOnly}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className={`h-8 text-xs font-mono ${
                      fieldReadOnly ? "opacity-50 cursor-not-allowed" : ""
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
            disabled={isSaving || isReadOnly}
            data-ocid="data_inspector.edit_save_button"
          >
            {isSaving ? "Saving…" : isReadOnly ? "Read only" : "Save changes"}
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
  profileKey: string | null;
  isReadOnly: boolean;
  diagnosticsEnabled: boolean;
}

/**
 * DataTable — the main records table with search, expand-row, edit, and CSV export.
 *
 * Each row can be:
 *   - Clicked to expand/collapse the full RowDetail panel below
 *   - Edited via the Pencil icon button (opens EditRecordModal)
 *
 * The Pencil icon is always shown so Super Admin can inspect any record;
 * the EditRecordModal itself disables Save when the type is read-only.
 */
function DataTable({
  records,
  isLoading,
  isError,
  onRefresh,
  dataType,
  profileKey,
  isReadOnly,
  diagnosticsEnabled,
}: DataTableProps) {
  // Current search filter string
  const [search, setSearch] = useState("");
  // Which row index is currently expanded (null = none)
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  // Which record is open in the edit modal (null = none)
  const [editingRecord, setEditingRecord] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Filter records by search string — matches any field value
  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) =>
      Object.values(r).some((v) => formatValue(v).toLowerCase().includes(q)),
    );
  }, [records, search]);

  // Derive column list from the first record (max 8 columns for readability)
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
      // Stop propagation so the row toggle doesn't also fire
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

      {/* Loading state */}
      {isLoading && (
        <div data-ocid="data_inspector.loading_state" className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no stable identity
            <Skeleton key={`skel-${i}`} className="h-10 w-full rounded-md" />
          ))}
        </div>
      )}

      {/* Error state */}
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

      {/* Empty state */}
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

      {/* Records table */}
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

                    {/* Expanded detail panel — shown below the row */}
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
          profileKey={profileKey}
          isReadOnly={isReadOnly}
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
 * NOTIFICATION SCOPING (CRITICAL):
 * The "notifications" type calls useGetSuperAdminNotifications() — NOT
 * useGetNotifications(profileKey, role). This is because:
 *   - System notifications (new profile pending approval) are stored with
 *     profile_key = "superadmin" (sentinel value) — they are NOT profile-scoped.
 *   - getSuperAdminNotifications() returns ALL notifications with that sentinel key,
 *     regardless of which profile the Super Admin currently has selected.
 *   - Using useGetNotifications(profileKey, "admin") here would NEVER return those
 *     system notifications because the profile_key wouldn't match.
 *
 * SUPER ADMIN DATA FILTRATION:
 * Super Admin sees ALL records — no profileKey filter is applied to global types.
 * Profile-scoped types (vendors, goals, medicalIssues, users, stageInventory)
 * still accept a profileKey argument — they will return empty if none is selected.
 *
 * @param dataType  - the selected data type
 * @param profileKey - the currently active profile (null if Super Admin has none selected)
 */
function useDataForType(dataType: DataType, profileKey: string | null) {
  // Global types — no profileKey filter applied (Super Admin sees ALL records)
  const customers = useGetCustomers();
  const sales = useGetSales();

  /**
   * CRITICAL: Always use useGetSuperAdminNotifications() for the notifications type.
   * Never use useGetNotifications(profileKey, role) here — it would filter out
   * system notifications that use the "superadmin" sentinel profile_key.
   */
  const notifications = useGetSuperAdminNotifications();

  const inventory = useGetInventoryMovements();
  const products = useGetProducts();
  const categories = useGetCategories();
  const purchaseOrders = useGetPurchaseOrders();

  // Profile-scoped types — profileKey required; Super Admin selects an active profile
  const vendors = useGetVendors(profileKey);
  const goals = useGetGoalMasterData(profileKey);
  const medicalIssues = useGetMedicalIssueMasterData(profileKey);

  // Body composition requires a customerId — empty in global view (no customer selected)
  const bodyComp = useGetBodyCompositionHistory(null);

  const stageInventory = useGetStagedInventory(profileKey);
  const leads = useGetLeads();

  // Super Admin raw user list — uses getAllUsersForAdmin (falls back to getUsersByProfile)
  const users = useGetAllUsersForAdmin();

  // Super Admin raw profile list — uses getAllProfilesRaw (no profileKey needed)
  const profiles = useGetAllProfilesRaw();

  // Map DataType → query result
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
 * LAYOUT:
 *   Left sidebar → scrollable list of all 15 data types as clickable buttons
 *   Right panel  → Card containing the DataTable for the selected type
 *
 * PROFILE CONTEXT:
 *   Super Admin must select an active profile to see profile-scoped data
 *   (vendors, users, goals, medical issues, stage inventory).
 *   Profile-independent types (notifications, products, sales, etc.) work without
 *   a selected profile.
 *
 * DATA ORDER:
 *   Records are returned in the order the backend provides them. The table
 *   displays records in descending order by date when the backend supports it.
 *   Super Admin can use the search bar to filter any field.
 */
export function DataInspectorPage() {
  const { profile } = useProfile();
  const { diagnosticsEnabled } = useUserPreferences();
  // profileKey is used for profile-scoped types; null = Super Admin has no active profile
  const profileKey = profile?.profile_key ?? null;

  // Currently selected data type — defaults to customers
  const [selectedType, setSelectedType] = useState<DataType>("customers");

  // Log page load to diagnostics
  useEffect(() => {
    if (diagnosticsEnabled) {
      logDebug(
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
      logDebug(`[DataInspector] Loading ${selectedType}...`);
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
  // Whether the currently selected type is read-only (Save will be disabled)
  const isReadOnly = selectedConfig.readOnly === true;

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
            Browse and edit raw backend records — Super Admin only · All data,
            no filtration
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
                      {dt.readOnly && (
                        <span className="ml-1.5 text-[9px] font-mono text-muted-foreground/60 bg-muted rounded px-1">
                          RO
                        </span>
                      )}
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
                  {/* Context badges */}
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
                  {isReadOnly && (
                    <Badge
                      variant="outline"
                      className="text-[10px] text-muted-foreground"
                    >
                      Read only
                    </Badge>
                  )}
                </div>
              </div>
              {/* Query note explaining which backend method is used */}
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
                profileKey={profileKey}
                isReadOnly={isReadOnly}
                diagnosticsEnabled={diagnosticsEnabled}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
