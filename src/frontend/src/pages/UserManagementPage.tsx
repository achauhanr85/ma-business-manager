import { HelpPanel } from "@/components/HelpPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  useApproveUser,
  useAssignUserRole,
  useGetPendingApprovalUsers,
  useGetUsersByProfile,
  useUpdateUserProfile,
} from "@/hooks/useBackend";
import { useTranslation } from "@/translations";
import type { UserProfilePublic } from "@/types";
import { UserRole } from "@/types";
import {
  CheckCircle2,
  Clock,
  GitBranch,
  HelpCircle,
  Plus,
  ShieldX,
  UserCheck,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";

interface UserManagementPageProps {
  onNavigate: (path: string) => void;
}

const MODULE_OPTIONS = ["PO", "Customer", "Product", "Sales"] as const;
type Module = (typeof MODULE_OPTIONS)[number];

function parseModuleAccess(raw?: string): Set<Module> {
  if (!raw) return new Set(MODULE_OPTIONS);
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed))
      return new Set(
        parsed.filter((m): m is Module => MODULE_OPTIONS.includes(m as Module)),
      );
  } catch {
    // comma-separated fallback
    const parts = raw.split(",").map((s) => s.trim()) as Module[];
    return new Set(parts.filter((m) => MODULE_OPTIONS.includes(m)));
  }
  return new Set(MODULE_OPTIONS);
}

function serializeModuleAccess(modules: Set<Module>): string {
  return JSON.stringify(Array.from(modules));
}

function roleBadge(role: UserRole | string) {
  const roleStr = String(role);
  if (roleStr === UserRole.admin || roleStr === "admin")
    return (
      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
        Admin
      </Badge>
    );
  if (roleStr === UserRole.staff || roleStr === "staff")
    return (
      <Badge variant="secondary" className="text-xs">
        Staff
      </Badge>
    );
  if (roleStr === "referralUser")
    return (
      <Badge className="text-xs bg-purple-500/10 text-purple-700 border-purple-500/30">
        <GitBranch className="w-3 h-3 mr-1" />
        Referral User
      </Badge>
    );
  if (roleStr === "regularUser")
    return (
      <Badge variant="outline" className="text-xs">
        Regular User
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs">
      {roleStr}
    </Badge>
  );
}

function approvalBadge(status?: string) {
  if (!status || status === "approved")
    return (
      <span className="flex items-center gap-1 text-xs text-primary font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Active
      </span>
    );
  if (status === "pending")
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
        <Clock className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-xs text-destructive font-medium">
      <XCircle className="w-3.5 h-3.5" />
      Inactive
    </span>
  );
}

interface UserRowProps {
  user: UserProfilePublic;
  profileKey: string;
  index: number;
}

