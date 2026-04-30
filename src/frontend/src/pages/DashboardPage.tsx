/*
 * PAGE: DashboardPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Main home page for Admin and Staff. Shows KPI cards, sales trend chart,
 *   referral commission breakdown, inventory alerts, and quick-action tiles.
 *
 * ROLE ACCESS:
 *   admin, staff — superAdmin redirected to /super-admin; referralUser to /customers
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ profileKey from ProfileContext (impersonation-aware)
 *      ├─ userProfile from ProfileContext for role checks
 *      └─ calls multiple hooks in parallel:
 *           ├─ useGetDashboardStats()         → KPI counts
 *           ├─ useGetSales()                  → for filtered sales count
 *           ├─ useGetInventoryLevels()        → for low-stock/out-of-stock
 *           ├─ useGetMonthlySalesTrend()      → for line chart
 *           ├─ useGetReferralCommissionByMonth() → for commission chart
 *           ├─ useGetProducts()               → for product name lookups
 *           ├─ useGetCategories()             → for category name lookups
 *           └─ useGetUsersByProfile(profileKey) → for staff selector filter
 *   2. Render logic
 *      ├─ Loading → skeleton KPI cards + skeleton chart
 *      ├─ KPI cards: Total Revenue, Sales Count, Active Customers, Inventory Alerts
 *      ├─ Sales count filter: All / Self / per-staff selector (Admin only)
 *      ├─ Monthly Sales Trend line chart (via Recharts LineChart)
 *      ├─ Referral Commission chart (multi-line, per Referral User)
 *      └─ Quick links: Create Sale, Create Customer, Purchase Order
 *   3. Manual notification refresh
 *      ├─ Admin/SuperAdmin sees "Refresh Notifications" button
 *      └─ calls useRunBackgroundChecks() → triggers all notification jobs
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - selectedStaff: string = "all"      // sales filter: "all" | "self" | userId
 *   - helpOpen: boolean = false           // HelpPanel open state
 *   - selectedInventoryProduct: bigint | null // for inventory batch drill-down
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   none (all data loaded via React Query hooks)
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - handleRefreshNotifications: calls useRunBackgroundChecks mutation
 *   - handleStaffFilter: updates selectedStaff for sales count filter
 *   - onNavigate: navigates to sale/customer/po pages
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { HelpPanel } from "@/components/HelpPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useGetCategories,
  useGetDashboardStats,
  useGetInventoryLevels,
  useGetMonthlySalesTrend,
  useGetProducts,
  useGetReferralCommissionByMonth,
  useGetSales,
  useGetUsersByProfile,
  useRunBackgroundChecks,
} from "@/hooks/useBackend";
import type { Sale } from "@/types";
import { UserRole } from "@/types";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  HelpCircle,
  IndianRupee,
  Layers,
  LayoutGrid,
  Package,
  Star,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Palette for multi-line referral commission chart
const REFERRAL_COLORS = [
  "hsl(var(--primary))",
  "#e07b39",
  "#7c5cbf",
  "#2d9e6b",
  "#c94040",
  "#3b82f6",
];

interface DashboardPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

function formatCurrency(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatDate(timestamp: bigint): string {
  const ms = Number(timestamp) / 1_000_000;
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon: React.ReactNode;
  loading?: boolean;
}

function KpiCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  loading,
}: KpiCardProps) {
  return (
    <Card
      className="relative overflow-hidden card-elevated"
      data-ocid={`dashboard.kpi_${title.replace(/\s+/g, "_").toLowerCase()}.card`}
    >
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-medium text-muted-foreground">
                {title}
              </p>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                {icon}
              </div>
            </div>
            <div className="text-2xl font-display font-bold text-foreground tracking-tight">
              {value}
            </div>
            {subtitle && (
              <div className="flex items-center gap-1 mt-1.5">
                {trend === "up" && (
                  <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                )}
                {trend === "down" && (
                  <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />
                )}
                <span
                  className={`text-xs font-medium ${trend === "up" ? "text-primary" : trend === "down" ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {subtitle}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
    </Card>
  );
}

function QuickStatBadge({
  label,
  value,
  icon,
}: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-secondary/60 rounded-lg px-3 py-2.5 min-w-0">
      <div className="text-primary flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}

function RecentSaleRow({ sale, index }: { sale: Sale; index: number }) {
  return (
    <div
      className="flex items-center justify-between py-3 px-1 border-b border-border last:border-0"
      data-ocid={`dashboard.recent_sales.item.${index + 1}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <IndianRupee className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {sale.customer_name || `Sale #${sale.id.toString()}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(sale.timestamp)}
          </p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 ml-3">
        <p className="text-sm font-semibold text-foreground">
          {formatCurrency(sale.total_revenue)}
        </p>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
          {sale.total_volume_points} VP
        </Badge>
      </div>
    </div>
  );
}

type ChartMode = "revenue" | "volume_points";

// ─── User Detail Sheet ────────────────────────────────────────────────────────

interface UserDetailSheetProps {
  user: import("@/types").UserProfilePublic | null;
  open: boolean;
  onClose: () => void;
}

function UserDetailSheet({ user, open, onClose }: UserDetailSheetProps) {
  if (!user) return null;

  const rawRole = String(user.role);
  const roleLabel =
    rawRole === "superAdmin"
      ? "Super Admin"
      : rawRole === "admin"
        ? "Admin"
        : rawRole === "referralUser"
          ? "Referral User"
          : "Staff";

  const approvalStatus = (user as { approval_status?: string }).approval_status;
  const moduleAccess = (user as { module_access?: string }).module_access;
  const creationDate = (user as { creation_date?: bigint }).creation_date;

  const formattedDate = creationDate
    ? new Date(Number(creationDate) / 1_000_000).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not set";

  const principalText =
    typeof user.principal === "string"
      ? user.principal
      : ((user.principal as { toText?: () => string }).toText?.() ??
        String(user.principal));

  const moduleList = moduleAccess
    ? moduleAccess
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] overflow-y-auto pl-8"
        data-ocid="dashboard.user_detail.sheet"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary uppercase">
              {(user.display_name ?? "?").charAt(0)}
            </div>
            <span className="text-base font-semibold truncate">
              {user.display_name || "Unnamed User"}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Role */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Role</span>
            <Badge
              variant={rawRole === "admin" ? "default" : "secondary"}
              className="text-xs capitalize"
            >
              {roleLabel}
            </Badge>
          </div>

          {/* Approval Status */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">
              Approval Status
            </span>
            <Badge
              variant={
                approvalStatus === "approved"
                  ? "default"
                  : approvalStatus === "pending"
                    ? "outline"
                    : "secondary"
              }
              className="text-xs capitalize"
            >
              {approvalStatus ?? "Not set"}
            </Badge>
          </div>

          {/* Warehouse */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Warehouse</span>
            <span className="text-sm font-medium text-foreground">
              {user.warehouse_name || "Not set"}
            </span>
          </div>

          {/* Profile Key */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Profile</span>
            <code className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">
              {user.profile_key || "Not set"}
            </code>
          </div>

          {/* Module Access */}
          <div className="py-2 border-b border-border space-y-2">
            <span className="text-sm text-muted-foreground">Module Access</span>
            {moduleList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {moduleList.map((mod) => (
                  <Badge
                    key={mod}
                    variant="outline"
                    className="text-xs capitalize"
                  >
                    {mod}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-1">
                All modules (no restriction)
              </p>
            )}
          </div>

          {/* Joined Date */}
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Joined</span>
            <span className="text-sm font-medium text-foreground">
              {formattedDate}
            </span>
          </div>

          {/* Principal */}
          <div className="py-2">
            <span className="text-sm text-muted-foreground">Principal ID</span>
            <p className="text-xs font-mono text-muted-foreground break-all mt-1">
              {principalText}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("revenue");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<
    import("@/types").UserProfilePublic | null
  >(null);
  const [userSheetOpen, setUserSheetOpen] = useState(false);

  const { userProfile } = useProfile();
  const role = userProfile?.role;
  const isAdmin = role === UserRole.admin;
  const profileKey = userProfile?.profile_key ?? null;

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: trend, isLoading: trendLoading } = useGetMonthlySalesTrend();
  const { data: products } = useGetProducts();
  const { data: categories } = useGetCategories();
  const { data: inventoryLevels } = useGetInventoryLevels();
  const { data: allSales = [] } = useGetSales();
  const { data: profileUsers = [] } = useGetUsersByProfile(
    isAdmin ? profileKey : null,
  );

  // Referral commission data (admin only)
  const { data: referralCommissionData = [] } =
    useGetReferralCommissionByMonth();

  // Run background checks once on mount
  const { mutate: triggerBackgroundChecks } = useRunBackgroundChecks();
  const bgChecksRan = useRef(false);
  useEffect(() => {
    if (bgChecksRan.current) return;
    bgChecksRan.current = true;
    triggerBackgroundChecks();
  }, [triggerBackgroundChecks]);

  // Staff users for filter dropdown (admin only)
  const staffUsers = useMemo(
    () => profileUsers.filter((u) => u.role !== UserRole.superAdmin),
    [profileUsers],
  );

  // Check if any referral users exist in the profile
  const hasReferralUsers = useMemo(
    () => profileUsers.some((u) => (u.role as string) === "referralUser"),
    [profileUsers],
  );

  // Total accrued referral commission
  const totalReferralCommission = useMemo(
    () =>
      referralCommissionData.reduce((sum, e) => sum + e.total_commission, 0),
    [referralCommissionData],
  );

  // Build referral commission chart data: pivot by month, one key per referral user
  const referralChartData = useMemo(() => {
    if (referralCommissionData.length === 0) return [];
    // Collect all unique months and user names
    const months = [
      ...new Set(referralCommissionData.map((e) => e.month)),
    ].sort();
    const userNames = [
      ...new Set(
        referralCommissionData.map((e) => e.referral_user_display_name),
      ),
    ];
    return months.map((month) => {
      const row: Record<string, string | number> = { month };
      for (const name of userNames) {
        const entry = referralCommissionData.find(
          (e) => e.month === month && e.referral_user_display_name === name,
        );
        row[name] = entry?.total_commission ?? 0;
      }
      return row;
    });
  }, [referralCommissionData]);

  const referralChartUsers = useMemo(
    () => [
      ...new Set(
        referralCommissionData.map((e) => e.referral_user_display_name),
      ),
    ],
    [referralCommissionData],
  );

  // Filter sales by selected staff
  const filteredSales = useMemo(() => {
    if (!isAdmin || selectedStaffId === "all") return allSales;
    return allSales.filter(
      (s) =>
        s.sold_by.toText?.() === selectedStaffId ||
        s.sold_by.toString() === selectedStaffId,
    );
  }, [allSales, selectedStaffId, isAdmin]);

  // Compute filtered KPIs from filtered sales
  const filteredStats = useMemo(() => {
    if (!isAdmin || selectedStaffId === "all") return null;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const monthSales = filteredSales.filter((s) => {
      const d = new Date(Number(s.timestamp) / 1_000_000);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });
    const totalRevenue = monthSales.reduce(
      (sum, s) => sum + s.total_revenue,
      0,
    );
    const totalVP = monthSales.reduce(
      (sum, s) => sum + s.total_volume_points,
      0,
    );
    const totalProfit = monthSales.reduce(
      (sum, s) => sum + (s.total_profit ?? 0),
      0,
    );
    return {
      monthly_volume_points: totalVP,
      monthly_profit: totalProfit,
      monthly_revenue: totalRevenue,
      sale_count: monthSales.length,
    };
  }, [filteredSales, selectedStaffId, isAdmin]);

  // Build chart data from filtered sales when staff is selected
  const filteredChartData = useMemo(() => {
    if (!isAdmin || selectedStaffId === "all") return null;
    const monthMap = new Map<
      string,
      { revenue: number; volume_points: number }
    >();
    for (const s of filteredSales) {
      const d = new Date(Number(s.timestamp) / 1_000_000);
      const label = d.toLocaleDateString("en-IN", {
        month: "short",
        year: "2-digit",
      });
      const existing = monthMap.get(label) ?? { revenue: 0, volume_points: 0 };
      monthMap.set(label, {
        revenue: existing.revenue + s.total_revenue,
        volume_points: existing.volume_points + s.total_volume_points,
      });
    }
    return Array.from(monthMap.entries()).map(([label, v]) => ({
      label,
      ...v,
    }));
  }, [filteredSales, selectedStaffId, isAdmin]);

  const totalProducts = products?.length ?? 0;
  const totalCategories = categories?.length ?? 0;
  const totalBatches =
    inventoryLevels?.reduce((acc, lvl) => acc + lvl.batches.length, 0) ?? 0;

  const backendChartData = (trend ?? []).map((item) => ({
    label: item.month_label,
    revenue: item.total_revenue,
    volume_points: item.total_volume_points,
  }));

  const rawChartData = filteredChartData ?? backendChartData;
  const displayChartData =
    rawChartData.length > 0
      ? rawChartData
      : [
          { label: "Nov", revenue: 42000, volume_points: 310 },
          { label: "Dec", revenue: 58000, volume_points: 420 },
          { label: "Jan", revenue: 51000, volume_points: 380 },
          { label: "Feb", revenue: 67000, volume_points: 510 },
          { label: "Mar", revenue: 73000, volume_points: 560 },
          { label: "Apr", revenue: 62000, volume_points: 490 },
        ];

  const recentSales =
    filteredSales.slice(0, 5).length > 0
      ? filteredSales.slice(0, 5)
      : (stats?.recent_sales ?? []);

  const displayStats = filteredStats ?? {
    monthly_volume_points: stats?.monthly_volume_points ?? 0,
    monthly_profit: stats?.monthly_profit ?? 0,
    monthly_revenue: 0,
    sale_count: allSales.length,
  };

  const quickActions = [
    {
      label: "New Sale",
      path: "/sales",
      icon: <IndianRupee className="w-5 h-5" />,
      desc: "Create a sale",
    },
    {
      label: "Inventory",
      path: "/inventory",
      icon: <Package className="w-5 h-5" />,
      desc: "Check stock",
    },
    {
      label: "Purchase Order",
      path: "/purchase-orders",
      icon: <Boxes className="w-5 h-5" />,
      desc: "Add stock",
    },
    ...(isAdmin
      ? [
          {
            label: "Manage Users",
            path: "/user-management",
            icon: <Users className="w-5 h-5" />,
            desc: "Users & access",
          },
        ]
      : [
          {
            label: "Products",
            path: "/products",
            icon: <LayoutGrid className="w-5 h-5" />,
            desc: "Manage products",
          },
        ]),
  ];

  return (
    <div className="space-y-5 pb-8" data-ocid="dashboard.page">
      {/* Page header with help icon */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-semibold text-foreground">
          Dashboard
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setHelpOpen(true)}
          aria-label="Open help"
          data-ocid="dashboard.help_button"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Staff filter (Admin only) */}
      {isAdmin && (
        <div
          className="flex items-center gap-3 flex-wrap"
          data-ocid="dashboard.staff_filter.section"
        >
          <p className="text-sm font-medium text-muted-foreground">
            Filter by Staff:
          </p>
          <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
            <SelectTrigger
              className="w-48 h-8 text-sm"
              data-ocid="dashboard.staff_filter.select"
            >
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffUsers.map((u) => (
                <SelectItem
                  key={u.principal.toText?.() ?? u.display_name}
                  value={u.principal.toText?.() ?? u.display_name}
                >
                  {u.display_name || u.warehouse_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedStaffId !== "all" && (
            <Badge
              variant="secondary"
              className="text-xs bg-primary/10 text-primary border-primary/20"
            >
              Filtered view
            </Badge>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div
        className={`grid gap-4 ${isAdmin && hasReferralUsers ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}
        data-ocid="dashboard.kpi.section"
      >
        <KpiCard
          title="Monthly Volume Points"
          value={formatNumber(displayStats.monthly_volume_points)}
          subtitle={
            selectedStaffId !== "all"
              ? `Staff: ${staffUsers.find((u) => (u.principal.toText?.() ?? u.display_name) === selectedStaffId)?.display_name ?? "Selected"}`
              : "This month"
          }
          trend="neutral"
          icon={<Star className="w-4 h-4" />}
          loading={statsLoading && selectedStaffId === "all"}
        />
        <KpiCard
          title="Estimated Profit"
          value={formatCurrency(displayStats.monthly_profit)}
          subtitle={selectedStaffId !== "all" ? "Filtered" : "This month"}
          trend="up"
          icon={<TrendingUp className="w-4 h-4" />}
          loading={statsLoading && selectedStaffId === "all"}
        />
        <KpiCard
          title="Inventory Value"
          value={stats ? formatCurrency(stats.total_inventory_value) : "—"}
          subtitle="Current stock"
          trend="neutral"
          icon={<Package className="w-4 h-4" />}
          loading={statsLoading}
        />
        {isAdmin && hasReferralUsers && (
          <KpiCard
            title="Accrued Referral Commission"
            value={formatCurrency(totalReferralCommission)}
            subtitle="All referral users"
            trend="up"
            icon={<Users className="w-4 h-4" />}
            loading={false}
          />
        )}
      </div>

      {/* Customer Status KPI cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        data-ocid="dashboard.customer_status.section"
      >
        <Card
          className="relative overflow-hidden card-elevated"
          data-ocid="dashboard.kpi_total_leads.card"
        >
          <CardContent className="p-5">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Leads
                  </p>
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="text-2xl font-display font-bold text-foreground tracking-tight">
                  {stats ? Number(stats.lead_count).toString() : "—"}
                </div>
                <div className="mt-1.5">
                  <span className="text-xs font-medium text-blue-600">
                    Awaiting conversion
                  </span>
                </div>
              </>
            )}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-blue-500/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden card-elevated"
          data-ocid="dashboard.kpi_active_customers.card"
        >
          <CardContent className="p-5">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Active Customers
                  </p>
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="text-2xl font-display font-bold text-foreground tracking-tight">
                  {stats ? Number(stats.active_count).toString() : "—"}
                </div>
                <div className="mt-1.5">
                  <span className="text-xs font-medium text-primary">
                    Sales enabled
                  </span>
                </div>
              </>
            )}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-primary/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          </CardContent>
        </Card>

        <Card
          className="relative overflow-hidden card-elevated"
          data-ocid="dashboard.kpi_inactive_customers.card"
        >
          <CardContent className="p-5">
            {statsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-8 w-20" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    Inactive Customers
                  </p>
                  <div className="w-9 h-9 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
                    <UserX className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="text-2xl font-display font-bold text-foreground tracking-tight">
                  {stats ? Number(stats.inactive_count).toString() : "—"}
                </div>
                <div className="mt-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    No recent activity
                  </span>
                </div>
              </>
            )}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-muted/20 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div
        className="grid grid-cols-3 gap-3"
        data-ocid="dashboard.quick_stats.section"
      >
        <QuickStatBadge
          label="Products"
          value={totalProducts}
          icon={<LayoutGrid className="w-4 h-4" />}
        />
        <QuickStatBadge
          label="Categories"
          value={totalCategories}
          icon={<Layers className="w-4 h-4" />}
        />
        <QuickStatBadge
          label="Batches"
          value={totalBatches}
          icon={<Boxes className="w-4 h-4" />}
        />
      </div>

      {/* Sales Trend Chart + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card
          className="lg:col-span-3 card-elevated"
          data-ocid="dashboard.sales_trend.card"
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base font-display">
              Sales Trends
              {selectedStaffId !== "all" && (
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  (filtered)
                </span>
              )}
            </CardTitle>
            <div
              className="flex items-center rounded-lg border border-border overflow-hidden text-xs font-medium"
              data-ocid="dashboard.chart_toggle"
            >
              <button
                type="button"
                className={`px-3 py-1.5 transition-colors ${chartMode === "revenue" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                onClick={() => setChartMode("revenue")}
                data-ocid="dashboard.chart_revenue.tab"
              >
                Revenue
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 transition-colors ${chartMode === "volume_points" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}
                onClick={() => setChartMode("volume_points")}
                data-ocid="dashboard.chart_vp.tab"
              >
                Volume Points
              </button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {trendLoading && selectedStaffId === "all" ? (
              <Skeleton
                className="h-52 w-full rounded-md"
                data-ocid="dashboard.chart.loading_state"
              />
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart
                  data={displayChartData}
                  margin={{ top: 5, right: 5, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) =>
                      chartMode === "revenue"
                        ? v >= 1000
                          ? `${v / 1000}K`
                          : String(v)
                        : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                    formatter={(value: number) =>
                      chartMode === "revenue"
                        ? [`₹${value.toLocaleString("en-IN")}`, "Revenue"]
                        : [value, "Volume Points"]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey={chartMode}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 0 }}
                    activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card
          className="lg:col-span-2 card-elevated"
          data-ocid="dashboard.recent_sales.card"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display">
                Recent Sales
              </CardTitle>
              <button
                type="button"
                onClick={() => onNavigate("/sales")}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                data-ocid="dashboard.view_sales.link"
              >
                New Sale →
              </button>
            </div>
          </CardHeader>
          <CardContent className="pb-2">
            {statsLoading && selectedStaffId === "all" ? (
              <div
                className="space-y-3"
                data-ocid="dashboard.recent_sales.loading_state"
              >
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : recentSales.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 text-center"
                data-ocid="dashboard.recent_sales.empty_state"
              >
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <IndianRupee className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  No sales yet
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first sale to see data here
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate("/sales")}
                  className="mt-3 text-xs text-primary font-semibold hover:underline"
                  data-ocid="dashboard.create_sale.button"
                >
                  Create Sale →
                </button>
              </div>
            ) : (
              <div>
                {recentSales.slice(0, 5).map((sale, i) => (
                  <RecentSaleRow
                    key={sale.id.toString()}
                    sale={sale}
                    index={i}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Referral Commission Chart (Admin only, when referral data exists) */}
      {isAdmin && referralChartData.length > 0 && (
        <Card
          className="card-elevated"
          data-ocid="dashboard.referral_commission.card"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display">
              Referral Commission by Month
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={referralChartData}
                margin={{ top: 5, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="month"
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{
                    fontSize: 11,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${v / 1000}K` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, name: string) => [
                    `₹${value.toLocaleString("en-IN")}`,
                    name,
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
                {referralChartUsers.map((userName, idx) => (
                  <Line
                    key={userName}
                    type="monotone"
                    dataKey={userName}
                    stroke={REFERRAL_COLORS[idx % REFERRAL_COLORS.length]}
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      strokeWidth: 0,
                      fill: REFERRAL_COLORS[idx % REFERRAL_COLORS.length],
                    }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Action Cards */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        data-ocid="dashboard.quick_actions.section"
      >
        {quickActions.map((action, i) => (
          <button
            key={action.path}
            type="button"
            onClick={() => onNavigate(action.path)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-secondary/60 transition-smooth text-center group"
            data-ocid={`dashboard.quick_action.item.${i + 1}`}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-smooth">
              {action.icon}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {action.label}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                {action.desc}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Team Members — Admin only, click to open full details side panel */}
      {isAdmin && staffUsers.length > 0 && (
        <Card className="card-elevated" data-ocid="dashboard.team_members.card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display">
                Team Members
              </CardTitle>
              <button
                type="button"
                onClick={() => onNavigate("/user-management")}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                data-ocid="dashboard.manage_users.link"
              >
                Manage →
              </button>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div
              className="space-y-1.5"
              data-ocid="dashboard.team_members.list"
            >
              {staffUsers.slice(0, 6).map((u, i) => {
                const principalStr =
                  typeof u.principal === "string"
                    ? u.principal
                    : ((u.principal as { toText?: () => string }).toText?.() ??
                      String(u.principal));
                const rawRole = String(u.role);
                const approvalStatus = (u as { approval_status?: string })
                  .approval_status;
                return (
                  <button
                    key={principalStr}
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => {
                      setSelectedUser(u as import("@/types").UserProfilePublic);
                      setUserSheetOpen(true);
                    }}
                    data-ocid={`dashboard.team_member.item.${i + 1}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary uppercase flex-shrink-0">
                      {(u.display_name ?? "?").charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {u.display_name || "Unnamed"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.warehouse_name || "No warehouse"} ·{" "}
                        <span className="capitalize">{rawRole}</span>
                      </p>
                    </div>
                    {approvalStatus === "pending" && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-400/40 flex-shrink-0"
                      >
                        Pending
                      </Badge>
                    )}
                    {approvalStatus === "approved" && (
                      <Badge
                        variant="default"
                        className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                      >
                        Active
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Detail Sheet */}
      <UserDetailSheet
        user={selectedUser}
        open={userSheetOpen}
        onClose={() => {
          setUserSheetOpen(false);
          setSelectedUser(null);
        }}
      />

      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        defaultPageKey="dashboard"
      />
    </div>
  );
}
