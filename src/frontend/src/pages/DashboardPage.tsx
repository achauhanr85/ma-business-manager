import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetCategories,
  useGetDashboardStats,
  useGetInventoryLevels,
  useGetMonthlySalesTrend,
  useGetProducts,
} from "@/hooks/useBackend";
import type { Sale } from "@/types";
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  IndianRupee,
  Layers,
  LayoutGrid,
  Package,
  Star,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
      {/* decorative accent */}
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
            Sale #{sale.id.toString()}
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

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [chartMode, setChartMode] = useState<ChartMode>("revenue");

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: trend, isLoading: trendLoading } = useGetMonthlySalesTrend();
  const { data: products } = useGetProducts();
  const { data: categories } = useGetCategories();
  const { data: inventoryLevels } = useGetInventoryLevels();

  const totalProducts = products?.length ?? 0;
  const totalCategories = categories?.length ?? 0;
  const totalBatches =
    inventoryLevels?.reduce((acc, lvl) => acc + lvl.batches.length, 0) ?? 0;

  const chartData = (trend ?? []).map((item) => ({
    label: item.month_label,
    revenue: item.total_revenue,
    volume_points: item.total_volume_points,
  }));

  // Fallback sample data so chart is never empty on first load
  const displayChartData =
    chartData.length > 0
      ? chartData
      : [
          { label: "Nov", revenue: 42000, volume_points: 310 },
          { label: "Dec", revenue: 58000, volume_points: 420 },
          { label: "Jan", revenue: 51000, volume_points: 380 },
          { label: "Feb", revenue: 67000, volume_points: 510 },
          { label: "Mar", revenue: 73000, volume_points: 560 },
          { label: "Apr", revenue: 62000, volume_points: 490 },
        ];

  const recentSales = stats?.recent_sales ?? [];

  return (
    <div className="space-y-5 pb-8" data-ocid="dashboard.page">
      {/* KPI Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        data-ocid="dashboard.kpi.section"
      >
        <KpiCard
          title="Monthly Volume Points"
          value={stats ? formatNumber(stats.monthly_volume_points) : "—"}
          subtitle="This month"
          trend="neutral"
          icon={<Star className="w-4 h-4" />}
          loading={statsLoading}
        />
        <KpiCard
          title="Estimated Profit"
          value={stats ? formatCurrency(stats.monthly_profit) : "—"}
          subtitle="This month"
          trend="up"
          icon={<TrendingUp className="w-4 h-4" />}
          loading={statsLoading}
        />
        <KpiCard
          title="Inventory Value"
          value={stats ? formatCurrency(stats.total_inventory_value) : "—"}
          subtitle="Current stock"
          trend="neutral"
          icon={<Package className="w-4 h-4" />}
          loading={statsLoading}
        />
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
        {/* Chart */}
        <Card
          className="lg:col-span-3 card-elevated"
          data-ocid="dashboard.sales_trend.card"
        >
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-base font-display">
              Sales Trends
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
            {trendLoading ? (
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
            {statsLoading ? (
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

      {/* Action Cards */}
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        data-ocid="dashboard.quick_actions.section"
      >
        {[
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
          {
            label: "Products",
            path: "/products",
            icon: <LayoutGrid className="w-5 h-5" />,
            desc: "Manage products",
          },
        ].map((action, i) => (
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
    </div>
  );
}
