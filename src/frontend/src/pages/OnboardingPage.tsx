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
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useCreateProfile,
  useGetProfileByKey,
  useInitSuperAdmin,
  useJoinProfile,
} from "@/hooks/useBackend";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Leaf,
  LogIn,
  Plus,
  Sprout,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreateForm {
  business_name: string;
  profile_key: string;
  display_name: string;
  warehouse_name: string;
  phone_number: string;
  business_address: string;
  fssai_number: string;
  email: string;
}

interface JoinForm {
  profile_key: string;
  display_name: string;
  warehouse_name: string;
}

type TabMode = "create" | "join";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  );
}

function ProfileKeyHint({
  profileKey,
  mode,
}: {
  profileKey: string;
  mode: "create" | "join";
}) {
  const { data: found, isFetching } = useGetProfileByKey(
    profileKey.length > 2 ? profileKey : null,
  );

  if (profileKey.length <= 2) return null;
  if (isFetching) return <Skeleton className="h-5 w-48 mt-1" />;

  if (mode === "create") {
    return found ? (
      <Badge
        variant="destructive"
        className="mt-1 text-xs gap-1"
        data-ocid="onboarding.key_taken_badge"
      >
        <Info className="w-3 h-3" />
        Key taken — choose a different key
      </Badge>
    ) : (
      <Badge
        className="mt-1 text-xs gap-1 bg-primary/10 text-primary border-primary/20"
        variant="outline"
        data-ocid="onboarding.key_available_badge"
      >
        <Sprout className="w-3 h-3" />
        New profile will be created
      </Badge>
    );
  }

  return found ? (
    <Badge
      className="mt-1 text-xs gap-1 bg-primary/10 text-primary border-primary/20"
      variant="outline"
      data-ocid="onboarding.key_found_badge"
    >
      <CheckCircle2 className="w-3 h-3" />
      Profile found: {found.business_name}
    </Badge>
  ) : (
    <Badge
      variant="destructive"
      className="mt-1 text-xs gap-1"
      data-ocid="onboarding.key_notfound_badge"
    >
      <Info className="w-3 h-3" />
      No business found with this key
    </Badge>
  );
}

// ─── Field component ──────────────────────────────────────────────────────────

