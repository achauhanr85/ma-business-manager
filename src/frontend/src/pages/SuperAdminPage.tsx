import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useEnableProfile,
  useGetAllProfilesForAdmin,
  useGetSuperAdminStats,
  useInitSuperAdmin,
  useSetProfileWindow,
} from "@/hooks/useBackend";
import type { ProfileStats } from "@/types";
import type { ProfileStatsExtended } from "@/types";
import { ROLES } from "@/types";
import {
  Activity,
  AlertTriangle,
  Archive,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Info,
  Lock,
  RefreshCw,
  Search,
  Shield,
  ToggleLeft,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
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
  if (!ts || ts === 0n) return "No activity";
  const ms = Number(ts / 1_000_000n);
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(ts: bigint): string {
  if (!ts || ts === 0n) return "No activity";
  const ms = Number(ts / 1_000_000n);
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function truncatePrincipal(
  principal: { toText?: () => string } | string,
): string {
  const text =
    typeof principal === "string"
      ? principal
      : (principal.toText?.() ?? String(principal));
  if (text.length <= 16) return text;
  return `${text.slice(0, 8)}…${text.slice(-6)}`;
}

function msToDateInput(ns: number | bigint | null | undefined): string {
  if (!ns) return "";
  // Backend timestamps are nanoseconds; convert to ms for Date
  const ms = typeof ns === "bigint" ? Number(ns / 1_000_000n) : ns;
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function dateInputToMs(val: string): number | null {
  if (!val) return null;
  return new Date(val).getTime();
}

function getProfileStatus(
  profile: ProfileStats | ProfileStatsExtended,
): "active" | "disabled" | "expired" | "archived" {
  if (profile.is_archived) return "archived";
  const ext = profile as ProfileStatsExtended;
  if ("is_enabled" in ext && !ext.is_enabled) return "disabled";
  if ("end_date" in ext && ext.end_date) {
    // end_date is nanoseconds from backend; convert to ms for comparison
    const endMs =
      typeof ext.end_date === "bigint"
        ? Number(ext.end_date / 1_000_000n)
        : ext.end_date;
    if (endMs && endMs < Date.now()) return "expired";
  }
  return "active";
}

type ProfileStatus = "active" | "disabled" | "expired" | "archived";

const STATUS_CONFIG: Record<
  ProfileStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    className: string;
  }
> = {
  active: {
    label: "Active",
    variant: "default",
    className: "bg-primary/15 text-primary border-primary/30",
  },
  disabled: {
    label: "Disabled",
    variant: "secondary",
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  expired: {
    label: "Expired",
    variant: "outline",
    className: "bg-accent/15 text-accent-foreground border-accent/40",
  },
  archived: {
    label: "Archived",
    variant: "secondary",
    className: "",
  },
};

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

// ─── Governance Info Panel ────────────────────────────────────────────────────

function GovernanceInfoPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-lg border border-primary/20 bg-primary/5"
      data-ocid="super_admin.governance_panel"
    >
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        data-ocid="super_admin.governance_toggle"
      >
        <Info className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-sm font-medium text-foreground flex-1">
          Governance Guide
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-primary/10">
          {[
            {
              icon: <Activity className="w-3.5 h-3.5 text-primary" />,
              status: "Active",
              desc: "Profile is live. Users can log in and create transactions.",
            },
            {
              icon: <ToggleLeft className="w-3.5 h-3.5 text-destructive" />,
              status: "Disabled",
              desc: "Profile is suspended. Users see a 'Contact Administrator' message on login.",
            },
            {
              icon: <Calendar className="w-3.5 h-3.5 text-accent-foreground" />,
              status: "Expired",
              desc: "Active Window end-date has passed. Transactions are blocked with a 403 Restricted response.",
            },
            {
              icon: <Archive className="w-3.5 h-3.5 text-muted-foreground" />,
              status: "Archived",
              desc: "Profile has been archived and is read-only.",
            },
          ].map((item) => (
            <div key={item.status} className="flex items-start gap-2.5 mt-3">
              <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {item.status}:{" "}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
          <div className="mt-3 p-3 rounded-md bg-muted/50 border border-border">
            <p className="text-xs font-semibold text-foreground mb-1">
              Storage Calculation
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Storage is estimated by summing the byte-size of all records
              (products, sales, customers, inventory batches, purchase orders)
              associated with the profile, plus any uploaded asset URLs. Each
              record contributes its serialized field sizes to the total.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Row (with extended governance controls) ─────────────────────────

interface ExtendedProfileRowProps {
  profile: ProfileStats | ProfileStatsExtended;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function ExtendedProfileRow({
  profile,
  index,
  isExpanded,
  onToggle,
}: ExtendedProfileRowProps) {
  const enableProfile = useEnableProfile();
  const setProfileWindow = useSetProfileWindow();

  const ext = profile as ProfileStatsExtended;
  const isEnabled = "is_enabled" in ext ? ext.is_enabled : true;
  // start_date/end_date are nanosecond timestamps from backend
  const startDateNs =
    "start_date" in ext && ext.start_date ? ext.start_date : null;
  const endDateNs = "end_date" in ext && ext.end_date ? ext.end_date : null;

  const [startInput, setStartInput] = useState(msToDateInput(startDateNs));
  const [endInput, setEndInput] = useState(msToDateInput(endDateNs));
  const [isSavingWindow, setIsSavingWindow] = useState(false);

  const status = getProfileStatus(profile);
  const statusCfg = STATUS_CONFIG[status];
  const delay = `${index * 0.06}s`;

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await enableProfile.mutateAsync({
        profileKey: profile.profile_key,
        enabled: checked,
      });
      toast.success(
        checked
          ? `Profile "${profile.business_name}" enabled.`
          : `Profile "${profile.business_name}" disabled.`,
      );
    } catch {
      toast.error("Failed to update profile status.");
    }
  };

  const handleSaveWindow = async () => {
    setIsSavingWindow(true);
    try {
      await setProfileWindow.mutateAsync({
        profileKey: profile.profile_key,
        startDate: dateInputToMs(startInput),
        endDate: dateInputToMs(endInput),
      });
      toast.success("Active window saved.");
    } catch {
      toast.error("Failed to save active window.");
    } finally {
      setIsSavingWindow(false);
    }
  };

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
          <div className="hidden md:flex items-center gap-2">
            <Badge
              variant={statusCfg.variant}
              className={`text-xs ${statusCfg.className}`}
            >
              {statusCfg.label}
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
              <Badge
                variant={statusCfg.variant}
                className={`text-xs mt-0.5 ${statusCfg.className}`}
              >
                {statusCfg.label}
              </Badge>
            </div>
            <div className="rounded-md bg-card border border-border px-3 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">
                Last Activity
              </p>
              <p className="text-xs font-medium text-foreground leading-snug">
                {formatRelativeTime(profile.last_activity)}
              </p>
              <p className="text-xs text-muted-foreground leading-snug">
                {formatTimestamp(profile.last_activity)}
              </p>
            </div>
          </div>

          {/* Enable / Disable Toggle */}
          <div className="rounded-md bg-card border border-border px-3 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Profile Access
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEnabled
                  ? "Users can log in and perform transactions."
                  : "Users are blocked. They will see a 'Contact Administrator' message."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground">
                {isEnabled ? "Enabled" : "Disabled"}
              </span>
              <Switch
                checked={isEnabled}
                onCheckedChange={handleToggleEnabled}
                disabled={enableProfile.isPending}
                aria-label={`Toggle profile ${profile.business_name}`}
                data-ocid={`super_admin.profile_enable_toggle.${index + 1}`}
              />
            </div>
          </div>

          {/* Active Window */}
          <div className="rounded-md bg-card border border-border px-3 py-3 space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-foreground">
                Active Window
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Restrict this profile to a specific date range. Transactions
              outside this window are blocked with a 403 Restricted response.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor={`start-date-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  Start Date
                </Label>
                <Input
                  id={`start-date-${index}`}
                  type="date"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="h-8 text-sm"
                  data-ocid={`super_admin.profile_start_date.${index + 1}`}
                />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor={`end-date-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  End Date
                </Label>
                <Input
                  id={`end-date-${index}`}
                  type="date"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="h-8 text-sm"
                  data-ocid={`super_admin.profile_end_date.${index + 1}`}
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleSaveWindow}
              disabled={isSavingWindow}
              className="w-full sm:w-auto"
              data-ocid={`super_admin.profile_save_window.${index + 1}`}
            >
              {isSavingWindow ? "Saving…" : "Save Active Window"}
            </Button>
          </div>

          {/* Owner Info */}
          <div className="rounded-md bg-card border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-1">
              Owner Principal
            </p>
            <p className="text-xs font-mono text-foreground break-all">
              {typeof profile.owner_principal === "string"
                ? profile.owner_principal
                : ((
                    profile.owner_principal as { toText?: () => string }
                  ).toText?.() ?? String(profile.owner_principal))}
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

// ─── Page Header ──────────────────────────────────────────────────────────────

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
            Super Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            {lastRefreshed
              ? `Last updated at ${lastRefreshed}`
              : "App-wide governance and monitoring"}
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function SuperAdminPage({ onNavigate: _ }: SuperAdminPageProps) {
  const { userProfile } = useProfile();
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
    dataUpdatedAt,
  } = useGetSuperAdminStats();
  const {
    data: extProfiles,
    isLoading: extLoading,
    refetch: refetchExt,
  } = useGetAllProfilesForAdmin();
  const initSuperAdmin = useInitSuperAdmin();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const isSuperAdmin =
    userProfile?.role != null &&
    (userProfile.role as unknown as string) === ROLES.SUPER_ADMIN;

  const isLoading = statsLoading || extLoading;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchStats(), refetchExt()]);
    setIsRefreshing(false);
  };

  const handleInitSuperAdmin = async () => {
    try {
      const result = await initSuperAdmin.mutateAsync();
      if (result) {
        toast.success("Super Admin initialized successfully. Please refresh.");
        await Promise.all([refetchStats(), refetchExt()]);
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

  // Merge stats.profiles with extProfiles (extended data takes priority)
  const mergedProfiles = useMemo(() => {
    const base: (ProfileStats | ProfileStatsExtended)[] = stats?.profiles ?? [];
    if (!extProfiles || extProfiles.length === 0) return base;
    // Build a map from extProfiles keyed by profile_key
    const extMap = new Map(extProfiles.map((p) => [p.profile_key, p]));
    // Replace base entries with extended ones where available
    return base.map((p) => extMap.get(p.profile_key) ?? p);
  }, [stats?.profiles, extProfiles]);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return mergedProfiles;
    const q = search.toLowerCase();
    return mergedProfiles.filter(
      (p) =>
        p.business_name.toLowerCase().includes(q) ||
        p.profile_key.toLowerCase().includes(q),
    );
  }, [mergedProfiles, search]);

  // ─── Access Control ──────────────────────────────────────────────────────

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6" data-ocid="super_admin.page">
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

  const activeProfiles = mergedProfiles.filter(
    (p) => getProfileStatus(p) === "active",
  ).length;
  const totalStorageBytes = mergedProfiles.reduce(
    (sum, p) => sum + p.storage_estimate_bytes,
    0n,
  );

  return (
    <div className="space-y-6" data-ocid="super_admin.page">
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
          label="Total Storage"
          value={formatBytes(totalStorageBytes)}
          icon={<HardDrive className="w-5 h-5 text-primary" />}
          sub={`${activeProfiles} active profiles`}
          ocid="super_admin.kpi_storage"
        />
      </div>

      {/* Governance Info */}
      <GovernanceInfoPanel />

      {/* Profiles List */}
      <Card className="card-elevated" data-ocid="super_admin.profiles_card">
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Business Profiles
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {mergedProfiles.length} total
              </Badge>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search profiles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm w-full sm:w-56"
                data-ocid="super_admin.search_input"
              />
            </div>
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
            {filteredProfiles.length === 0 ? (
              <div
                className="py-10 text-center text-muted-foreground text-sm"
                data-ocid="super_admin.profiles_empty_state"
              >
                No profiles match your search.
              </div>
            ) : (
              filteredProfiles.map((profile, idx) => (
                <ExtendedProfileRow
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
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
