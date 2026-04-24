import { UserRole } from "@/backend";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useGetUserProfile, useInitSuperAdmin } from "@/hooks/useBackend";
import { Leaf, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

interface SuperAdminSetupPageProps {
  onComplete: () => void;
}

export function SuperAdminSetupPage({ onComplete }: SuperAdminSetupPageProps) {
  const initSuperAdmin = useInitSuperAdmin();
  const { data: existingUserProfile, isLoading } = useGetUserProfile();

  // If the current user is already the super admin, skip this screen entirely.
  useEffect(() => {
    if (!isLoading && existingUserProfile?.role === UserRole.superAdmin) {
      onComplete();
    }
  }, [existingUserProfile, isLoading, onComplete]);

  const handleSetup = async () => {
    try {
      const ok = await initSuperAdmin.mutateAsync();
      if (ok) {
        toast.success("Super Admin initialized!", {
          description: "You are now the app Super Admin.",
        });
      } else {
        toast.info("Super Admin already set up", {
          description: "Proceeding to business setup.",
        });
      }
      onComplete();
    } catch {
      toast.error("Setup failed. Please try again.");
    }
  };

  // While checking if the user is already a super admin, show nothing (AppLoader
  // in App.tsx handles the loading state before this component mounts).
  if (isLoading) return null;

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-ocid="super_admin_setup.page"
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
      <header className="relative z-10 flex items-center gap-2.5 px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
          <Leaf className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-display font-semibold text-foreground text-sm">
          MA Herb Business Manager
        </span>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Icon + heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              First-Time Setup
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-sm mx-auto">
              This appears to be the first launch. Claim the{" "}
              <strong className="text-foreground">Super Admin</strong> role to
              gain full oversight of the app.
            </p>
          </div>

          <Card
            className="shadow-lg border-border"
            data-ocid="super_admin_setup.card"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Become Super Admin
              </CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                The Super Admin has global oversight: monitor all business
                profiles, users, and system data. This role is assigned to the
                first person who clicks the button below.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Capabilities list */}
              <ul className="space-y-2">
                {[
                  "Monitor all business profiles",
                  "Enable or disable business profiles",
                  "View user counts per profile",
                  "Estimate data storage usage",
                  "Access system-wide analytics",
                ].map((cap) => (
                  <li key={cap} className="flex items-center gap-2.5 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-3 h-3 text-primary" />
                    </span>
                    <span className="text-foreground">{cap}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="w-full"
                size="lg"
                onClick={handleSetup}
                disabled={initSuperAdmin.isPending}
                data-ocid="super_admin_setup.setup_button"
              >
                {initSuperAdmin.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                    Initializing…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    Set Up as Super Admin
                  </span>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                If Super Admin is already set up, you will proceed to the next
                step automatically.
              </p>
            </CardContent>
          </Card>

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