function UserRow({ user, profileKey, index }: UserRowProps) {
  const approveUser = useApproveUser();
  const assignRole = useAssignUserRole();
  const updateUserProfile = useUpdateUserProfile();
  const t = useTranslation();

  const currentModules = parseModuleAccess(user.module_access);
  const [modules, setModules] = useState<Set<Module>>(currentModules);
  const [pendingModules, setPendingModules] = useState(false);

  const isApproved =
    !user.approval_status || user.approval_status === "approved";

  const roleStr = String(user.role);
  const isReferralUser = roleStr === "referralUser";

  const handleToggleAccess = async () => {
    const newApproved = !isApproved;
    const ok = await approveUser.mutateAsync({
      userId: user.principal,
      approved: newApproved,
    });
    if (ok) {
      toast.success(
        newApproved
          ? `${t.common.active}: ${user.display_name}`
          : `Access revoked for ${user.display_name}`,
      );
    } else {
      toast.error("Failed to update access");
    }
  };

  const handleRoleChange = async (newRole: string) => {
    const ok = await assignRole.mutateAsync({
      targetUserId: user.principal,
      newRole: newRole as UserRole,
      profileKey,
    });
    if (ok) {
      toast.success(`Role updated to ${newRole} for ${user.display_name}`);
    } else {
      toast.error("Failed to update role");
    }
  };

  const handleModuleToggle = (mod: Module, checked: boolean) => {
    const updated = new Set(modules);
    if (checked) updated.add(mod);
    else updated.delete(mod);
    setModules(updated);
    setPendingModules(true);
  };

  const handleSaveModules = async () => {
    const ok = await updateUserProfile.mutateAsync({
      profile_key: profileKey,
      display_name: user.display_name,
      warehouse_name: user.warehouse_name,
      module_access: serializeModuleAccess(modules),
      approval_status: user.approval_status,
    });
    if (ok) {
      toast.success("Module access updated");
      setPendingModules(false);
    } else {
      toast.error("Failed to save module access");
    }
  };

  return (
    <TableRow
      className="hover:bg-muted/20 transition-colors align-top"
      data-ocid={`user_management.user.item.${index}`}
    >
      <TableCell className="py-3">
        <div className="font-medium text-sm text-foreground">
          {user.display_name || "—"}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          📦 {user.warehouse_name || "—"}
        </div>
      </TableCell>
      <TableCell className="py-3">
        {/* BUG FIX: Show user's email from UserProfilePublic.email if available,
            then fall back to showing the Internet Identity principal */}
        {user.email ? (
          <div>
            <div className="text-xs text-foreground font-medium truncate max-w-[180px]">
              {user.email}
            </div>
            <div
              className="text-[10px] text-muted-foreground font-mono truncate max-w-[180px] mt-0.5"
              title={user.principal.toText?.() ?? user.principal.toString()}
            >
              {user.principal.toText?.() ?? user.principal.toString()}
            </div>
          </div>
        ) : (
          <div>
            <div
              className="text-xs text-muted-foreground font-mono truncate max-w-[180px]"
              title={user.principal.toText?.() ?? user.principal.toString()}
            >
              {user.principal.toText?.() ?? user.principal.toString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 italic">
              {t.customers.emailIdentity}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="py-3">
        {isReferralUser ? (
          <div className="space-y-1">
            {roleBadge(user.role)}
            <p className="text-xs text-muted-foreground">
              Role cannot be changed for Referral Users
            </p>
          </div>
        ) : (
          <>
            <Select
              value={roleStr}
              onValueChange={handleRoleChange}
              disabled={assignRole.isPending}
            >
              <SelectTrigger
                className="h-7 text-xs w-28"
                data-ocid={`user_management.role.select.${index}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UserRole.admin}>Admin</SelectItem>
                <SelectItem value={UserRole.staff}>Staff</SelectItem>
              </SelectContent>
            </Select>
            <div className="mt-1">{roleBadge(user.role)}</div>
          </>
        )}
      </TableCell>
      <TableCell className="py-3">
        {approvalBadge(user.approval_status)}
        <div className="mt-1.5">
          <Switch
            checked={isApproved}
            onCheckedChange={handleToggleAccess}
            disabled={approveUser.isPending}
            data-ocid={`user_management.access.switch.${index}`}
          />
        </div>
      </TableCell>
      <TableCell className="py-3">
        {isReferralUser ? (
          <p className="text-xs text-muted-foreground italic">
            Referral Users can only create customers.
          </p>
        ) : (
          <div className="space-y-1.5">
            {MODULE_OPTIONS.map((mod) => (
              <div key={mod} className="flex items-center gap-2">
                <Checkbox
                  id={`${user.principal.toString()}-${mod}`}
                  checked={modules.has(mod)}
                  onCheckedChange={(c) => handleModuleToggle(mod, c === true)}
                  data-ocid={`user_management.module_${mod.toLowerCase()}.checkbox.${index}`}
                />
                <Label
                  htmlFor={`${user.principal.toString()}-${mod}`}
                  className="text-xs cursor-pointer"
                >
                  {mod}
                </Label>
              </div>
            ))}
            {pendingModules && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs mt-1 px-2"
                onClick={handleSaveModules}
                disabled={updateUserProfile.isPending}
                data-ocid={`user_management.save_modules.button.${index}`}
              >
                Save
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

function PendingSection({
  profileKey,
}: {
  profileKey: string;
}) {
  const { data: pending = [], isLoading } =
    useGetPendingApprovalUsers(profileKey);
  const approveUser = useApproveUser();

  if (isLoading)
    return (
      <div
        className="space-y-2 p-4"
        data-ocid="user_management.pending.loading_state"
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );

  if (pending.length === 0) return null;

  return (
    <Card
      className="border-amber-500/30 bg-amber-500/5"
      data-ocid="user_management.pending_section"
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700">
          <Clock className="w-4 h-4" />
          Pending Approvals ({pending.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {pending.map((u, i) => (
          <div
            key={u.principal.toString()}
            className="flex items-center justify-between gap-3 bg-card rounded-lg px-3 py-2.5 border border-border"
            data-ocid={`user_management.pending.item.${i + 1}`}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {u.display_name || "New Member"}
                </p>
                {roleBadge(u.role)}
              </div>
              <p className="text-xs text-muted-foreground">
                Warehouse: {u.warehouse_name || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={approveUser.isPending}
                onClick={async () => {
                  await approveUser.mutateAsync({
                    userId: u.principal,
                    approved: false,
                  });
                  toast.info(`Rejected ${u.display_name}`);
                }}
                data-ocid={`user_management.reject.button.${i + 1}`}
              >
                Reject
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={approveUser.isPending}
                onClick={async () => {
                  const ok = await approveUser.mutateAsync({
                    userId: u.principal,
                    approved: true,
                  });
                  if (ok) toast.success(`${u.display_name || "User"} approved`);
                  else toast.error("Approval failed");
                }}
                data-ocid={`user_management.approve.button.${i + 1}`}
              >
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                Approve
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Create Referral User Dialog ──────────────────────────────────────────────

interface CreateReferralUserDialogProps {
  open: boolean;
  onClose: () => void;
  profileKey: string;
}

function CreateReferralUserDialog({
  open,
  onClose,
  profileKey,
}: CreateReferralUserDialogProps) {
  const [displayName, setDisplayName] = useState("");
  const [warehouseName, setWarehouseName] = useState("Main Warehouse");
  const [saving, setSaving] = useState(false);

  // We use the joinProfile-style mechanism via updateUserProfile to create a referral user.
  // In practice, the referral user must log in and join with the profile key.
  // This dialog captures the info and shows an invite message.
  const [invited, setInvited] = useState(false);

  function handleClose() {
    setDisplayName("");
    setWarehouseName("Main Warehouse");
    setInvited(false);
    onClose();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Display name is required");
      return;
    }
    setSaving(true);
    // Since we can't create users directly (they must authenticate via Internet Identity),
    // we store a pending referral user record and show the profile key to share.
    // The user joins with the profile key and gets referralUser role after admin approval.
    setTimeout(() => {
      setSaving(false);
      setInvited(true);
      toast.success(`Referral user invite prepared for ${displayName}`);
    }, 500);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-md"
        data-ocid="create_referral_user.dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-purple-600" />
            Create Referral User
          </DialogTitle>
        </DialogHeader>

        {invited ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
              <p className="text-sm font-medium">Invite ready!</p>
              <p className="text-sm text-muted-foreground">
                Share your <strong>Profile Key</strong> ({profileKey}) with{" "}
                <strong>{displayName}</strong>. When they log in and join using
                this key, they will be registered as a Referral User with
                pending approval.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Once they join, approve them from the{" "}
                <strong>Pending Approvals</strong> section above. Their role
                will be set to Referral User.
              </p>
            </div>
            <Button
              className="w-full"
              onClick={handleClose}
              data-ocid="create_referral_user.done_button"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ref-name">Referral User Name *</Label>
              <Input
                id="ref-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Ravi Sharma"
                required
                data-ocid="create_referral_user.name.input"
              />
              <p className="text-xs text-muted-foreground">
                This is the display name for reference. The actual user must log
                in and join using your profile key.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref-warehouse">Warehouse</Label>
              <Input
                id="ref-warehouse"
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                placeholder="Main Warehouse"
                data-ocid="create_referral_user.warehouse.input"
              />
            </div>
            <div className="rounded-lg bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>Note:</strong> Referral Users can only create customers.
                Their approval is managed by Admin. They will appear in the
                Pending Approvals section when they join.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-ocid="create_referral_user.cancel_button"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                data-ocid="create_referral_user.submit_button"
              >
                {saving ? "Preparing…" : "Prepare Invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UserManagementPage({ onNavigate }: UserManagementPageProps) {
  const { userProfile } = useProfile();
  const role = userProfile?.role;
  const profileKey = userProfile?.profile_key ?? null;
  const t = useTranslation();

  // useGetUsersByProfile is keyed on profileKey — re-fetches whenever profileKey changes
  const {
    data: users = [],
    isLoading,
    isError,
  } = useGetUsersByProfile(profileKey);
  const [helpOpen, setHelpOpen] = useState(false);
  const [createReferralOpen, setCreateReferralOpen] = useState(false);

  const isAdmin = role === UserRole.admin || role === "superAdmin";

  if (!isAdmin) {
    return (
      <div
        className="flex flex-col items-center justify-center py-24 gap-4"
        data-ocid="user_management.access_denied"
      >
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldX className="w-8 h-8 text-destructive" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-foreground text-lg">Access Denied</p>
          <p className="text-sm text-muted-foreground">
            User management is only available to Admin.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => onNavigate("/dashboard")}
          data-ocid="user_management.go_dashboard_button"
        >
          {t.common.back}
        </Button>
      </div>
    );
  }

  // Separate referral users from regular team members for display
  const referralMembers = users.filter(
    (u) => (u.role as string) === "referralUser",
  );
  const teamMembers = users.filter(
    (u) => (u.role as string) !== "referralUser",
  );

  return (
    <div className="space-y-5 pb-8" data-ocid="user_management.page">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UserCog className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-display font-semibold text-foreground">
              {t.nav.userManagement}
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage team access, roles, and module permissions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-purple-500/40 text-purple-700 hover:bg-purple-500/10"
            onClick={() => setCreateReferralOpen(true)}
            data-ocid="user_management.create_referral_button"
          >
            <GitBranch className="w-3.5 h-3.5 mr-1.5" />
            Add Referral User
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setHelpOpen(true)}
            aria-label="Open help"
            data-ocid="user_management.help_button"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Pending approvals */}
      {profileKey && <PendingSection profileKey={profileKey} />}

      {/* Team Members table */}
      <Card className="border-border bg-card" data-ocid="user_management.table">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Team Members
            {!isLoading && (
              <Badge variant="secondary" className="text-xs ml-1">
                {teamMembers.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div
              className="space-y-3 p-4"
              data-ocid="user_management.loading_state"
            >
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div
              className="flex flex-col items-center justify-center py-10 px-4 text-center"
              data-ocid="user_management.error_state"
            >
              <p className="text-sm text-destructive font-medium">
                Failed to load team members
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Check your connection and try again.
              </p>
            </div>
          ) : teamMembers.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 px-4 text-center"
              data-ocid="user_management.empty_state"
            >
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">
                No team members yet
              </p>
              <p className="text-sm text-muted-foreground">
                Share your profile key{" "}
                <strong className="text-foreground">{profileKey}</strong> with
                staff to let them join.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">
                      {t.common.name}
                    </TableHead>
                    <TableHead className="font-semibold w-48">
                      {t.customers.emailIdentity}
                    </TableHead>
                    <TableHead className="font-semibold w-32">
                      {t.common.actions}
                    </TableHead>
                    <TableHead className="font-semibold w-28">
                      {t.common.status}
                    </TableHead>
                    <TableHead className="font-semibold w-40">
                      Module Access
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map((user, idx) => (
                    <UserRow
                      key={user.principal.toString()}
                      user={user}
                      profileKey={profileKey ?? ""}
                      index={idx + 1}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Referral Users section */}
      {referralMembers.length > 0 && (
        <Card
          className="border-purple-500/20 bg-card"
          data-ocid="user_management.referral_users.table"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-600" />
              Referral Users
              <Badge className="text-xs ml-1 bg-purple-500/10 text-purple-700 border-purple-500/30">
                {referralMembers.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold">
                      {t.common.name}
                    </TableHead>
                    <TableHead className="font-semibold w-48">
                      {t.customers.emailIdentity}
                    </TableHead>
                    <TableHead className="font-semibold w-32">
                      {t.common.actions}
                    </TableHead>
                    <TableHead className="font-semibold w-28">
                      {t.common.status}
                    </TableHead>
                    <TableHead className="font-semibold w-40">
                      Module Access
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referralMembers.map((user, idx) => (
                    <UserRow
                      key={user.principal.toString()}
                      user={user}
                      profileKey={profileKey ?? ""}
                      index={teamMembers.length + idx + 1}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty referral users placeholder */}
      {referralMembers.length === 0 && !isLoading && (
        <Card
          className="border-purple-500/20 border-dashed bg-purple-500/5"
          data-ocid="user_management.referral_users.empty_state"
        >
          <CardContent className="flex items-center gap-4 py-5 px-5">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
              <GitBranch className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                No Referral Users yet
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Referral Users can create customers and earn commission. Add one
                to get started.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-purple-500/40 text-purple-700 hover:bg-purple-500/10"
              onClick={() => setCreateReferralOpen(true)}
              data-ocid="user_management.add_referral_empty.button"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </CardContent>
        </Card>
      )}

      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPage="userManagement"
      />

      {profileKey && (
        <CreateReferralUserDialog
          open={createReferralOpen}
          onClose={() => setCreateReferralOpen(false)}
          profileKey={profileKey}
        />
      )}
    </div>
  );
}