function FormField({
  id,
  label,
  required,
  children,
  error,
  hint,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {error ? <FieldError message={error} /> : null}
      {hint && !error ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

// ─── Create Tab ───────────────────────────────────────────────────────────────

function CreateTab({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [form, setForm] = useState<CreateForm>({
    business_name: "",
    profile_key: "",
    display_name: "",
    warehouse_name: "",
    phone_number: "",
    business_address: "",
    fssai_number: "",
    email: "",
  });
  const [errors, setErrors] = useState<Partial<CreateForm>>({});
  const [keyBlurred, setKeyBlurred] = useState(false);

  const initSuperAdmin = useInitSuperAdmin();
  const createProfile = useCreateProfile();
  const joinProfile = useJoinProfile();

  const { data: keyCheck, isFetching: checkingKey } = useGetProfileByKey(
    keyBlurred && form.profile_key.length > 2 ? form.profile_key : null,
  );

  const isLoading =
    initSuperAdmin.isPending ||
    createProfile.isPending ||
    joinProfile.isPending;

  const set = (field: keyof CreateForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) {
      setErrors((e) => ({ ...e, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<CreateForm> = {};
    if (!form.business_name.trim())
      newErrors.business_name = "Business name is required";
    if (!form.profile_key.trim())
      newErrors.profile_key = "Profile key is required";
    if (!form.display_name.trim())
      newErrors.display_name = "Your name is required";
    if (!form.warehouse_name.trim())
      newErrors.warehouse_name = "Warehouse name is required";
    if (form.fssai_number && form.fssai_number.length !== 14)
      newErrors.fssai_number = "FSSAI must be exactly 14 digits";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      newErrors.email = "Enter a valid email address";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (keyCheck) {
      toast.error("Profile key already taken. Choose a different key.");
      return;
    }

    try {
      await initSuperAdmin.mutateAsync();
      const ok = await createProfile.mutateAsync({
        business_name: form.business_name,
        profile_key: form.profile_key,
        phone_number: form.phone_number,
        business_address: form.business_address,
        fssai_number: form.fssai_number,
        email: form.email,
        logo_url: "",
        receipt_notes: "",
        theme_color: "#16a34a",
      });

      if (!ok) {
        toast.error("Profile key already taken. Choose a different key.");
        return;
      }

      await joinProfile.mutateAsync({
        profileKey: form.profile_key,
        displayName: form.display_name,
        warehouseName: form.warehouse_name,
      });

      toast.success("Business profile created! Welcome aboard 🌿");
      await onSuccess();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="space-y-4" data-ocid="onboarding.create_panel">
      {/* Your Identity */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Your Identity
        </p>
        <FormField
          id="create_display_name"
          label="Your Name"
          required
          error={errors.display_name}
        >
          <Input
            id="create_display_name"
            placeholder="e.g. Mohan Arora"
            value={form.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            className={errors.display_name ? "border-destructive" : ""}
            data-ocid="onboarding.create_display_name.input"
          />
        </FormField>
        <FormField
          id="create_warehouse_name"
          label="Warehouse / Location"
          required
          error={errors.warehouse_name}
          hint="The primary warehouse you manage"
        >
          <Input
            id="create_warehouse_name"
            placeholder="e.g. Main Warehouse"
            value={form.warehouse_name}
            onChange={(e) => set("warehouse_name", e.target.value)}
            className={errors.warehouse_name ? "border-destructive" : ""}
            data-ocid="onboarding.create_warehouse_name.input"
          />
        </FormField>
      </div>

      {/* Business Info */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Business Info
        </p>

        <FormField
          id="create_business_name"
          label="Business Name"
          required
          error={errors.business_name}
        >
          <Input
            id="create_business_name"
            placeholder="e.g. MA Herbal Distributors"
            value={form.business_name}
            onChange={(e) => set("business_name", e.target.value)}
            className={errors.business_name ? "border-destructive" : ""}
            data-ocid="onboarding.create_business_name.input"
          />
        </FormField>

        <FormField
          id="create_profile_key"
          label="Unique Profile Key"
          required
          error={errors.profile_key}
          hint="Team members use this key to join your profile"
        >
          <Input
            id="create_profile_key"
            placeholder="e.g. ma-herb-2024"
            value={form.profile_key}
            onChange={(e) =>
              set(
                "profile_key",
                e.target.value.toLowerCase().replace(/\s+/g, "-"),
              )
            }
            onBlur={() => setKeyBlurred(true)}
            className={errors.profile_key ? "border-destructive" : ""}
            data-ocid="onboarding.create_profile_key.input"
          />
          {keyBlurred && checkingKey && (
            <Skeleton
              className="h-5 w-40 mt-1"
              data-ocid="onboarding.key_checking_state"
            />
          )}
          {keyBlurred && !checkingKey && (
            <ProfileKeyHint profileKey={form.profile_key} mode="create" />
          )}
        </FormField>

        <FormField
          id="create_phone"
          label="Phone Number"
          error={errors.phone_number}
        >
          <Input
            id="create_phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.phone_number}
            onChange={(e) => set("phone_number", e.target.value)}
            className={errors.phone_number ? "border-destructive" : ""}
            data-ocid="onboarding.create_phone.input"
          />
        </FormField>

        <FormField id="create_email" label="Email Address" error={errors.email}>
          <Input
            id="create_email"
            type="email"
            placeholder="contact@maherb.in"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            className={errors.email ? "border-destructive" : ""}
            data-ocid="onboarding.create_email.input"
          />
        </FormField>

        <FormField
          id="create_fssai"
          label="FSSAI License Number (14 digits)"
          error={errors.fssai_number}
        >
          <div className="relative">
            <Input
              id="create_fssai"
              placeholder="12345678901234"
              maxLength={14}
              value={form.fssai_number}
              onChange={(e) =>
                set("fssai_number", e.target.value.replace(/\D/g, ""))
              }
              className={`font-mono tracking-widest pr-12 ${errors.fssai_number ? "border-destructive" : ""}`}
              data-ocid="onboarding.create_fssai.input"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
              {form.fssai_number.length}/14
            </span>
          </div>
        </FormField>

        <FormField
          id="create_address"
          label="Business Address"
          error={errors.business_address}
        >
          <Input
            id="create_address"
            placeholder="Street, City, State"
            value={form.business_address}
            onChange={(e) => set("business_address", e.target.value)}
            className={errors.business_address ? "border-destructive" : ""}
            data-ocid="onboarding.create_address.input"
          />
        </FormField>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        disabled={isLoading}
        data-ocid="onboarding.create_submit_button"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            Setting up your business…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Business Profile
          </span>
        )}
      </Button>
    </div>
  );
}

// ─── Join Tab ─────────────────────────────────────────────────────────────────

function JoinTab({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [form, setForm] = useState<JoinForm>({
    profile_key: "",
    display_name: "",
    warehouse_name: "",
  });
  const [errors, setErrors] = useState<Partial<JoinForm>>({});
  const [keyBlurred, setKeyBlurred] = useState(false);

  const joinProfile = useJoinProfile();
  const { data: foundProfile, isFetching: checkingKey } = useGetProfileByKey(
    keyBlurred && form.profile_key.length > 2 ? form.profile_key : null,
  );

  const isLoading = joinProfile.isPending;

  const set = (field: keyof JoinForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<JoinForm> = {};
    if (!form.profile_key.trim())
      newErrors.profile_key = "Profile key is required";
    if (!form.display_name.trim())
      newErrors.display_name = "Your name is required";
    if (!form.warehouse_name.trim())
      newErrors.warehouse_name = "Warehouse name is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!foundProfile) {
      toast.error("No business found with that profile key. Please verify it.");
      return;
    }

    try {
      const ok = await joinProfile.mutateAsync({
        profileKey: form.profile_key,
        displayName: form.display_name,
        warehouseName: form.warehouse_name,
      });

      if (!ok) {
        toast.error("Could not join profile. The key may be invalid.");
        return;
      }

      toast.success(`Joined ${foundProfile.business_name}! Welcome 🌿`);
      await onSuccess();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="space-y-4" data-ocid="onboarding.join_panel">
      {/* Profile key */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Business Profile Key
        </p>
        <FormField
          id="join_profile_key"
          label="Profile Key"
          required
          error={errors.profile_key}
          hint="Ask your Admin for the business profile key"
        >
          <Input
            id="join_profile_key"
            placeholder="e.g. ma-herb-2024"
            value={form.profile_key}
            onChange={(e) => set("profile_key", e.target.value.toLowerCase())}
            onBlur={() => setKeyBlurred(true)}
            className={errors.profile_key ? "border-destructive" : ""}
            data-ocid="onboarding.join_profile_key.input"
          />
          {keyBlurred && checkingKey && (
            <Skeleton
              className="h-5 w-40 mt-1"
              data-ocid="onboarding.join_key_checking_state"
            />
          )}
          {keyBlurred && !checkingKey && (
            <ProfileKeyHint profileKey={form.profile_key} mode="join" />
          )}
        </FormField>
      </div>

      {/* Identity */}
      <div className="rounded-xl bg-muted/30 border border-border p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Your Identity
        </p>
        <FormField
          id="join_display_name"
          label="Your Name"
          required
          error={errors.display_name}
        >
          <Input
            id="join_display_name"
            placeholder="e.g. Raj Kumar"
            value={form.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            className={errors.display_name ? "border-destructive" : ""}
            data-ocid="onboarding.join_display_name.input"
          />
        </FormField>
        <FormField
          id="join_warehouse_name"
          label="Warehouse / Location"
          required
          error={errors.warehouse_name}
          hint="The warehouse you will manage"
        >
          <Input
            id="join_warehouse_name"
            placeholder="e.g. Delhi Sub-Warehouse"
            value={form.warehouse_name}
            onChange={(e) => set("warehouse_name", e.target.value)}
            className={errors.warehouse_name ? "border-destructive" : ""}
            data-ocid="onboarding.join_warehouse_name.input"
          />
        </FormField>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={handleSubmit}
        disabled={
          isLoading ||
          (keyBlurred &&
            !checkingKey &&
            !foundProfile &&
            form.profile_key.length > 2)
        }
        data-ocid="onboarding.join_submit_button"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
            Joining…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <LogIn className="w-4 h-4" />
            Join Business
          </span>
        )}
      </Button>
    </div>
  );
}

// ─── Tab Switcher ─────────────────────────────────────────────────────────────

function TabSwitcher({
  mode,
  onSwitch,
}: {
  mode: TabMode;
  onSwitch: (m: TabMode) => void;
}) {
  return (
    <div
      className="flex rounded-xl border border-border bg-muted/40 p-1 gap-1"
      role="tablist"
      data-ocid="onboarding.tabs"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "create"}
        onClick={() => onSwitch("create")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === "create"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-ocid="onboarding.create_tab"
      >
        <Plus className="w-3.5 h-3.5 flex-shrink-0" />
        Create Profile
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "join"}
        onClick={() => onSwitch("join")}
        className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          mode === "join"
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        data-ocid="onboarding.join_tab"
      >
        <LogIn className="w-3.5 h-3.5 flex-shrink-0" />
        Join Existing
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const { refetchProfile } = useProfile();
  const [mode, setMode] = useState<TabMode>("create");

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-ocid="onboarding.page"
    >
      {/* Decorative background — fixed, behind everything */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.92 0.06 130 / 0.4) 0%, transparent 70%)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center gap-2.5 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm flex-shrink-0">
          <Leaf className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-display font-semibold text-foreground text-sm">
          MA Herb Business Manager
        </span>
      </header>

      {/* Scrollable content area */}
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="w-full max-w-[480px] mx-auto px-4 py-8 space-y-6">
          {/* Hero heading */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg">
              <Leaf className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">
                Welcome to MA Herb
              </h1>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
                Set up your workspace to start managing your herbal business.
              </p>
            </div>
          </div>

          {/* Onboarding card */}
          <Card className="shadow-lg border-border" data-ocid="onboarding.card">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-display">
                Get Started
              </CardTitle>
              <CardDescription className="text-sm">
                Create a new business profile or join an existing team.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Tab switcher */}
              <TabSwitcher mode={mode} onSwitch={setMode} />

              {/* Tab content — only one shown at a time */}
              {mode === "create" ? (
                <CreateTab onSuccess={refetchProfile} />
              ) : (
                <JoinTab onSuccess={refetchProfile} />
              )}
            </CardContent>
          </Card>

          {/* Role info hint */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 flex gap-3">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">First user</strong> to create
              a profile becomes the{" "}
              <strong className="text-foreground">Admin</strong>. Team members
              who join are assigned as{" "}
              <strong className="text-foreground">Sub-Admins</strong>, each
              managing their own warehouse.
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-muted-foreground pb-4">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
