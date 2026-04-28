import type { ProfileInput, ProfilePublic, UserProfileInput } from "@/backend";
import { UserRole } from "@/backend";
import { HelpPanel } from "@/components/HelpPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useGetAllProfilesForAdmin,
  useGetProfile,
  useGetProfileByKey,
  useGetSuperAdminStats,
  useGetUserProfile,
  useUpdateProfile,
  useUpdateUserProfile,
} from "@/hooks/useBackend";
import { hexToOklch } from "@/lib/color";
import {
  AlertCircle,
  AtSign,
  Building2,
  CheckCircle2,
  ChevronDown,
  Eye,
  Hash,
  HelpCircle,
  KeyRound,
  Leaf,
  Mail,
  MapPin,
  Palette,
  Phone,
  Save,
  Shield,
  Upload,
  User,
  Users,
  Warehouse,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { toast } from "sonner";

interface ProfilePageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

interface BusinessFormErrors {
  business_name?: string;
  phone_number?: string;
  business_address?: string;
  fssai_number?: string;
  email?: string;
  theme_color?: string;
}

interface UserFormErrors {
  display_name?: string;
}

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function validateBusinessForm(values: ProfileInput): BusinessFormErrors {
  const errors: BusinessFormErrors = {};
  if (!values.business_name.trim()) {
    errors.business_name = "Business name is required";
  }
  if (
    values.phone_number.trim() &&
    !/^[+\d\s\-()]{7,15}$/.test(values.phone_number.trim())
  ) {
    errors.phone_number = "Enter a valid phone number";
  }
  if (
    values.fssai_number.trim() &&
    !/^\d{14}$/.test(values.fssai_number.trim())
  ) {
    errors.fssai_number = "FSSAI number must be exactly 14 digits";
  }
  if (
    values.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  ) {
    errors.email = "Enter a valid email address";
  }
  if (values.theme_color && !isValidHex(values.theme_color)) {
    errors.theme_color = "Enter a valid hex color (e.g. #16a34a)";
  }
  return errors;
}

interface ExtendedProfileForm extends ProfileInput {
  instagram_handle: string;
}

const EMPTY_FORM: ExtendedProfileForm = {
  business_name: "",
  phone_number: "",
  business_address: "",
  fssai_number: "",
  email: "",
  logo_url: "",
  receipt_notes: "",
  theme_color: "#16a34a",
  profile_key: "",
  instagram_handle: "",
};

/** Read instagram from localStorage scoped to a profile key */
function getInstagramHandle(profileKey: string): string {
  if (!profileKey) return "";
  return localStorage.getItem(`inl_instagram_${profileKey}`) ?? "";
}

/** Write instagram to localStorage scoped to a profile key */
function setInstagramHandle(profileKey: string, handle: string): void {
  if (!profileKey) return;
  localStorage.setItem(`inl_instagram_${profileKey}`, handle);
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      className="flex items-center gap-1.5 mt-1"
      data-ocid="profile.field_error"
    >
      <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const labels: Record<string, string> = {
    [UserRole.superAdmin]: "Super Admin",
    [UserRole.admin]: "Admin",
    [UserRole.staff]: "Staff",
  };
  const variants: Record<string, "default" | "secondary" | "outline"> = {
    [UserRole.superAdmin]: "default",
    [UserRole.admin]: "secondary",
    [UserRole.staff]: "outline",
  };
  return (
    <Badge
      variant={variants[role as string] ?? "outline"}
      className="font-body text-xs"
    >
      {labels[role as string] ?? String(role)}
    </Badge>
  );
}

function MapPlaceholder({ address }: { address: string }) {
  return (
    <div
      className="relative w-full h-36 rounded-xl overflow-hidden bg-secondary border border-border"
      data-ocid="profile.map_placeholder"
    >
      <svg
        className="absolute inset-0 w-full h-full opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.4"
        />
        <line
          x1="40%"
          y1="0"
          x2="40%"
          y2="100%"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.3"
        />
        <line
          x1="70%"
          y1="0"
          x2="70%"
          y2="100%"
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.2"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <MapPin className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="w-2 h-2 rounded-full bg-primary/60" />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-card/90 backdrop-blur-sm border-t border-border px-3 py-2">
        <p className="text-xs text-muted-foreground font-body line-clamp-1 min-h-[1rem]">
          {address.trim() || "Enter your business address to see it here"}
        </p>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5" data-ocid="profile.loading_state">
      <Skeleton className="h-36 rounded-xl" />
      {[1, 2].map((i) => (
        <div key={i} className="space-y-4 p-4 rounded-xl border border-border">
          <Skeleton className="h-5 w-40" />
          {[1, 2, 3].map((j) => (
            <div key={j} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
          ))}
        </div>
      ))}
      <Skeleton className="h-10 rounded-lg" />
    </div>
  );
}

// ─── Logo Upload Section ──────────────────────────────────────────────────────

interface LogoUploadProps {
  currentUrl: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
}

function LogoUpload({ currentUrl, onUploaded, disabled }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>(currentUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPreview(currentUrl);
  }, [currentUrl]);

  const handleFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WEBP)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB");
      return;
    }
    try {
      setUploading(true);
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setPreview(dataUrl);
        onUploaded(dataUrl);
        setUploading(false);
        toast.success("Logo ready", {
          description: "Save the profile to apply your logo everywhere.",
        });
      };
      reader.onerror = () => {
        setError("Failed to read file. Please try again.");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setError("Upload failed. Please try again.");
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3" data-ocid="profile.logo_upload">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-border bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
          {preview ? (
            <img
              src={preview}
              alt="Business logo"
              className="w-full h-full object-contain"
              onError={() => setPreview("")}
            />
          ) : (
            <Leaf className="w-7 h-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-body text-foreground">
            {preview ? "Logo uploaded" : "No logo set"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            PNG, JPG or WEBP · max 2 MB · Shown on receipts &amp; header
          </p>
          {uploading && (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-xs text-muted-foreground">Processing…</p>
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || disabled}
          data-ocid="profile.logo.upload_button"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {preview ? "Change" : "Upload"}
        </Button>
      </div>
      {error && <FieldError message={error} />}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Theme Color Section ──────────────────────────────────────────────────────

interface ThemeColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  error?: string;
  disabled?: boolean;
}

function ThemeColorPicker({
  value,
  onChange,
  error,
  disabled,
}: ThemeColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const previewColor = isValidHex(value) ? value : "#16a34a";

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const applyPreview = (color: string) => {
    if (isValidHex(color)) {
      try {
        const oklch = hexToOklch(color);
        document.documentElement.style.setProperty("--primary", oklch);
      } catch {
        // ignore
      }
    }
  };

  const handleColorPicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setHexInput(color);
    onChange(color);
    applyPreview(color);
  };

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setHexInput(raw);
    if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
      onChange(raw);
      applyPreview(raw);
    }
  };

  return (
    <div className="space-y-3" data-ocid="profile.theme_color">
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <input
            type="color"
            value={isValidHex(hexInput) ? hexInput : "#16a34a"}
            onChange={handleColorPicker}
            disabled={disabled}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Pick theme color"
            data-ocid="profile.theme_color.select"
          />
        </div>
        <Input
          value={hexInput}
          onChange={handleHexInput}
          placeholder="#16a34a"
          maxLength={7}
          disabled={disabled}
          className={`font-mono text-sm uppercase ${error ? "border-destructive" : ""}`}
          data-ocid="profile.theme_color.input"
        />
      </div>
      {error && <FieldError message={error} />}
      <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-3">
        <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground">Preview:</span>
        <button
          type="button"
          className="px-3 py-1.5 rounded-md text-xs font-body font-medium text-white shadow-sm transition-opacity"
          style={{ backgroundColor: previewColor }}
          aria-label="Color preview button"
        >
          Save Profile
        </button>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-body font-medium text-white"
          style={{ backgroundColor: previewColor }}
        >
          Active
        </span>
      </div>
    </div>
  );
}

// ─── Super Admin Profile Selector ────────────────────────────────────────────

interface ProfileSelectorProps {
  selectedKey: string;
  onSelect: (key: string) => void;
}

function ProfileSelector({ selectedKey, onSelect }: ProfileSelectorProps) {
  const { data: profiles = [], isLoading } = useGetAllProfilesForAdmin();
  const [open, setOpen] = useState(false);

  const selected = profiles.find((p) => p.profile_key === selectedKey);

  if (isLoading) {
    return <Skeleton className="h-10 rounded-lg" />;
  }

  if (profiles.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-border">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          No business profiles found
        </span>
      </div>
    );
  }

  return (
    <div className="relative" data-ocid="profile.admin_selector">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-border hover:bg-muted/60 transition-colors text-left"
        data-ocid="profile.admin_selector.toggle"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">
            {selected ? selected.business_name : "Select a profile to manage"}
          </span>
          {selectedKey && (
            <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {selectedKey}
            </code>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {profiles.map((p) => (
            <button
              key={p.profile_key}
              type="button"
              onClick={() => {
                onSelect(p.profile_key);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors ${
                p.profile_key === selectedKey ? "bg-primary/10" : ""
              }`}
              data-ocid={`profile.admin_selector.option.${p.profile_key}`}
            >
              <span className="font-medium truncate">{p.business_name}</span>
              <code className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
                {p.profile_key}
              </code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── User Profile Card ────────────────────────────────────────────────────────

function UserProfileCard() {
  const { data: userProfile, isLoading } = useGetUserProfile();
  const updateUserProfile = useUpdateUserProfile();

  const [displayName, setDisplayName] = useState("");
  const [nameError, setNameError] = useState<UserFormErrors>({});
  const [savedUser, setSavedUser] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.display_name);
    }
  }, [userProfile]);

  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: UserFormErrors = {};
    if (!displayName.trim()) errors.display_name = "Display name is required";
    setNameError(errors);
    if (Object.keys(errors).length > 0) return;

    if (!userProfile) return;
    const input: UserProfileInput = {
      display_name: displayName.trim(),
      warehouse_name: userProfile.warehouse_name,
      profile_key: userProfile.profile_key,
    };
    try {
      await updateUserProfile.mutateAsync(input);
      setSavedUser(true);
      toast.success("User profile updated", {
        description: "Your display name has been saved.",
      });
    } catch {
      toast.error("Failed to update user profile");
    }
  };

  if (isLoading) {
    return (
      <Card
        className="card-elevated"
        data-ocid="profile.user_card.loading_state"
      >
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-8 w-24" />
        </CardContent>
      </Card>
    );
  }

  if (!userProfile) return null;

  return (
    <Card className="card-elevated" data-ocid="profile.user_card">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-accent-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-display">
              Your Profile
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Personal details for this business profile
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 border border-border">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-body">
              Role
            </span>
          </div>
          <RoleBadge role={userProfile.role} />
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5 border border-border">
          <div className="flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-body">
              Warehouse
            </span>
          </div>
          <span className="text-sm font-body font-medium text-foreground truncate max-w-[140px]">
            {userProfile.warehouse_name || "—"}
          </span>
        </div>

        <Separator />

        <form onSubmit={handleUserSave} noValidate>
          <div className="space-y-1.5">
            <Label
              htmlFor="display_name"
              className="flex items-center gap-1.5 text-sm"
            >
              <User className="w-3.5 h-3.5 text-muted-foreground" />
              Display Name
            </Label>
            <Input
              id="display_name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setSavedUser(false);
              }}
              placeholder="Your name"
              className={nameError.display_name ? "border-destructive" : ""}
              data-ocid="profile.display_name.input"
            />
            <FieldError message={nameError.display_name} />
          </div>

          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={updateUserProfile.isPending}
            data-ocid="profile.update_user.save_button"
          >
            {updateUserProfile.isPending ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-foreground/30 border-t-foreground rounded-full animate-spin" />
                Saving…
              </span>
            ) : savedUser ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                Saved
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="w-3.5 h-3.5" />
                Update Name
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ─── Admin: Profile Users List ────────────────────────────────────────────────

function ProfileUsersCard({
  profileKeyOverride,
}: { profileKeyOverride?: string }) {
  const { data: stats, isLoading } = useGetSuperAdminStats();
  const { profile } = useProfile();

  const activeKey = profileKeyOverride ?? profile?.profile_key;

  if (isLoading) {
    return (
      <Card
        className="card-elevated"
        data-ocid="profile.users_card.loading_state"
      >
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const currentProfileStats = stats?.profiles.find(
    (p) => p.profile_key === activeKey,
  );

  if (!currentProfileStats) return null;

  return (
    <Card className="card-elevated" data-ocid="profile.users_card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-secondary-foreground" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base font-display">
              Team Members
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Users in this business profile
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className="rounded-lg border border-border divide-y divide-border overflow-hidden"
          data-ocid="profile.users_list"
        >
          <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Total users in profile
              </span>
            </div>
            <Badge variant="secondary" className="font-mono text-xs">
              {String(currentProfileStats.user_count)}
            </Badge>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Profile key</span>
            </div>
            <code className="text-xs font-mono text-foreground bg-muted px-2 py-0.5 rounded">
              {currentProfileStats.profile_key}
            </code>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Status</span>
            </div>
            <Badge
              variant={currentProfileStats.is_archived ? "outline" : "default"}
            >
              {currentProfileStats.is_archived ? "Archived" : "Active"}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Share the profile key above with teammates so they can join this
          profile.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Business Form ────────────────────────────────────────────────────────────

interface BusinessFormProps {
  profileData: ProfilePublic | null | undefined;
  isReadOnly: boolean;
  isSuperAdmin: boolean;
}

function BusinessForm({
  profileData,
  isReadOnly,
  isSuperAdmin,
}: BusinessFormProps) {
  const { refetchProfile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [form, setForm] = useState<ExtendedProfileForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<BusinessFormErrors>({});
  const [touched, setTouched] = useState<
    Partial<Record<keyof BusinessFormErrors, boolean>>
  >({});
  const [saved, setSaved] = useState(false);

  // Hydrate form whenever profile data changes
  useEffect(() => {
    if (profileData) {
      const instagramHandle = getInstagramHandle(profileData.profile_key);
      setForm({
        business_name: profileData.business_name ?? "",
        phone_number: profileData.phone_number ?? "",
        business_address: profileData.business_address ?? "",
        fssai_number: profileData.fssai_number ?? "",
        email: profileData.email ?? "",
        logo_url: profileData.logo_url ?? "",
        receipt_notes: profileData.receipt_notes ?? "",
        theme_color: profileData.theme_color ?? "#16a34a",
        profile_key: profileData.profile_key ?? "",
        instagram_handle: instagramHandle,
      });
      setSaved(false);
    }
  }, [profileData]);

  const handleChange = (field: keyof ExtendedProfileForm, value: string) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    setSaved(false);
    if (
      field !== "instagram_handle" &&
      touched[field as keyof BusinessFormErrors]
    ) {
      const fieldErrors = validateBusinessForm(updated);
      setErrors((prev) => ({
        ...prev,
        [field]: fieldErrors[field as keyof BusinessFormErrors],
      }));
    }
  };

  const handleBlur = (field: keyof BusinessFormErrors) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fieldErrors = validateBusinessForm(form);
    setErrors((prev) => ({ ...prev, [field]: fieldErrors[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allTouched = Object.fromEntries(
      (
        [
          "business_name",
          "phone_number",
          "business_address",
          "fssai_number",
          "email",
          "theme_color",
        ] as (keyof BusinessFormErrors)[]
      ).map((k) => [k, true]),
    ) as Partial<Record<keyof BusinessFormErrors, boolean>>;
    setTouched(allTouched);

    const validationErrors = validateBusinessForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      toast.error("Please fix the errors before saving");
      return;
    }

    try {
      const saveInput: ProfileInput = {
        business_name: form.business_name.trim(),
        phone_number: form.phone_number.trim(),
        business_address: form.business_address.trim(),
        fssai_number: form.fssai_number.trim(),
        email: form.email.trim(),
        logo_url: form.logo_url,
        receipt_notes: form.receipt_notes ?? "",
        theme_color: form.theme_color,
        profile_key: form.profile_key,
        instagram_handle: form.instagram_handle.trim(),
      };

      const success = await updateProfile.mutateAsync(saveInput);

      if (!success) {
        toast.error(
          "Profile update was rejected by the server. Please try again.",
        );
        return;
      }

      // Save instagram handle to localStorage (scoped by profile key)
      setInstagramHandle(form.profile_key, form.instagram_handle.trim());

      setSaved(true);

      // Refetch ProfileContext so theme + logo update app-wide
      await refetchProfile();

      // Apply theme color immediately after successful save
      if (saveInput.theme_color && isValidHex(saveInput.theme_color)) {
        try {
          const oklch = hexToOklch(saveInput.theme_color);
          document.documentElement.style.setProperty("--primary", oklch);
        } catch {
          // ignore
        }
      }

      toast.success("Profile saved!", {
        description: "Your business information has been updated.",
        icon: <CheckCircle2 className="w-4 h-4 text-primary" />,
      });
    } catch (err) {
      console.error("Profile save error:", err);
      toast.error("Failed to save profile", {
        description: "Please check your connection and try again.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Card className="card-elevated">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Leaf className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-display">
                Business Information
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isSuperAdmin
                  ? "Editing selected profile — you are Super Admin"
                  : "Appears on your receipts and invoices"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Profile Key — read only */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
              Profile Key
              <Badge variant="outline" className="ml-1 text-xs py-0">
                read-only
              </Badge>
            </Label>
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-border"
              data-ocid="profile.profile_key.input"
            >
              <code className="text-sm font-mono text-foreground flex-1 break-all">
                {form.profile_key || "—"}
              </code>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this key with your teammates so they can join this profile.
            </p>
          </div>

          {/* Business Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="business_name"
              className="flex items-center gap-1.5 text-sm"
            >
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              Business Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="business_name"
              placeholder="Indi Negocio Libre"
              value={form.business_name}
              onChange={(e) => handleChange("business_name", e.target.value)}
              onBlur={() => handleBlur("business_name")}
              disabled={isReadOnly}
              className={
                errors.business_name
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
              data-ocid="profile.business_name.input"
            />
            <FieldError message={errors.business_name} />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label
              htmlFor="phone_number"
              className="flex items-center gap-1.5 text-sm"
            >
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              Phone Number
            </Label>
            <Input
              id="phone_number"
              type="tel"
              placeholder="+91 98765 43210"
              value={form.phone_number}
              onChange={(e) => handleChange("phone_number", e.target.value)}
              onBlur={() => handleBlur("phone_number")}
              disabled={isReadOnly}
              className={
                errors.phone_number
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
              data-ocid="profile.phone_number.input"
            />
            <FieldError message={errors.phone_number} />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label
              htmlFor="email"
              className="flex items-center gap-1.5 text-sm"
            >
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="contact@business.in"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              disabled={isReadOnly}
              className={
                errors.email
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
              data-ocid="profile.email.input"
            />
            <FieldError message={errors.email} />
          </div>

          {/* Business Address */}
          <div className="space-y-1.5">
            <Label
              htmlFor="business_address"
              className="flex items-center gap-1.5 text-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              Business Address
            </Label>
            <Input
              id="business_address"
              placeholder="123 Main Street, City, State 400001"
              value={form.business_address}
              onChange={(e) => handleChange("business_address", e.target.value)}
              onBlur={() => handleBlur("business_address")}
              disabled={isReadOnly}
              className={
                errors.business_address
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }
              data-ocid="profile.business_address.input"
            />
            <FieldError message={errors.business_address} />
          </div>

          {/* FSSAI Number */}
          <div className="space-y-1.5">
            <Label
              htmlFor="fssai_number"
              className="flex items-center gap-1.5 text-sm"
            >
              <Shield className="w-3.5 h-3.5 text-muted-foreground" />
              FSSAI License Number
            </Label>
            <Input
              id="fssai_number"
              placeholder="12345678901234"
              value={form.fssai_number}
              maxLength={14}
              disabled={isReadOnly}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 14);
                handleChange("fssai_number", val);
              }}
              onBlur={() => handleBlur("fssai_number")}
              className={`font-mono tracking-widest ${errors.fssai_number ? "border-destructive focus-visible:ring-destructive" : ""}`}
              data-ocid="profile.fssai_number.input"
            />
            <div className="flex items-center justify-between">
              <FieldError message={errors.fssai_number} />
              <span className="text-xs text-muted-foreground ml-auto">
                {form.fssai_number.length}/14
              </span>
            </div>
          </div>

          {/* Instagram Account */}
          <div className="space-y-1.5">
            <Label
              htmlFor="instagram_handle"
              className="flex items-center gap-1.5 text-sm"
            >
              <AtSign className="w-3.5 h-3.5 text-muted-foreground" />
              Instagram Account
            </Label>
            <Input
              id="instagram_handle"
              placeholder="@yourbusiness"
              value={form.instagram_handle}
              onChange={(e) => handleChange("instagram_handle", e.target.value)}
              disabled={isReadOnly}
              data-ocid="profile.instagram_handle.input"
            />
            <p className="text-xs text-muted-foreground">
              Shown on receipts. Stored locally per device.
            </p>
          </div>

          <Separator />

          {/* Receipt Notes — Rich Text Editor */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              Receipt Notes
            </Label>
            <p className="text-xs text-muted-foreground">
              This note appears in the customer information section of receipts.
            </p>
            <div
              className="rounded-lg border border-input overflow-hidden bg-background quill-wrapper"
              data-ocid="profile.receipt_notes.editor"
            >
              <ReactQuill
                theme="snow"
                value={form.receipt_notes}
                onChange={(val) => {
                  if (!isReadOnly) {
                    handleChange("receipt_notes", val);
                  }
                }}
                readOnly={isReadOnly}
                placeholder="e.g. Thank you for your purchase! All sales are final."
                modules={{
                  toolbar: isReadOnly
                    ? false
                    : [
                        ["bold", "italic", "underline"],
                        [{ list: "ordered" }, { list: "bullet" }],
                        ["clean"],
                      ],
                }}
                formats={["bold", "italic", "underline", "list", "bullet"]}
              />
            </div>
          </div>

          <Separator />

          {/* Logo Upload */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Leaf className="w-3.5 h-3.5 text-muted-foreground" />
              Company Logo
            </Label>
            <p className="text-xs text-muted-foreground">
              Displayed in the app header and on printed receipts.
            </p>
            <LogoUpload
              currentUrl={form.logo_url}
              onUploaded={(url) => {
                if (!isReadOnly) handleChange("logo_url", url);
              }}
              disabled={isReadOnly}
            />
          </div>

          <Separator />

          {/* Theme Color */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm">
              <Palette className="w-3.5 h-3.5 text-muted-foreground" />
              Brand Color
            </Label>
            <ThemeColorPicker
              value={form.theme_color}
              onChange={(color) => {
                if (!isReadOnly) handleChange("theme_color", color);
              }}
              error={errors.theme_color}
              disabled={isReadOnly}
            />
          </div>

          {/* Save button — hidden for staff read-only */}
          {!isReadOnly && (
            <Button
              type="submit"
              className="w-full btn-theme"
              size="lg"
              disabled={updateProfile.isPending}
              data-ocid="profile.save_button"
            >
              {updateProfile.isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Saving…
                </span>
              ) : saved ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Profile
                </span>
              )}
            </Button>
          )}

          {updateProfile.isError && (
            <div
              className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20"
              data-ocid="profile.error_state"
            >
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">
                Failed to update profile. Please try again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

// ─── Main ProfilePage ─────────────────────────────────────────────────────────

export function ProfilePage({ onNavigate: _onNavigate }: ProfilePageProps) {
  const { data: ownProfile, isLoading } = useGetProfile();
  const { userProfile } = useProfile();
  const [helpOpen, setHelpOpen] = useState(false);

  const isSuperAdmin = userProfile?.role === UserRole.superAdmin;
  const isAdmin = userProfile?.role === UserRole.admin;
  const isStaff = userProfile?.role === UserRole.staff;

  const [selectedProfileKey, setSelectedProfileKey] = useState<string>("");

  const { data: selectedProfileData, isLoading: loadingSelected } =
    useGetProfileByKey(
      isSuperAdmin && selectedProfileKey ? selectedProfileKey : null,
    );

  const activeProfileData: ProfilePublic | null | undefined = isSuperAdmin
    ? selectedProfileData
    : ownProfile;

  const isFormLoading =
    isLoading || (isSuperAdmin && loadingSelected && !!selectedProfileKey);

  if (isFormLoading && !isSuperAdmin) return <ProfileSkeleton />;

  const mapAddress = activeProfileData?.business_address ?? "";

  return (
    <div className="space-y-5" data-ocid="profile.page">
      {/* Page header with help icon */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-display font-semibold text-foreground">
          Business Profile
        </h1>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setHelpOpen(true)}
          aria-label="Open help"
          data-ocid="profile.help_button"
        >
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Map preview */}
      <MapPlaceholder address={mapAddress} />

      {/* Super Admin: Profile Selector */}
      {isSuperAdmin && (
        <Card className="card-elevated" data-ocid="profile.admin_selector_card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-display">
                  Super Admin — Select Profile
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Choose a business profile to view or edit
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProfileSelector
              selectedKey={selectedProfileKey}
              onSelect={setSelectedProfileKey}
            />
            {!selectedProfileKey && (
              <p className="text-xs text-muted-foreground mt-2">
                Select a profile above to load its data into the form below.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Staff read-only notice */}
      {isStaff && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
          <Shield className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            You have <strong>Staff</strong> access — profile details are
            read-only.
          </p>
        </div>
      )}

      {/* Admin notice — editing own profile only */}
      {isAdmin && !isSuperAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
          <Shield className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            You are editing <strong>your own business profile</strong>. Only
            Super Admin can view or edit other profiles.
          </p>
        </div>
      )}

      {/* Business Information Form */}
      {(!isSuperAdmin || selectedProfileKey) && (
        <BusinessForm
          profileData={activeProfileData}
          isReadOnly={isStaff}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* User Profile card — not needed for Super Admin */}
      {!isSuperAdmin && <UserProfileCard />}

      {/* Admin/Super Admin: team overview */}
      {(isAdmin || isSuperAdmin) && (
        <ProfileUsersCard
          profileKeyOverride={
            isSuperAdmin ? selectedProfileKey || undefined : undefined
          }
        />
      )}

      <HelpPanel
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        currentPage="profile"
      />
    </div>
  );
}
