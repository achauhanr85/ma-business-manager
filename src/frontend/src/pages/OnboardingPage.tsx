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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/contexts/ProfileContext";
import {
  useCreateProfile,
  useGetProfileByKey,
  useInitSuperAdmin,
  useJoinProfile,
} from "@/hooks/useBackend";
import { CheckCircle2, Info, Leaf, LogIn, Plus, Sprout } from "lucide-react";
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
}

interface JoinForm {
  profile_key: string;
  display_name: string;
  warehouse_name: string;
}

// ─── Profile Key Hint ─────────────────────────────────────────────────────────

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
        className="mt-1 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200"
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

// ─── Create Tab ───────────────────────────────────────────────────────────────

function CreateTab({
  onSuccess,
}: {
  onSuccess: () => Promise<void>;
}) {
  const [form, setForm] = useState<CreateForm>({
    business_name: "",
    profile_key: "",
    display_name: "",
    warehouse_name: "",
    phone_number: "",
    business_address: "",
    fssai_number: "",
  });
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

  const set = (field: keyof CreateForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.business_name.trim()) {
      toast.error("Business name is required");
      return;
    }
    if (!form.profile_key.trim()) {
      toast.error("Profile key is required");
      return;
    }
    if (!form.display_name.trim()) {
      toast.error("Your display name is required");
      return;
    }
    if (!form.warehouse_name.trim()) {
      toast.error("Warehouse name is required");
      return;
    }
    if (form.fssai_number && form.fssai_number.length !== 14) {
      toast.error("FSSAI number must be exactly 14 digits");
      return;
    }
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
        email: "",
        logo_url: "",
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
      {/* User identity */}
      <div className="rounded-lg bg-secondary/20 border border-border p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Your Identity
        </p>
        <div className="space-y-2">
          <Label htmlFor="create_display_name">Display Name *</Label>
          <Input
            id="create_display_name"
            placeholder="e.g. Mohan Arora"
            value={form.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            data-ocid="onboarding.create_display_name.input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create_warehouse_name">Warehouse / Location *</Label>
          <Input
            id="create_warehouse_name"
            placeholder="e.g. Main Warehouse"
            value={form.warehouse_name}
            onChange={(e) => set("warehouse_name", e.target.value)}
            data-ocid="onboarding.create_warehouse_name.input"
          />
        </div>
      </div>

      {/* Business info */}
      <div className="rounded-lg bg-secondary/20 border border-border p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Business Info
        </p>
        <div className="space-y-2">
          <Label htmlFor="create_business_name">Business Name *</Label>
          <Input
            id="create_business_name"
            placeholder="e.g. MA Herbal Distributors"
            value={form.business_name}
            onChange={(e) => set("business_name", e.target.value)}
            data-ocid="onboarding.create_business_name.input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create_profile_key">
            Unique Profile Key *{" "}
            <span className="text-xs text-muted-foreground font-normal">
              (your team uses this to join)
            </span>
          </Label>
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
            data-ocid="onboarding.create_profile_key.input"
          />
          {keyBlurred && !checkingKey && (
            <ProfileKeyHint profileKey={form.profile_key} mode="create" />
          )}
          {keyBlurred && checkingKey && (
            <Skeleton
              className="h-5 w-40 mt-1"
              data-ocid="onboarding.key_checking_state"
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="create_phone">Phone</Label>
            <Input
              id="create_phone"
              placeholder="+91 98765 43210"
              value={form.phone_number}
              onChange={(e) => set("phone_number", e.target.value)}
              data-ocid="onboarding.create_phone.input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create_fssai">FSSAI (14 digits)</Label>
            <Input
              id="create_fssai"
              placeholder="12345678901234"
              maxLength={14}
              value={form.fssai_number}
              onChange={(e) =>
                set("fssai_number", e.target.value.replace(/\D/g, ""))
              }
              data-ocid="onboarding.create_fssai.input"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="create_address">Business Address</Label>
          <Input
            id="create_address"
            placeholder="Street, City, State"
            value={form.business_address}
            onChange={(e) => set("business_address", e.target.value)}
            data-ocid="onboarding.create_address.input"
          />
        </div>
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
            Setting up your business...
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
  const [keyBlurred, setKeyBlurred] = useState(false);

  const joinProfile = useJoinProfile();
  const { data: foundProfile, isFetching: checkingKey } = useGetProfileByKey(
    keyBlurred && form.profile_key.length > 2 ? form.profile_key : null,
  );

  const isLoading = joinProfile.isPending;

  const set = (field: keyof JoinForm, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async () => {
    if (!form.profile_key.trim()) {
      toast.error("Profile key is required");
      return;
    }
    if (!form.display_name.trim()) {
      toast.error("Your display name is required");
      return;
    }
    if (!form.warehouse_name.trim()) {
      toast.error("Warehouse name is required");
      return;
    }
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
      <div className="rounded-lg bg-secondary/20 border border-border p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Your Identity
        </p>
        <div className="space-y-2">
          <Label htmlFor="join_display_name">Display Name *</Label>
          <Input
            id="join_display_name"
            placeholder="e.g. Raj Kumar"
            value={form.display_name}
            onChange={(e) => set("display_name", e.target.value)}
            data-ocid="onboarding.join_display_name.input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="join_warehouse_name">Warehouse / Location *</Label>
          <Input
            id="join_warehouse_name"
            placeholder="e.g. Delhi Sub-Warehouse"
            value={form.warehouse_name}
            onChange={(e) => set("warehouse_name", e.target.value)}
            data-ocid="onboarding.join_warehouse_name.input"
          />
        </div>
      </div>

      <div className="rounded-lg bg-secondary/20 border border-border p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Business Profile
        </p>
        <div className="space-y-2">
          <Label htmlFor="join_profile_key">Profile Key *</Label>
          <Input
            id="join_profile_key"
            placeholder="e.g. ma-herb-2024"
            value={form.profile_key}
            onChange={(e) => set("profile_key", e.target.value.toLowerCase())}
            onBlur={() => setKeyBlurred(true)}
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
        </div>
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
            Joining...
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const { refetchProfile } = useProfile();

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-ocid="onboarding.page"
    >
      {/* Decorative background */}
      <div
        className="fixed inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.92 0.06 130 / 0.4) 0%, transparent 70%)",
        }}
      />

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Leaf className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-semibold text-foreground text-sm">
            MA Herb Business Manager
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {/* Welcome heading */}
          <div
            className="text-center mb-8 stagger-item"
            style={{ animationDelay: "0ms" }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary shadow-lg mb-4">
              <Leaf className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Welcome to MA Herb
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5 max-w-xs mx-auto">
              Set up your workspace to start managing your herbal business with
              ease.
            </p>
          </div>

          {/* Onboarding card */}
          <Card
            className="shadow-lg border-border stagger-item"
            style={{ animationDelay: "80ms" }}
            data-ocid="onboarding.card"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Get Started</CardTitle>
              <CardDescription>
                Create a new business profile or join your team with a profile
                key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="create" data-ocid="onboarding.tabs">
                <TabsList className="grid grid-cols-2 w-full mb-5">
                  <TabsTrigger
                    value="create"
                    className="gap-1.5"
                    data-ocid="onboarding.create_tab"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create New Profile
                  </TabsTrigger>
                  <TabsTrigger
                    value="join"
                    className="gap-1.5"
                    data-ocid="onboarding.join_tab"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    Join Existing
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="create">
                  <CreateTab onSuccess={refetchProfile} />
                </TabsContent>

                <TabsContent value="join">
                  <JoinTab onSuccess={refetchProfile} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Role info */}
          <div
            className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 flex gap-3 stagger-item"
            style={{ animationDelay: "160ms" }}
          >
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
          <p className="text-center text-xs text-muted-foreground mt-6">
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
