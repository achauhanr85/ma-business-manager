/*
 * PAGE: SuperAdminPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Super Admin control center. Provides profile governance (enable/disable/delete),
 *   impersonation, canister cycles info, lead management, and quick links to
 *   the approval page, data inspector, and test suite.
 *
 * ROLE ACCESS:
 *   superAdmin only — enforced by parent router in App.tsx
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ useGetAllProfilesForAdmin() → all business profiles
 *      ├─ useGetAllUsersForAdmin() → all users across all profiles
 *      ├─ useGetSuperAdminStats() → total cycles, per-profile stats
 *      ├─ useGetCanisterCyclesInfo() → detailed canister cycles breakdown
 *      └─ useGetLeads() → leads from the public index page
 *   2. Dashboard KPIs
 *      ├─ Total profiles, total users, active cycles
 *      └─ Pending approvals count (links to ProfileApprovalPage)
 *   3. Profile list
 *      ├─ each profile card: name, key, user count, is_enabled toggle
 *      ├─ Enable/Disable → useEnableProfile.mutateAsync({ profileKey, enabled })
 *      ├─ Delete → AlertDialog → useDeleteProfile.mutateAsync(profileKey)
 *      ├─ "Approve/Reject" (pending profiles) → inline buttons or link to approval page
 *      └─ Side panel: edit profile fields + date window + key rename
 *   4. Impersonation
 *      ├─ role selector (Admin / Staff) per profile
 *      ├─ setImpersonatedProfile(profileKey) + setImpersonationRole(role)
 *      └─ impersonation banner shown in Layout.tsx when active
 *   5. Leads management
 *      ├─ table of all leads from the public marketing page
 *      ├─ WhatsApp contact button → opens wa.me link with pre-filled message
 *      ├─ "Close Lead" → useCloseLead.mutateAsync({ id, profileLink })
 *      │    sends a profile creation link to the closed lead
 *      └─ Delete → useDeleteLead.mutateAsync(id)
 *   6. Quick links
 *      ├─ Profile Approvals → /profile-approvals
 *      ├─ Data Inspector   → /data-inspector
 *      └─ Test Suite        → /tests
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - selectedProfileKey: string | null = null  // profile open in side panel
 *   - sidePanelOpen: boolean = false
 *   - impersonatingRole: ImpersonationRole | null
 *   - helpOpen: boolean = false
 *   - deleteTarget: string | null               // profileKey pending delete
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   none (all data via React Query hooks)
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - handleEnableToggle: enables/disables a profile
 *   - handleDeleteProfile: confirms and deletes a profile
 *   - handleImpersonate: sets impersonation role + profile key
 *   - handleStopImpersonating: clears impersonation state
 *   - handleCloseLead: marks lead as closed with a profile creation link
 *   - handleContactLead: opens WhatsApp with pre-filled intro message
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { HelpPanel } from "@/components/HelpPanel";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import type { ImpersonationRole } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useApproveProfile,
  useAssignUserRole,
  useCloseLead,
  useCreateProfile,
  useDeleteLead,
  useDeleteProfile,
  useEnableProfile,
  useGetAllProfilesForAdmin,
  useGetAllUsersForAdmin,
  useGetCanisterCyclesInfo,
  useGetLeads,
  useGetSuperAdminStats,
  useGetUsersByProfile,
  useInitSuperAdmin,
  useRejectProfile,
  useSetProfileWindow,
  useUpdateProfile,
  useUpdateProfileKey,
} from "@/hooks/useBackend";
import type { LeadPublic } from "@/hooks/useBackend";
import type {
  ProfileStats,
  ProfileStatsExtended,
  UserProfilePublic,
} from "@/types";
import { ROLES } from "@/types";
import { UserRole } from "@/types";
import {
  Activity,
  AlertTriangle,
  Archive,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  HardDrive,
  HelpCircle,
  Info,
  Key,
  Link2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ToggleLeft,
  Trash2,
  UserCog,
  Users,
  Waypoints,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

function principalToText(
  principal: { toText?: () => string } | string,
): string {
  return typeof principal === "string"
    ? principal
    : (principal.toText?.() ?? String(principal));
}

function msToDateInput(ns: number | bigint | null | undefined): string {
  if (!ns) return "";
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

function formatCycles(cycles: bigint | null | undefined): string {
  if (cycles == null) return "—";
  const n = Number(cycles);
  if (n >= 1_000_000_000_000) return `${(n / 1_000_000_000_000).toFixed(2)} T`;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
  return n.toLocaleString();
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
        </div>
      )}
    </div>
  );
}

// ─── Create Profile Modal ─────────────────────────────────────────────────────

interface CreateProfileModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateProfileModal({ open, onClose }: CreateProfileModalProps) {
  const createProfile = useCreateProfile();
  const [form, setForm] = useState({
    business_name: "",
    phone_number: "",
    business_address: "",
    fssai_number: "",
    email: "",
    theme_color: "#16a34a",
    profile_key: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.business_name.trim()) e.business_name = "Business name required";
    if (!form.profile_key.trim()) e.profile_key = "Profile key required";
    else if (!/^[a-z0-9_-]{3,30}$/.test(form.profile_key.trim()))
      e.profile_key = "3–30 chars, lowercase letters, numbers, - or _ only";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    try {
      await createProfile.mutateAsync({
        business_name: form.business_name.trim(),
        phone_number: form.phone_number.trim(),
        business_address: form.business_address.trim(),
        fssai_number: form.fssai_number.trim(),
        email: form.email.trim(),
        logo_url: "",
        receipt_notes: "",
        theme_color: form.theme_color,
        profile_key: form.profile_key.trim(),
        instagram_handle: "",
      });
      toast.success(`Profile "${form.business_name}" created successfully.`);
      onClose();
      setForm({
        business_name: "",
        phone_number: "",
        business_address: "",
        fssai_number: "",
        email: "",
        theme_color: "#16a34a",
        profile_key: "",
      });
    } catch {
      toast.error("Failed to create profile.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md max-h-[90vh] overflow-y-auto"
        data-ocid="super_admin.create_profile.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Create New Profile
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="cp-profile-key">
              Profile Key <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cp-profile-key"
              value={form.profile_key}
              onChange={(e) =>
                handleChange("profile_key", e.target.value.toLowerCase())
              }
              placeholder="e.g. maherb-mumbai"
              className={`font-mono ${errors.profile_key ? "border-destructive" : ""}`}
              data-ocid="super_admin.create_profile.profile_key_input"
            />
            {errors.profile_key && (
              <p className="text-xs text-destructive">{errors.profile_key}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Unique key for this profile. Can be updated later by Super Admin.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-name">
              Business Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cp-name"
              value={form.business_name}
              onChange={(e) => handleChange("business_name", e.target.value)}
              placeholder="MA Herb Distributors"
              className={errors.business_name ? "border-destructive" : ""}
              data-ocid="super_admin.create_profile.business_name_input"
            />
            {errors.business_name && (
              <p className="text-xs text-destructive">{errors.business_name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone">Phone Number</Label>
            <Input
              id="cp-phone"
              type="tel"
              value={form.phone_number}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              placeholder="+91 98765 43210"
              data-ocid="super_admin.create_profile.phone_input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-email">Email</Label>
            <Input
              id="cp-email"
              type="email"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="contact@maherb.in"
              data-ocid="super_admin.create_profile.email_input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-address">Business Address</Label>
            <Input
              id="cp-address"
              value={form.business_address}
              onChange={(e) => handleChange("business_address", e.target.value)}
              placeholder="123 Herb Lane, Mumbai"
              data-ocid="super_admin.create_profile.address_input"
            />
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-ocid="super_admin.create_profile.cancel_button"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createProfile.isPending}
              data-ocid="super_admin.create_profile.submit_button"
            >
              {createProfile.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Creating…
                </span>
              ) : (
                "Create Profile"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Profile Confirmation Dialog ──────────────────────────────────────

interface DeleteProfileDialogProps {
  open: boolean;
  profileName: string;
  profileKey: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isPending: boolean;
}

function DeleteProfileDialog({
  open,
  profileName,
  onClose,
  onConfirm,
  isPending,
}: DeleteProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        data-ocid="super_admin.delete_profile.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-4 h-4" />
            Delete Profile
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  This action is irreversible
                </p>
                <p className="text-sm text-muted-foreground">
                  This will permanently delete the profile{" "}
                  <span className="font-semibold text-foreground">
                    "{profileName}"
                  </span>{" "}
                  and ALL its data — users, products, customers, sales,
                  inventory, and orders. This cannot be undone.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Are you absolutely sure you want to proceed?
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isPending}
            data-ocid="super_admin.delete_profile.cancel_button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
            data-ocid="super_admin.delete_profile.confirm_button"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-destructive-foreground/40 border-t-destructive-foreground rounded-full animate-spin" />
                Deleting…
              </span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Delete Permanently
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Selected Profile Detail Panel ───────────────────────────────────────────

interface SelectedProfilePanelProps {
  profile: ProfileStats | ProfileStatsExtended;
  onClose: () => void;
  onDeleted: () => void;
  onRefresh: () => Promise<void>;
}

interface ProfileEditForm {
  business_name: string;
  phone_number: string;
  business_address: string;
  fssai_number: string;
  email: string;
  logo_url: string;
  theme_color: string;
  receipt_notes: string;
  instagram_handle: string;
  start_date: string;
  end_date: string;
  profile_key_edit: string;
}

function SelectedProfilePanel({
  profile,
  onClose,
  onDeleted,
  onRefresh,
}: SelectedProfilePanelProps) {
  const ext = profile as ProfileStatsExtended;
  const updateProfile = useUpdateProfile();
  const updateProfileKey = useUpdateProfileKey();
  const deleteProfile = useDeleteProfile();
  const setProfileWindow = useSetProfileWindow();
  const { startImpersonation } = useImpersonation();

  const [form, setForm] = useState<ProfileEditForm>({
    business_name: profile.business_name ?? "",
    phone_number: (ext as { phone_number?: string }).phone_number ?? "",
    business_address:
      (ext as { business_address?: string }).business_address ?? "",
    fssai_number: (ext as { fssai_number?: string }).fssai_number ?? "",
    email: (ext as { email?: string }).email ?? "",
    logo_url: (ext as { logo_url?: string }).logo_url ?? "",
    theme_color: (ext as { theme_color?: string }).theme_color ?? "#16a34a",
    receipt_notes: (ext as { receipt_notes?: string }).receipt_notes ?? "",
    instagram_handle:
      (ext as { instagram_handle?: string }).instagram_handle ?? "",
    start_date: msToDateInput(ext.start_date ?? null),
    end_date: msToDateInput(ext.end_date ?? null),
    profile_key_edit: profile.profile_key,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);

  // Reset form when profile changes
  useEffect(() => {
    const extP = profile as ProfileStatsExtended;
    setForm({
      business_name: profile.business_name ?? "",
      phone_number: (extP as { phone_number?: string }).phone_number ?? "",
      business_address:
        (extP as { business_address?: string }).business_address ?? "",
      fssai_number: (extP as { fssai_number?: string }).fssai_number ?? "",
      email: (extP as { email?: string }).email ?? "",
      logo_url: (extP as { logo_url?: string }).logo_url ?? "",
      theme_color: (extP as { theme_color?: string }).theme_color ?? "#16a34a",
      receipt_notes: (extP as { receipt_notes?: string }).receipt_notes ?? "",
      instagram_handle:
        (extP as { instagram_handle?: string }).instagram_handle ?? "",
      start_date: msToDateInput(extP.start_date ?? null),
      end_date: msToDateInput(extP.end_date ?? null),
      profile_key_edit: profile.profile_key,
    });
    setErrors({});
  }, [profile]);

  const setField = (field: keyof ProfileEditForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!form.business_name.trim()) e.business_name = "Business name required";
    if (form.fssai_number && !/^\d{14}$/.test(form.fssai_number.trim()))
      e.fssai_number = "FSSAI must be exactly 14 digits";
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setIsSaving(true);
    try {
      // Pass the SELECTED profile's profile_key in the input so the backend
      // can identify which profile to update. The backend updateProfile reads
      // the input.profile_key when the caller is superAdmin.
      const success = await updateProfile.mutateAsync({
        business_name: form.business_name.trim(),
        phone_number: form.phone_number.trim(),
        business_address: form.business_address.trim(),
        fssai_number: form.fssai_number.trim(),
        email: form.email.trim(),
        logo_url: form.logo_url.trim(),
        theme_color: form.theme_color,
        receipt_notes: form.receipt_notes,
        instagram_handle: form.instagram_handle.trim(),
        profile_key: profile.profile_key,
      });
      // Always attempt to update the active window — backend handles this
      // via setProfileWindow which uses the explicit profileKey parameter
      // (not the caller's stored profile_key), so it works for Super Admin.
      if (form.start_date || form.end_date) {
        await setProfileWindow.mutateAsync({
          profileKey: profile.profile_key,
          startDate: dateInputToMs(form.start_date),
          endDate: dateInputToMs(form.end_date),
        });
      }
      if (success) {
        toast.success("Profile updated successfully.");
        await onRefresh();
      } else {
        toast.error(
          "Profile update rejected. If this persists, try impersonating as Admin for this profile to save business details.",
        );
      }
    } catch {
      toast.error("Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateKey = async () => {
    const newKey = form.profile_key_edit.trim().toLowerCase();
    if (!newKey) {
      setErrors((prev) => ({
        ...prev,
        profile_key_edit: "Key cannot be empty",
      }));
      return;
    }
    if (!/^[a-z0-9_-]{3,30}$/.test(newKey)) {
      setErrors((prev) => ({
        ...prev,
        profile_key_edit: "3–30 chars, lowercase letters, numbers, - or _ only",
      }));
      return;
    }
    if (newKey === profile.profile_key) {
      toast.info("Profile key is unchanged.");
      return;
    }
    setIsUpdatingKey(true);
    try {
      const success = await updateProfileKey.mutateAsync({
        oldKey: profile.profile_key,
        newKey,
      });
      if (success) {
        toast.success(
          `Profile key updated to "${newKey}". All users in this profile must re-login.`,
        );
        await onRefresh();
      } else {
        toast.error("Failed to update profile key.");
      }
    } catch {
      toast.error("Failed to update profile key.");
    } finally {
      setIsUpdatingKey(false);
    }
  };

  const handleDelete = async () => {
    try {
      const success = await deleteProfile.mutateAsync(profile.profile_key);
      if (success) {
        toast.success(`Profile "${profile.business_name}" deleted.`);
        setShowDeleteDialog(false);
        onDeleted();
        await onRefresh();
      } else {
        toast.error("Failed to delete profile.");
      }
    } catch {
      toast.error("Failed to delete profile.");
    }
  };

  const status = getProfileStatus(profile);
  const statusCfg = STATUS_CONFIG[status];

  return (
    <div
      className="flex flex-col h-full"
      data-ocid="super_admin.selected_profile_panel"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Pencil className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {profile.business_name}
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {profile.profile_key}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant={statusCfg.variant}
            className={`text-xs hidden sm:inline-flex ${statusCfg.className}`}
          >
            {statusCfg.label}
          </Badge>
          {/* Quick impersonate as Admin to allow profile edits */}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1 hidden sm:flex"
            onClick={() => {
              startImpersonation(
                profile.profile_key,
                profile.business_name,
                "admin",
              );
              toast.info(
                `Impersonating as Admin for "${profile.business_name}". Go to Profile page to edit details.`,
              );
            }}
            aria-label="Impersonate as Admin to edit profile"
            data-ocid="super_admin.selected_profile.impersonate_admin_button"
          >
            <Waypoints className="w-3 h-3" />
            Edit as Admin
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label="Close panel"
            data-ocid="super_admin.selected_profile.close_button"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {/* Basic Info Section */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Business Information
          </h3>

          <div className="space-y-1.5">
            <Label htmlFor="sp-name">Business Name</Label>
            <Input
              id="sp-name"
              value={form.business_name}
              onChange={(e) => setField("business_name", e.target.value)}
              className={errors.business_name ? "border-destructive" : ""}
              data-ocid="super_admin.selected_profile.business_name_input"
            />
            {errors.business_name && (
              <p className="text-xs text-destructive">{errors.business_name}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-phone">Phone Number</Label>
              <Input
                id="sp-phone"
                type="tel"
                value={form.phone_number}
                onChange={(e) => setField("phone_number", e.target.value)}
                data-ocid="super_admin.selected_profile.phone_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-email">Email</Label>
              <Input
                id="sp-email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                data-ocid="super_admin.selected_profile.email_input"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-address">Business Address</Label>
            <Textarea
              id="sp-address"
              rows={2}
              value={form.business_address}
              onChange={(e) => setField("business_address", e.target.value)}
              className="resize-none text-sm"
              data-ocid="super_admin.selected_profile.address_input"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-fssai">FSSAI Number</Label>
              <Input
                id="sp-fssai"
                value={form.fssai_number}
                onChange={(e) =>
                  setField("fssai_number", e.target.value.replace(/\D/g, ""))
                }
                maxLength={14}
                placeholder="14-digit FSSAI number"
                className={errors.fssai_number ? "border-destructive" : ""}
                data-ocid="super_admin.selected_profile.fssai_input"
              />
              {errors.fssai_number && (
                <p className="text-xs text-destructive">
                  {errors.fssai_number}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-theme">Theme Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  id="sp-theme"
                  type="color"
                  value={form.theme_color}
                  onChange={(e) => setField("theme_color", e.target.value)}
                  className="w-9 h-9 rounded border border-input cursor-pointer flex-shrink-0"
                  data-ocid="super_admin.selected_profile.theme_color_input"
                />
                <Input
                  value={form.theme_color}
                  onChange={(e) => setField("theme_color", e.target.value)}
                  className="font-mono text-sm"
                  placeholder="#16a34a"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sp-logo">Logo URL</Label>
            <Input
              id="sp-logo"
              value={form.logo_url}
              onChange={(e) => setField("logo_url", e.target.value)}
              placeholder="https://…"
              data-ocid="super_admin.selected_profile.logo_url_input"
            />
          </div>
        </section>

        {/* Active Window */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Active Window
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sp-start">Start Date</Label>
              <Input
                id="sp-start"
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
                data-ocid="super_admin.selected_profile.start_date_input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sp-end">End Date</Label>
              <Input
                id="sp-end"
                type="date"
                value={form.end_date}
                onChange={(e) => setField("end_date", e.target.value)}
                data-ocid="super_admin.selected_profile.end_date_input"
              />
            </div>
          </div>
        </section>

        {/* Receipt Notes */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Receipt Notes
          </h3>
          <Textarea
            rows={3}
            value={form.receipt_notes}
            onChange={(e) => setField("receipt_notes", e.target.value)}
            placeholder="Notes shown in the customer section of every receipt PDF…"
            className="resize-y text-sm"
            data-ocid="super_admin.selected_profile.receipt_notes_input"
          />
          <p className="text-xs text-muted-foreground">
            This text appears in the customer information section of every
            receipt PDF for this profile.
          </p>
        </section>

        {/* Save Changes Button */}
        <Button
          className="w-full"
          onClick={handleSave}
          disabled={isSaving || updateProfile.isPending}
          data-ocid="super_admin.selected_profile.save_button"
        >
          {isSaving || updateProfile.isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              Saving…
            </span>
          ) : (
            "Save Changes"
          )}
        </Button>

        {/* Profile Key Section */}
        <section className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Profile Key
            </h3>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 dark:bg-amber-950/20 dark:border-amber-800/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 dark:text-amber-400" />
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Changing the profile key will disconnect all existing users from
                this profile. They will need to rejoin using the new key.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-profile-key">Profile Key</Label>
            <Input
              id="sp-profile-key"
              value={form.profile_key_edit}
              onChange={(e) =>
                setField("profile_key_edit", e.target.value.toLowerCase())
              }
              className={`font-mono ${errors.profile_key_edit ? "border-destructive" : ""}`}
              data-ocid="super_admin.selected_profile.profile_key_input"
            />
            {errors.profile_key_edit && (
              <p className="text-xs text-destructive">
                {errors.profile_key_edit}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleUpdateKey}
            disabled={isUpdatingKey || updateProfileKey.isPending}
            data-ocid="super_admin.selected_profile.update_key_button"
          >
            {isUpdatingKey || updateProfileKey.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
                Updating Key…
              </span>
            ) : (
              <>
                <Key className="w-3.5 h-3.5 mr-1.5" />
                Update Profile Key
              </>
            )}
          </Button>
        </section>

        {/* Danger Zone */}
        <section className="space-y-3 pt-2 border-t border-destructive/20">
          <h3 className="text-xs font-semibold text-destructive uppercase tracking-wide">
            Danger Zone
          </h3>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Delete This Profile
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently removes the profile and all its data.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="flex-shrink-0"
              onClick={() => setShowDeleteDialog(true)}
              data-ocid="super_admin.selected_profile.delete_button"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </section>
      </div>

      {/* Delete Confirmation Dialog */}
      <DeleteProfileDialog
        open={showDeleteDialog}
        profileName={profile.business_name}
        profileKey={profile.profile_key}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        isPending={deleteProfile.isPending}
      />
    </div>
  );
}

// ─── Profile Users Panel ──────────────────────────────────────────────────────

interface ProfileUsersPanelProps {
  profileKey: string;
  index: number;
}

function ProfileUsersPanel({ profileKey, index }: ProfileUsersPanelProps) {
  const { data: users = [], isLoading } = useGetUsersByProfile(profileKey);
  const assignRole = useAssignUserRole();

  const handleRoleChange = async (
    userId: import("../backend").UserId,
    role: string,
  ) => {
    const roleMap: Record<string, UserRole> = {
      admin: UserRole.admin,
      staff: UserRole.staff,
      superAdmin: UserRole.superAdmin,
    };
    const backendRole = roleMap[role];
    if (!backendRole) return;
    try {
      await assignRole.mutateAsync({
        targetUserId: userId,
        newRole: backendRole,
        profileKey,
      });
      toast.success("Role updated.");
    } catch {
      toast.error("Failed to update role.");
    }
  };

  if (isLoading) {
    return (
      <div
        className="space-y-2 py-2"
        data-ocid={`super_admin.profile_users.loading_state.${index}`}
      >
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div
        className="py-4 text-center text-sm text-muted-foreground"
        data-ocid={`super_admin.profile_users.empty_state.${index}`}
      >
        No users in this profile yet.
      </div>
    );
  }

  return (
    <div
      className="space-y-1.5"
      data-ocid={`super_admin.profile_users_list.${index}`}
    >
      {(users as UserProfilePublic[]).map((user, uIdx) => {
        const userId = user.principal;
        const displayName = user.display_name ?? "—";
        const rawRole = String(user.role);
        const displayRole = rawRole === "subAdmin" ? "staff" : rawRole;
        const warehouse = user.warehouse_name ?? "—";
        const itemKey = `${String(userId)}-${uIdx}`;
        return (
          <div
            key={itemKey}
            className="flex items-center gap-3 px-3 py-2 rounded-md bg-card border border-border"
            data-ocid={`super_admin.profile_user.item.${uIdx + 1}`}
          >
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-xs font-semibold text-secondary-foreground uppercase">
              {displayName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {warehouse}
              </p>
            </div>
            <Select
              value={displayRole}
              onValueChange={(v) => handleRoleChange(userId, v)}
              disabled={assignRole.isPending}
            >
              <SelectTrigger
                className="h-7 text-xs w-28 flex-shrink-0"
                data-ocid={`super_admin.profile_user.role_select.${uIdx + 1}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin" className="text-xs">
                  Admin
                </SelectItem>
                <SelectItem value="staff" className="text-xs">
                  Staff
                </SelectItem>
                <SelectItem value="superAdmin" className="text-xs">
                  Super Admin
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

// ─── Profile Row (compact list item) ─────────────────────────────────────────

interface ProfileListRowProps {
  profile: ProfileStats | ProfileStatsExtended;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function ProfileListRow({
  profile,
  index,
  isSelected,
  onSelect,
  isExpanded,
  onToggleExpand,
}: ProfileListRowProps) {
  const enableProfile = useEnableProfile();
  const setProfileWindow = useSetProfileWindow();
  const { startImpersonation } = useImpersonation();

  const ext = profile as ProfileStatsExtended;
  const isEnabled = "is_enabled" in ext ? ext.is_enabled : true;
  const startDateNs =
    "start_date" in ext && ext.start_date ? ext.start_date : null;
  const endDateNs = "end_date" in ext && ext.end_date ? ext.end_date : null;

  const [startInput, setStartInput] = useState(msToDateInput(startDateNs));
  const [endInput, setEndInput] = useState(msToDateInput(endDateNs));
  const [isSavingWindow, setIsSavingWindow] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [impersonatePopoverOpen, setImpersonatePopoverOpen] = useState(false);

  const status = getProfileStatus(profile);
  const statusCfg = STATUS_CONFIG[status];

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

  const handleImpersonateAs =
    (role: ImpersonationRole) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setImpersonatePopoverOpen(false);
      startImpersonation(profile.profile_key, profile.business_name, role);
      toast.success(
        `Now viewing as ${role === "admin" ? "Admin" : "Staff"} for "${profile.business_name}". Use the banner to exit.`,
      );
    };

  return (
    <div
      className={`stagger-item border rounded-lg overflow-hidden transition-colors duration-150 ${
        isSelected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card hover:border-primary/40"
      }`}
      data-ocid={`super_admin.profile_row.${index + 1}`}
    >
      {/* Summary Row — click to SELECT */}
      <button
        type="button"
        className="w-full text-left px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={onSelect}
        aria-pressed={isSelected}
        data-ocid={`super_admin.profile_select.${index + 1}`}
      >
        {/* Icon */}
        <div
          className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${
            isSelected ? "bg-primary/20" : "bg-secondary"
          }`}
        >
          <Building2
            className={`w-4 h-4 ${isSelected ? "text-primary" : "text-secondary-foreground"}`}
          />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 items-center">
          <div className="col-span-2 md:col-span-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {profile.business_name}
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {profile.profile_key}
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

        {/* Action buttons + Expand toggle — stopPropagation handled per element */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Impersonate — role selector popover */}
          <Popover
            open={impersonatePopoverOpen}
            onOpenChange={setImpersonatePopoverOpen}
          >
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 hidden sm:flex"
                onClick={(e) => e.stopPropagation()}
                data-ocid={`super_admin.profile_impersonate.${index + 1}`}
              >
                <Waypoints className="w-3 h-3" />
                View As
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-44 p-2"
              align="end"
              onClick={(e) => e.stopPropagation()}
              data-ocid={`super_admin.profile_impersonate_popover.${index + 1}`}
            >
              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">
                Impersonate as…
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 gap-2"
                onClick={handleImpersonateAs("admin")}
                data-ocid={`super_admin.profile_impersonate_admin.${index + 1}`}
              >
                <Shield className="w-3 h-3 text-primary" />
                Admin
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8 gap-2"
                onClick={handleImpersonateAs("staff")}
                data-ocid={`super_admin.profile_impersonate_staff.${index + 1}`}
              >
                <UserCog className="w-3 h-3 text-muted-foreground" />
                Staff
              </Button>
            </PopoverContent>
          </Popover>

          <span
            role="presentation"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onToggleExpand();
              }
            }}
            className="p-1.5 rounded hover:bg-muted transition-colors"
            aria-label="Toggle governance details"
            data-ocid={`super_admin.profile_toggle.${index + 1}`}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </span>
        </div>
      </button>

      {/* Mobile impersonate — role picker */}
      <div className="sm:hidden px-4 pb-2 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs gap-1.5"
          onClick={handleImpersonateAs("admin")}
          data-ocid={`super_admin.profile_impersonate_admin_mobile.${index + 1}`}
        >
          <Shield className="w-3 h-3" />
          Admin View
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs gap-1.5"
          onClick={handleImpersonateAs("staff")}
          data-ocid={`super_admin.profile_impersonate_staff_mobile.${index + 1}`}
        >
          <Waypoints className="w-3 h-3" />
          Staff View
        </Button>
      </div>

      {/* Expanded Governance Panel */}
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
              Restrict this profile to a specific date range.
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

          {/* Users Sub-section */}
          <div className="rounded-md bg-card border border-border px-3 py-3 space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-between"
              onClick={() => setShowUsers((v) => !v)}
              data-ocid={`super_admin.profile_users_toggle.${index + 1}`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium text-foreground">
                  Profile Users
                </p>
              </div>
              {showUsers ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {showUsers && (
              <ProfileUsersPanel
                profileKey={profile.profile_key}
                index={index}
              />
            )}
          </div>

          {/* Owner Info */}
          <div className="rounded-md bg-card border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-1">
              Owner Principal
            </p>
            <p className="text-xs font-mono text-foreground break-all">
              {principalToText(profile.owner_principal)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pending Profile Approval Section ────────────────────────────────────────

interface PendingProfileApprovalSectionProps {
  profiles: (ProfileStats | ProfileStatsExtended)[];
  onRefresh: () => Promise<void>;
  onNavigateApprovals: () => void;
}

/**
 * PendingProfileApprovalSection — dashboard card showing profiles that need approval.
 *
 * FILTER: Profiles with profile_approval_status === "pending_super_admin_approval"
 * (the Motoko variant #pending_super_admin_approval serializes to this string).
 * DO NOT use is_enabled === false — that is a separate field used for enable/disable,
 * not for tracking initial approval state.
 *
 * APPROVE ACTION: calls useApproveProfile → actor.approveProfile(profileKey)
 * Sets approval_status to #approved on the backend. The Admin can then log in.
 *
 * REJECT ACTION: calls useRejectProfile → actor.rejectProfile(profileKey)
 * Sets approval_status to #suspended. Profile record is preserved for audit purposes.
 * DO NOT use deleteProfile for rejection — that destroys all data permanently.
 */
function PendingProfileApprovalSection({
  profiles,
  onRefresh,
  onNavigateApprovals,
}: PendingProfileApprovalSectionProps) {
  // Use the correct dedicated hooks for approval and rejection
  const approveProfile = useApproveProfile();
  const rejectProfile = useRejectProfile();
  const [approvingKey, setApprovingKey] = useState<string | null>(null);
  const [rejectingKey, setRejectingKey] = useState<string | null>(null);

  // Filter to profiles with the correct pending approval status.
  // The backend Motoko variant #pending_super_admin_approval serializes to
  // "pending_super_admin_approval" as a string when returned via Candid.
  const pendingProfiles = profiles.filter((p) => {
    const ext = p as ProfileStatsExtended & {
      profile_approval_status?: string;
    };
    return (
      ext.profile_approval_status === "pending_super_admin_approval" ||
      // Also catch the shorter "pending" status for backward compatibility
      ext.profile_approval_status === "pending"
    );
  });

  if (pendingProfiles.length === 0) return null;

  const handleApprove = async (
    profile: ProfileStats | ProfileStatsExtended,
  ) => {
    setApprovingKey(profile.profile_key);
    try {
      // approveProfile sets approval_status to #approved — correct backend function
      const ok = await approveProfile.mutateAsync(profile.profile_key);
      if (ok) {
        toast.success(
          `Profile "${profile.business_name}" approved. The Admin can now log in.`,
        );
        await onRefresh();
      } else {
        toast.error("Failed to approve profile.");
      }
    } catch {
      toast.error(
        "Failed to approve profile. approveProfile may not be deployed yet.",
      );
    } finally {
      setApprovingKey(null);
    }
  };

  const handleReject = async (profile: ProfileStats | ProfileStatsExtended) => {
    setRejectingKey(profile.profile_key);
    try {
      // rejectProfile sets approval_status to #suspended — NOT deleteProfile
      const ok = await rejectProfile.mutateAsync(profile.profile_key);
      if (ok) {
        toast.success(
          `Profile "${profile.business_name}" rejected. Creator has been notified.`,
        );
        await onRefresh();
      } else {
        toast.error("Failed to reject profile.");
      }
    } catch {
      toast.error(
        "Failed to reject profile. rejectProfile may not be deployed yet.",
      );
    } finally {
      setRejectingKey(null);
    }
  };

  return (
    <Card
      className="card-elevated border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800/30"
      data-ocid="super_admin.pending_approvals_card"
    >
      <CardHeader className="pb-3 border-b border-amber-200/50 dark:border-amber-800/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground">
              Pending Profile Approvals
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pendingProfiles.length} new profile
              {pendingProfiles.length !== 1 ? "s" : ""} awaiting approval
            </p>
          </div>
          <Badge className="ml-auto text-xs bg-amber-500/15 text-amber-700 border-amber-400/30 dark:text-amber-400">
            {pendingProfiles.length} pending
          </Badge>
        </div>
        {/* Link to the dedicated Profile Approvals page */}
        <button
          type="button"
          onClick={onNavigateApprovals}
          className="text-xs text-primary hover:underline mt-1 text-left"
          data-ocid="super_admin.view_all_approvals_link"
        >
          View all approvals →
        </button>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {pendingProfiles.map((profile, idx) => {
          const ext = profile as ProfileStatsExtended;
          const isApproving = approvingKey === profile.profile_key;
          const isRejecting = rejectingKey === profile.profile_key;
          return (
            <div
              key={profile.profile_key}
              className="flex items-center gap-3 p-3 rounded-lg border border-amber-200/60 bg-card dark:border-amber-800/30"
              data-ocid={`super_admin.pending_profile.item.${idx + 1}`}
            >
              <div className="w-9 h-9 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {profile.business_name}
                </p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {profile.profile_key}
                </p>
                {(ext as { email?: string }).email && (
                  <p className="text-xs text-muted-foreground truncate">
                    {(ext as { email?: string }).email}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={() => handleReject(profile)}
                  disabled={isRejecting || isApproving}
                  data-ocid={`super_admin.pending_profile.reject_button.${idx + 1}`}
                >
                  {isRejecting ? (
                    <span className="w-3 h-3 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin" />
                  ) : (
                    <XCircle className="w-3 h-3" />
                  )}
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => handleApprove(profile)}
                  disabled={isApproving || isRejecting}
                  data-ocid={`super_admin.pending_profile.approve_button.${idx + 1}`}
                >
                  {isApproving ? (
                    <span className="w-3 h-3 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Leads Panel ──────────────────────────────────────────────────────────────

interface SendLinkModalProps {
  lead: LeadPublic;
  open: boolean;
  onClose: () => void;
}

function SendLinkModal({ lead, open, onClose }: SendLinkModalProps) {
  const closeLead = useCloseLead();
  const [profileLink, setProfileLink] = useState("");
  const [error, setError] = useState("");

  const handleSend = async () => {
    if (!profileLink.trim()) {
      setError("Please enter a profile creation link.");
      return;
    }
    try {
      await closeLead.mutateAsync({
        id: lead.id,
        profileLink: profileLink.trim(),
      });
      toast.success(
        `Profile link sent and lead "${lead.name}" marked as closed.`,
      );
      setProfileLink("");
      setError("");
      onClose();
    } catch {
      toast.error("Failed to close lead.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md" data-ocid="leads.send_link.dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Send Profile Creation Link
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm">
            <p className="font-medium text-foreground">{lead.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lead.business_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {lead.phone} · {lead.email}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-link">Profile Creation Link</Label>
            <Input
              id="profile-link"
              value={profileLink}
              onChange={(e) => {
                setProfileLink(e.target.value);
                setError("");
              }}
              placeholder="https://your-app.ic0.app/onboarding?key=…"
              className={error ? "border-destructive" : ""}
              data-ocid="leads.send_link.link_input"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <p className="text-xs text-muted-foreground">
              This link will be stored against the lead and the lead will be
              marked as closed.
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            data-ocid="leads.send_link.cancel_button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={closeLead.isPending}
            data-ocid="leads.send_link.confirm_button"
          >
            {closeLead.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                Sending…
              </span>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                Send Link & Close Lead
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeadsPanel() {
  const { data: leads = [], isLoading } = useGetLeads();
  const deleteLead = useDeleteLead();
  const [sendLinkTarget, setSendLinkTarget] = useState<LeadPublic | null>(null);
  const [deletingId, setDeletingId] = useState<bigint | null>(null);
  const [filterClosed, setFilterClosed] = useState<"all" | "open" | "closed">(
    "open",
  );

  const filtered = useMemo(() => {
    if (filterClosed === "open") return leads.filter((l) => !l.is_closed);
    if (filterClosed === "closed") return leads.filter((l) => l.is_closed);
    return leads;
  }, [leads, filterClosed]);

  const handleDelete = async (lead: LeadPublic) => {
    setDeletingId(lead.id);
    try {
      await deleteLead.mutateAsync(lead.id);
      toast.success(`Lead "${lead.name}" deleted.`);
    } catch {
      toast.error("Failed to delete lead.");
    } finally {
      setDeletingId(null);
    }
  };

  const buildWhatsAppUrl = (lead: LeadPublic) => {
    const phone = lead.phone.replace(/\D/g, "");
    const msg = encodeURIComponent(
      `Hi ${lead.name}, thank you for your interest in Indi Negocio Livre! We'd love to set up a demo for ${lead.business_name}. Please reach out so we can get started.`,
    );
    return `https://wa.me/${phone}?text=${msg}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3" data-ocid="leads.loading_state">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div
        className="flex gap-1 p-1 rounded-lg bg-muted w-fit"
        data-ocid="leads.filter.tab"
      >
        {(["open", "closed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilterClosed(f)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
              filterClosed === f
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            data-ocid={`leads.filter_${f}.tab`}
          >
            {f === "open"
              ? `Open (${leads.filter((l) => !l.is_closed).length})`
              : f === "closed"
                ? `Closed (${leads.filter((l) => l.is_closed).length})`
                : `All (${leads.length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div
          className="py-14 flex flex-col items-center gap-3 text-center"
          data-ocid="leads.empty_state"
        >
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No leads yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {filterClosed === "open"
              ? "No open leads. All leads have been closed."
              : "No leads have been submitted via the public index page."}
          </p>
        </div>
      ) : (
        <div className="space-y-3" data-ocid="leads.list">
          {filtered.map((lead, idx) => (
            <div
              key={lead.id.toString()}
              className={`rounded-lg border p-4 ${lead.is_closed ? "bg-muted/20 border-border/50" : "bg-card border-border"}`}
              data-ocid={`leads.item.${idx + 1}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-primary uppercase">
                  {lead.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">
                      {lead.name}
                    </p>
                    {lead.is_closed && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-700 dark:text-green-400 border border-green-500/20 font-medium">
                        Closed
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-primary truncate">
                    {lead.business_name}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    <span className="text-xs text-muted-foreground">
                      {lead.phone}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {lead.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(
                        Number(lead.created_at) / 1_000_000,
                      ).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {lead.message && (
                    <p className="text-xs text-muted-foreground italic line-clamp-2 mt-1">
                      "{lead.message}"
                    </p>
                  )}
                  {lead.profile_link && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Link2 className="w-3 h-3 text-primary flex-shrink-0" />
                      <a
                        href={lead.profile_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline truncate"
                      >
                        {lead.profile_link}
                      </a>
                      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                  {/* WhatsApp */}
                  <a
                    href={buildWhatsAppUrl(lead)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium border border-green-500/40 text-green-700 dark:text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors"
                    data-ocid={`leads.whatsapp_button.${idx + 1}`}
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span className="hidden sm:inline">WhatsApp</span>
                  </a>
                  {/* Send Link */}
                  {!lead.is_closed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setSendLinkTarget(lead)}
                      data-ocid={`leads.send_link_button.${idx + 1}`}
                    >
                      <Link2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Send Link</span>
                    </Button>
                  )}
                  {/* Delete */}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(lead)}
                    disabled={deletingId === lead.id}
                    aria-label="Delete lead"
                    data-ocid={`leads.delete_button.${idx + 1}`}
                  >
                    {deletingId === lead.id ? (
                      <span className="w-3 h-3 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sendLinkTarget && (
        <SendLinkModal
          lead={sendLinkTarget}
          open={!!sendLinkTarget}
          onClose={() => setSendLinkTarget(null)}
        />
      )}
    </div>
  );
}

// ─── All Users Panel ──────────────────────────────────────────────────────────

function AllUsersPanel() {
  const { data: allUsers = [], isLoading } = useGetAllUsersForAdmin();
  const assignRole = useAssignUserRole();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return allUsers as UserProfilePublic[];
    const q = search.toLowerCase();
    return (allUsers as UserProfilePublic[]).filter((u) => {
      return (
        (u.display_name ?? "").toLowerCase().includes(q) ||
        (u.profile_key ?? "").toLowerCase().includes(q) ||
        String(u.role).toLowerCase().includes(q)
      );
    });
  }, [allUsers, search]);

  const handleRoleChange = async (user: UserProfilePublic, role: string) => {
    const roleMap: Record<string, UserRole> = {
      admin: UserRole.admin,
      staff: UserRole.staff,
      superAdmin: UserRole.superAdmin,
    };
    const backendRole = roleMap[role];
    if (!backendRole) return;
    try {
      await assignRole.mutateAsync({
        targetUserId: user.principal,
        newRole: backendRole,
        profileKey: user.profile_key,
      });
      toast.success("Role updated.");
    } catch {
      toast.error("Failed to update role.");
    }
  };

  if (isLoading) {
    return (
      <div
        className="space-y-3"
        data-ocid="super_admin.all_users.loading_state"
      >
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder="Search users by name, profile, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
          data-ocid="super_admin.all_users.search_input"
        />
      </div>

      {filtered.length === 0 ? (
        <div
          className="py-10 text-center text-muted-foreground text-sm"
          data-ocid="super_admin.all_users.empty_state"
        >
          {allUsers.length === 0
            ? "No users registered yet."
            : "No users match your search."}
        </div>
      ) : (
        <div className="space-y-2" data-ocid="super_admin.all_users.list">
          {filtered.map((user, idx) => {
            const displayName = user.display_name ?? "—";
            const rawRole = String(user.role);
            const displayRole = rawRole === "subAdmin" ? "staff" : rawRole;
            const warehouse = user.warehouse_name ?? "—";
            const profileKey = user.profile_key ?? "—";
            const rowKey = `${String(user.principal)}-${profileKey}-${idx}`;
            return (
              <div
                key={rowKey}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
                data-ocid={`super_admin.all_users.item.${idx + 1}`}
              >
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-xs font-semibold text-secondary-foreground uppercase">
                  {displayName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {displayName}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono">
                      {profileKey}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {warehouse}
                    </span>
                  </div>
                </div>
                <Select
                  value={displayRole}
                  onValueChange={(v) => handleRoleChange(user, v)}
                  disabled={assignRole.isPending}
                >
                  <SelectTrigger
                    className="h-7 text-xs w-28 flex-shrink-0"
                    data-ocid={`super_admin.all_users.role_select.${idx + 1}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin" className="text-xs">
                      Admin
                    </SelectItem>
                    <SelectItem value="staff" className="text-xs">
                      Staff
                    </SelectItem>
                    <SelectItem value="superAdmin" className="text-xs">
                      Super Admin
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
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
  onCreateProfile: () => void;
  onHelp: () => void;
  onNavigateTests: () => void;
}

function PageHeader({
  lastRefreshed,
  isRefreshing,
  onRefresh,
  onCreateProfile,
  onHelp,
  onNavigateTests,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onCreateProfile}
            className="flex items-center gap-1.5"
            data-ocid="super_admin.create_profile_button"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Profile</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5"
            data-ocid="super_admin.refresh_button"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onHelp}
            aria-label="Open help"
            data-ocid="super_admin.help_button"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Regression Tests shortcut */}
      <button
        type="button"
        onClick={onNavigateTests}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
        data-ocid="super_admin.run_tests_button"
      >
        <div className="w-8 h-8 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Activity className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Run Regression Tests
          </p>
          <p className="text-xs text-muted-foreground">
            Automated QA suite — validate all modules against the master
            checklist
          </p>
        </div>
        <span className="text-xs font-medium text-primary flex-shrink-0">
          Open →
        </span>
      </button>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

type ActiveTab = "profiles" | "users" | "leads";

export function SuperAdminPage({ onNavigate }: SuperAdminPageProps) {
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
  const { data: cyclesInfo } = useGetCanisterCyclesInfo();

  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ActiveTab>("profiles");
  const [showCreateProfile, setShowCreateProfile] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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

  const mergedProfiles = useMemo(() => {
    const base: (ProfileStats | ProfileStatsExtended)[] = stats?.profiles ?? [];
    if (!extProfiles || extProfiles.length === 0) return base;
    const extMap = new Map(extProfiles.map((p) => [p.profile_key, p]));
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

  const selectedProfile = useMemo(
    () =>
      selectedKey
        ? (mergedProfiles.find((p) => p.profile_key === selectedKey) ?? null)
        : null,
    [mergedProfiles, selectedKey],
  );

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
                This area is reserved for the Super Admin.
              </p>
            </div>

            {!isLoading && (!stats || stats.total_profiles === 0n) && (
              <div className="mt-2 p-4 rounded-lg bg-muted/50 border border-border text-left w-full max-w-sm">
                <div className="flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    No Super Admin has been set. If you are the first
                    administrator, you can claim this role.
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
          onCreateProfile={() => setShowCreateProfile(true)}
          onHelp={() => setHelpOpen(true)}
          onNavigateTests={() => onNavigate("/admin/tests")}
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
          onCreateProfile={() => setShowCreateProfile(true)}
          onHelp={() => setHelpOpen(true)}
          onNavigateTests={() => onNavigate("/admin/tests")}
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
                No business profiles have been created. Click "New Profile" to
                create the first one.
              </p>
            </div>
            <Button
              onClick={() => setShowCreateProfile(true)}
              data-ocid="super_admin.empty.create_profile_button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Profile
            </Button>
          </CardContent>
        </Card>
        <CreateProfileModal
          open={showCreateProfile}
          onClose={() => setShowCreateProfile(false)}
        />
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
        onCreateProfile={() => setShowCreateProfile(true)}
        onHelp={() => setHelpOpen(true)}
        onNavigateTests={() => onNavigate("/admin/tests")}
      />

      {/* KPI Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
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
        <KpiCard
          label="Canister Cycles"
          value={cyclesInfo ? formatCycles(cyclesInfo.total_cycles) : "—"}
          icon={<Zap className="w-5 h-5 text-primary" />}
          sub={cyclesInfo ? "Total available cycles" : "Loading…"}
          ocid="super_admin.kpi_cycles"
        />
      </div>

      {/* Per-profile cycles breakdown */}
      {cyclesInfo && cyclesInfo.per_profile_info.length > 0 && (
        <Card className="card-elevated" data-ocid="super_admin.cycles_card">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Cycles Usage by Profile
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      Profile
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      Profile Key
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                      Cycles Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cyclesInfo.per_profile_info.map((info, idx) => (
                    <tr
                      key={info.profile_key}
                      className={`border-b border-border/50 ${idx % 2 === 0 ? "" : "bg-muted/20"}`}
                      data-ocid={`super_admin.cycles_row.${idx + 1}`}
                    >
                      <td className="py-2 px-3 font-medium text-foreground">
                        {info.business_name}
                      </td>
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                        {info.profile_key}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">
                        {info.cycles_note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Governance Info */}
      <GovernanceInfoPanel />

      {/* Pending Profile Approvals — shown only when pending profiles exist */}
      <PendingProfileApprovalSection
        profiles={mergedProfiles}
        onRefresh={handleRefresh}
        onNavigateApprovals={() => onNavigate("/profile-approvals")}
      />

      {/* Tab Switcher */}
      <div
        className="flex gap-1 p-1 rounded-lg bg-muted w-full sm:w-auto"
        data-ocid="super_admin.tab_list"
      >
        <button
          type="button"
          onClick={() => setActiveTab("profiles")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "profiles"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="super_admin.profiles.tab"
        >
          <Building2 className="w-3.5 h-3.5" />
          Profiles
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "users"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="super_admin.users.tab"
        >
          <UserCog className="w-3.5 h-3.5" />
          User Management
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("leads")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "leads"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          data-ocid="super_admin.leads.tab"
        >
          <Users className="w-3.5 h-3.5" />
          Leads
        </button>
      </div>

      {/* Profiles Tab — Split Panel Layout */}
      {activeTab === "profiles" && (
        <div
          className={`flex gap-4 ${selectedProfile ? "flex-col lg:flex-row lg:items-start" : ""}`}
          data-ocid="super_admin.profiles_section"
        >
          {/* Profile List Panel */}
          <Card
            className={`card-elevated ${selectedProfile ? "lg:w-2/5 xl:w-1/3" : "w-full"}`}
            data-ocid="super_admin.profiles_card"
          >
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
              {selectedProfile && (
                <p className="text-xs text-primary mt-1">
                  Click a profile row to view/edit details →
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-4">
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
                    <ProfileListRow
                      key={profile.profile_key}
                      profile={profile}
                      index={idx}
                      isSelected={selectedKey === profile.profile_key}
                      onSelect={() =>
                        setSelectedKey(
                          selectedKey === profile.profile_key
                            ? null
                            : profile.profile_key,
                        )
                      }
                      isExpanded={expandedKey === profile.profile_key}
                      onToggleExpand={() =>
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

          {/* Selected Profile Detail Panel */}
          {selectedProfile && (
            <Card
              className="card-elevated lg:flex-1 lg:sticky lg:top-4"
              data-ocid="super_admin.selected_profile_card"
            >
              <SelectedProfilePanel
                profile={selectedProfile}
                onClose={() => setSelectedKey(null)}
                onDeleted={() => setSelectedKey(null)}
                onRefresh={handleRefresh}
              />
            </Card>
          )}
        </div>
      )}

      {/* User Management Tab */}
      {activeTab === "users" && (
        <Card className="card-elevated" data-ocid="super_admin.users_card">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                All Users
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                Across all profiles
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <AllUsersPanel />
          </CardContent>
        </Card>
      )}

      {/* Leads Tab */}
      {activeTab === "leads" && (
        <Card className="card-elevated" data-ocid="super_admin.leads_card">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Demo Leads
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                From public index page
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Leads who requested a demo. Contact via WhatsApp or send a profile
              creation link to close the lead.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <LeadsPanel />
          </CardContent>
        </Card>
      )}

      {/* Create Profile Modal */}
      <CreateProfileModal
        open={showCreateProfile}
        onClose={() => setShowCreateProfile(false)}
      />

      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPage="superAdmin"
      />
    </div>
  );
}
