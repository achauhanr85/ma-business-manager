import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/ProfileContext";
import { useGetSuperAdminStats, useInitSuperAdmin } from "@/hooks/useBackend";
import type { ProfileStats } from "@/types";
import { ROLES } from "@/types";
import {
  Activity,
  AlertTriangle,
  Archive,
  Building2,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Lock,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SuperAdminPageProps {
  onNavigate: (path: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: bigint): string {
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatTimestamp(ts: bigint): string {
  if (ts === 0n) return "No activity";
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncatePrincipal(
  principal: { toText: () => string } | string,
): string {
  const text =
    typeof principal === "string"
      ? principal
      : (principal.toText?.() ?? String(principal));
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
  ocid: string;
}

function KpiCard({ label, value, icon, sub, ocid }: KpiProps) {
  return (
    <Card className="card-elevated stagger-item" data-ocid={ocid}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className="text-2xl font-display font-bold text-foreground leading-none">
              {value}
            </p>
            {sub && (
              <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Profile Row ──────────────────────────────────────────────────────────────

interface ProfileRowProps {
  profile: ProfileStats;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function ProfileRow({ profile, index, isExpanded, onToggle }: ProfileRowProps) {
  const statusVariant = profile.is_archived ? "secondary" : "default";
  const statusLabel = profile.is_archived ? "Archived" : "Active";
  const delay = `${index * 0.06}s`;

  return (
    <div
      className="stagger-item border border-border rounded-lg overflow-hidden bg-card"
      style={{ animationDelay: delay }}
      data-ocid={`super_admin.profile_row.${index + 1}`}
    >
      {/* Summary Row */}
      <button
        type="button"
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-muted/40 transition-colors duration-150"
        onClick={onToggle}
        data-ocid={`super_admin.profile_toggle.${index + 1}`}
        aria-expanded={isExpanded}
      >
        {/* Icon */}
        <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-secondary-foreground" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1 items-center">
          <div className="col-span-2 md:col-span-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {profile.business_name}
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {profile.profile_key}
            </p>
          </div>
          <div className="hidden md:block">
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="text-xs font-mono text-foreground">
              {truncatePrincipal(profile.owner_principal)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground">
              {Number(profile.user_count)}
            </span>
            <span className="text-xs text-muted-foreground ml-0.5">users</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground">
              {formatBytes(profile.storage_estimate_bytes)}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2 justify-between">
            <Badge variant={statusVariant} className="text-xs">
              {statusLabel}
            </Badge>
          </div>
        </div>

        {/* Chevron */}
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div
          className="border-t border-border bg-muted/30 px-4 py-4 space-y-4"
          data-ocid={`super_admin.profile_panel.${index + 1}`}
        >
          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md bg-card border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Storage</p>
              <p className="text-sm font-semibold text-foreground">
                {formatBytes(profile.storage_estimate_bytes)}
              </p>
            </div>
            <div className="rounded-md bg-card border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Users</p>
              <p className="text-sm font-semibold text-foreground">
                {Number(profile.user_count)}
              </p>
            </div>
            <div className="rounded-md bg-card border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Status</p>
              <Badge variant={statusVariant} className="text-xs mt-0.5">
                {profile.is_archived ? (
                  <span className="flex items-center gap-1">
                    <Archive className="w-3 h-3" /> Archived
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Active
                  </span>
                )}
              </Badge>
            </div>
            <div className="rounded-md bg-card border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">
                Last Activity
              </p>
              <p className="text-xs font-medium text-foreground leading-snug">
                {formatTimestamp(profile.last_activity)}
              </p>
            </div>
          </div>

          {/* Owner Info */}
          <div className="rounded-md bg-card border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-1">
              Owner Principal
            </p>
            <p className="text-xs font-mono text-foreground break-all">
              {typeof profile.owner_principal === "string"
                ? profile.owner_principal
                : (
                    profile.owner_principal as { toText: () => string }
                  ).toText?.()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-6" data-ocid="super_admin.loading_state">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="card-elevated">
            <CardContent className="pt-5 pb-4">
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function SuperAdminPage({ onNavigate: _ }: SuperAdminPageProps) {
  const { userProfile } = useProfile();
  const {
    data: stats,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useGetSuperAdminStats();
  const initSuperAdmin = useInitSuperAdmin();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isSuperAdmin =
    userProfile?.role != null &&
    (userProfile.role as unknown as string) === ROLES.SUPER_ADMIN;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const handleInitSuperAdmin = async () => {
    try {
      const result = await initSuperAdmin.mutateAsync();
      if (result) {
        toast.success("Super Admin initialized successfully. Please refresh.");
        await refetch();
      } else {
        toast.error("Could not initialize Super Admin. It may already be set.");
      }
    } catch {
      toast.error("Failed to initialize Super Admin.");
    }
  };

  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  // ─── Access Control ──────────────────────────────────────────────────────

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6" data-ocid="super_admin.page">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-semibold text-foreground">
              Super Admin
            </h1>
            <p className="text-sm text-muted-foreground">
              App-wide monitoring dashboard
            </p>
          </div>
        </div>

        {/* Unauthorized */}
        <Card
          className="card-elevated"
          data-ocid="super_admin.unauthorized_card"
        >
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <Lock className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">
                Access Restricted
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                This area is reserved for the Super Admin. You do not have
                permission to view this page.
              </p>
            </div>

            {/* Bootstrap option — only if stats are empty/unauthorized and user is NOT already super admin */}
            {!isLoading && (!stats || stats.total_profiles === 0n) && (
              <div className="mt-2 p-4 rounded-lg bg-muted/50 border border-border text-left w-full max-w-sm">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    No Super Admin has been set for this app yet. If you are the
                    first administrator, you can claim this role.
                  </p>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleInitSuperAdmin}
                  disabled={initSuperAdmin.isPending}
                  data-ocid="super_admin.init_button"
                >
                  {initSuperAdmin.isPending
                    ? "Initializing…"
                    : "Initialize Super Admin"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6" data-ocid="super_admin.page">
        <PageHeader
          lastRefreshed={null}
          isRefreshing={false}
          onRefresh={handleRefresh}
        />
        <PageSkeleton />
      </div>
    );
  }

  // ─── Bootstrap prompt (super admin view when no data yet) ────────────────

  if (!stats || stats.total_profiles === 0n) {
    return (
      <div className="space-y-6" data-ocid="super_admin.page">
        <PageHeader
          lastRefreshed={lastRefreshed}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />
        <Card className="card-elevated" data-ocid="super_admin.empty_state">
          <CardContent className="pt-10 pb-10 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground mb-1">
                No Profiles Yet
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                No business profiles have been created. Profiles will appear
                here once users sign up and create a business.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeProfiles = stats.profiles.filter((p) => !p.is_archived).length;
  const totalStorageBytes = stats.profiles.reduce(
    (sum, p) => sum + p.storage_estimate_bytes,
    0n,
  );

  return (
    <div className="space-y-6" data-ocid="super_admin.page">
      {/* Page Header */}
      <PageHeader
        lastRefreshed={lastRefreshed}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />

      {/* KPI Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        data-ocid="super_admin.kpi_section"
      >
        <KpiCard
          label="Total Profiles"
          value={Number(stats.total_profiles)}
          icon={<Building2 className="w-5 h-5 text-primary" />}
          sub={`${activeProfiles} active`}
          ocid="super_admin.kpi_total_profiles"
        />
        <KpiCard
          label="Total Users"
          value={Number(stats.total_users)}
          icon={<Users className="w-5 h-5 text-primary" />}
          sub="Across all profiles"
          ocid="super_admin.kpi_total_users"
        />
        <KpiCard
          label="Active Profiles"
          value={activeProfiles}
          icon={<Activity className="w-5 h-5 text-primary" />}
          sub={`Total storage: ${formatBytes(totalStorageBytes)}`}
          ocid="super_admin.kpi_active_profiles"
        />
      </div>

      {/* Profiles Table */}
      <Card className="card-elevated" data-ocid="super_admin.profiles_card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base font-semibold">
              Business Profiles
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {stats.profiles.length} total
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Column Headers (md+) */}
          <div className="hidden md:grid grid-cols-5 gap-4 px-4 mb-2">
            {["Profile / Key", "Owner", "Users", "Storage", "Status"].map(
              (h) => (
                <p
                  key={h}
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                >
                  {h}
                </p>
              ),
            )}
          </div>

          <div className="space-y-2" data-ocid="super_admin.profiles_list">
            {stats.profiles.map((profile, idx) => (
              <ProfileRow
                key={profile.profile_key}
                profile={profile}
                index={idx}
                isExpanded={expandedKey === profile.profile_key}
                onToggle={() =>
                  setExpandedKey(
                    expandedKey === profile.profile_key
                      ? null
                      : profile.profile_key,
                  )
                }
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page Header Component ───────────────────────────────────────────────────

interface PageHeaderProps {
  lastRefreshed: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function PageHeader({
  lastRefreshed,
  isRefreshing,
  onRefresh,
}: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-display font-semibold text-foreground">
            Super Admin
          </h1>
          <p className="text-sm text-muted-foreground">
            {lastRefreshed
              ? `Last updated at ${lastRefreshed}`
              : "App-wide monitoring dashboard"}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1.5 flex-shrink-0"
        data-ocid="super_admin.refresh_button"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
        />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  );
}
