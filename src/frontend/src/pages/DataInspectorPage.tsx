import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  useGetBodyCompositionHistory,
  useGetCategories,
  useGetCustomers,
  useGetGoalMasterData,
  useGetInventoryMovements,
  useGetLeads,
  useGetMedicalIssueMasterData,
  useGetNotifications,
  useGetProducts,
  useGetPurchaseOrders,
  useGetSales,
  useGetStagedInventory,
  useGetVendors,
} from "@/hooks/useBackend";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Download,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

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
  | "leads";

interface DataTypeConfig {
  label: string;
  key: DataType;
}

const DATA_TYPES: DataTypeConfig[] = [
  { label: "Customers", key: "customers" },
  { label: "Sales / Orders", key: "sales" },
  { label: "Notifications", key: "notifications" },
  { label: "Inventory Movements", key: "inventory" },
  { label: "Products", key: "products" },
  { label: "Categories", key: "categories" },
  { label: "Purchase Orders", key: "purchaseOrders" },
  { label: "Vendors", key: "vendors" },
  { label: "Customer Goals", key: "goals" },
  { label: "Medical Issues", key: "medicalIssues" },
  { label: "Body Composition", key: "bodyComposition" },
  { label: "Stage Inventory", key: "stageInventory" },
  { label: "Leads", key: "leads" },
];

// ─── Value rendering helpers ──────────────────────────────────────────────────

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

function isSkippedKey(_key: string): boolean {
  // Skip nested arrays/objects for the summary table — shown in detail panel
  return false; // Show all keys in summary; detail panel shows everything
}

/** Pull top-level primitive fields for table columns */
function getTableColumns(records: Record<string, unknown>[]): string[] {
  if (records.length === 0) return [];
  const first = records[0];
  return Object.keys(first)
    .filter((k) => !isSkippedKey(k))
    .slice(0, 8);
}

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

function renderCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "bigint") {
    // Likely a timestamp (nanoseconds) — show as date if large
    const n = Number(value);
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

// ─── Data table ───────────────────────────────────────────────────────────────

interface DataTableProps {
  records: Record<string, unknown>[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  dataType: DataType;
}

function DataTable({
  records,
  isLoading,
  isError,
  onRefresh,
  dataType,
}: DataTableProps) {
  const [search, setSearch] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter((r) =>
      Object.values(r).some((v) => formatValue(v).toLowerCase().includes(q)),
    );
  }, [records, search]);

  const columns = useMemo(() => getTableColumns(filtered), [filtered]);

  const handleExport = useCallback(() => {
    exportToCSV(filtered, `${dataType}-export`);
  }, [filtered, dataType]);

  const toggleRow = (i: number) =>
    setExpandedRow((prev) => (prev === i ? null : i));

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
                <TableHead className="w-8 py-2" />
                <TableHead className="text-[11px] font-semibold text-muted-foreground py-2 w-10">
                  #
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
                  <TableRow
                    key={rowKey}
                    data-ocid={`data_inspector.item.${i + 1}`}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleRow(i)}
                  >
                    <TableCell className="py-2 px-2 w-8">
                      {expandedRow === i ? (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-xs text-muted-foreground font-mono w-10">
                      {i + 1}
                    </TableCell>
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
                );
              })}
              {expandedRow !== null && filtered[expandedRow] && (
                <TableRow key="detail-panel" className="hover:bg-transparent">
                  <TableCell colSpan={columns.length + 2} className="p-0">
                    <RowDetail record={filtered[expandedRow]} />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Data loader: one hook per type ───────────────────────────────────────────

function useDataForType(dataType: DataType, profileKey: string | null) {
  const customers = useGetCustomers();
  const sales = useGetSales();
  const notifications = useGetNotifications(profileKey, "admin");
  const inventory = useGetInventoryMovements();
  const products = useGetProducts();
  const categories = useGetCategories();
  const purchaseOrders = useGetPurchaseOrders();
  const vendors = useGetVendors(profileKey);
  const goals = useGetGoalMasterData(profileKey);
  const medicalIssues = useGetMedicalIssueMasterData(profileKey);
  // Body composition requires a customerId — show placeholder
  const bodyComp = useGetBodyCompositionHistory(null);
  const stageInventory = useGetStagedInventory(profileKey);
  const leads = useGetLeads();

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
  } as const;

  return map[dataType];
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DataInspectorPage() {
  const { profile } = useProfile();
  const profileKey = profile?.profile_key ?? null;

  const [selectedType, setSelectedType] = useState<DataType>("customers");

  const queryResult = useDataForType(selectedType, profileKey);

  // Safe cast: all hooks return { data, isLoading, isError, refetch }
  const { data, isLoading, isError, refetch } = queryResult as {
    data: unknown[] | undefined | null;
    isLoading: boolean;
    isError: boolean;
    refetch: () => void;
  };

  // Normalise data to Record<string,unknown>[]
  const records = useMemo<Record<string, unknown>[]>(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((item) => {
      if (item === null || item === undefined) return {};
      if (typeof item !== "object") return { value: item };
      return item as Record<string, unknown>;
    });
  }, [data]);

  const selectedConfig = DATA_TYPES.find((d) => d.key === selectedType)!;

  return (
    <div className="p-4 md:p-6 max-w-full" data-ocid="data_inspector.page">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Database className="w-4.5 h-4.5 text-primary" />
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
        <div className="lg:w-52 flex-shrink-0">
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
                      onClick={() => setSelectedType(dt.key)}
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
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold text-foreground">
                  {selectedConfig.label}
                </CardTitle>
                {selectedType === "bodyComposition" && (
                  <Badge variant="outline" className="text-[10px]">
                    Requires customer context
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <DataTable
                records={records}
                isLoading={isLoading}
                isError={isError}
                onRefresh={refetch}
                dataType={selectedType}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
