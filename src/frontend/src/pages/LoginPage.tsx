/*
 * PAGE: LoginPage
 * ─────────────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Internet Identity login screen. Shown to unauthenticated users before any
 *   protected content is rendered. Displays app branding, feature highlights,
 *   and a Login button that triggers the II authentication flow.
 *
 * ROLE ACCESS:
 *   public — rendered for unauthenticated users only
 *
 * FLOW:
 *   1. Mount / initialization
 *      ├─ ProfileLogoDisplay: fetches getAllProfilesForAdmin() anonymously
 *      │    ├─ if a profile logo exists → renders it above the login card
 *      │    └─ if none or fetch fails → renders nothing (graceful)
 *      └─ useAuth() provides login() and loginStatus
 *   2. User clicks Login
 *      ├─ login() called → Internet Identity popup opens
 *      │    ├─ success → principal resolved → App.tsx re-evaluates routing
 *      │    └─ cancelled → loginStatus returns to idle
 *      └─ loginStatus === "logging-in" → button shows spinner + "Signing in…"
 *   3. Post-login routing (handled in App.tsx, not here)
 *      ├─ superAdmin role → /super-admin
 *      ├─ no profile assigned → /onboarding
 *      ├─ pending approval → access denied screen + logout
 *      └─ admin/staff/referralUser → /dashboard
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIABLES INITIALIZED:
 *   - logoUrl: string | null = null   // fetched profile logo URL
 *   - checked: boolean = false        // whether logo fetch completed
 * ─────────────────────────────────────────────────────────────────────────────
 * SIDE EFFECTS (useEffect):
 *   - Trigger: [actor, isFetching]  →  Action: fetch first profile logo
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY HANDLERS:
 *   - login(): triggers Internet Identity authentication
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createActor } from "@/backend";
import type { ProfilePublic } from "@/backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useActor } from "@caffeineai/core-infrastructure";
import { Leaf, Shield, TrendingUp, Zap } from "lucide-react";
import { useEffect, useState } from "react";

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Sales & Profit Tracking",
    desc: "Real-time profit calculation with FIFO inventory costing",
  },
  {
    icon: Zap,
    title: "Volume Points Engine",
    desc: "Automatically track volume points per sale and monthly totals",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    desc: "Your business data is end-to-end encrypted on the Internet Computer",
  },
];

function useBackendActorForLogin() {
  return useActor(createActor);
}

/** Attempts to load the first available profile logo for the login screen.
 * Gracefully fails to nothing if no profile or no logo is set. */
function ProfileLogoDisplay() {
  const { actor, isFetching } = useBackendActorForLogin();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!actor || isFetching) return;
    let cancelled = false;
    (async () => {
      try {
        if (typeof actor.getAllProfilesForAdmin === "function") {
          const profiles: ProfilePublic[] =
            await actor.getAllProfilesForAdmin();
          if (!cancelled && profiles.length > 0) {
            const logo = profiles[0]?.logo_url;
            setLogoUrl(logo && logo.trim() !== "" ? logo : null);
          }
        }
      } catch {
        // silently degrade — no logo shown on any error
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actor, isFetching]);

  // Still loading
  if (!checked && !logoUrl) return null;

  if (!logoUrl) return null;

  return (
    <div className="flex justify-center mb-2">
      <img
        src={logoUrl}
        alt="Company logo"
        className="max-h-20 max-w-[180px] w-auto object-contain rounded-lg border border-border shadow-sm bg-card p-1"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
        data-ocid="login.business_logo"
      />
    </div>
  );
}

export function LoginPage() {
  const { login, isLoading } = useAuth();
  const { actor, isFetching } = useBackendActorForLogin();
  const [logoChecking, setLogoChecking] = useState(true);

  // Track when actor is ready so we can show/hide logo skeleton
  useEffect(() => {
    if (actor && !isFetching) {
      // Give a moment for the ProfileLogoDisplay to fetch
      const t = setTimeout(() => setLogoChecking(false), 1500);
      return () => clearTimeout(t);
    }
  }, [actor, isFetching]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-ocid="login.page"
    >
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Leaf className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display font-semibold text-foreground text-sm">
            Indi Negocio Livre
          </span>
          <span className="text-muted-foreground text-[10px]">
            Business Manager
          </span>
        </div>
      </header>

      {/* Hero section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Brand mark */}
          <div className="text-center space-y-4">
            {/* Company logo — displayed above login if a profile logo_url is stored */}
            {logoChecking ? (
              <div className="flex justify-center">
                <Skeleton className="h-16 w-32 rounded-lg" />
              </div>
            ) : (
              <ProfileLogoDisplay />
            )}

            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
              <Leaf className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                Indi Negocio Livre
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Business Manager
              </p>
            </div>
            <p className="text-foreground/70 text-sm max-w-xs mx-auto leading-relaxed">
              Manage your business distribution — sales, inventory, purchase
              orders, and analytics all in one place.
            </p>
          </div>

          {/* Login card */}
          <Card className="border border-border shadow-xs">
            <CardContent className="pt-6 pb-6 space-y-4">
              <div className="text-center">
                <h2 className="font-display font-semibold text-foreground">
                  Sign in to your account
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Use Internet Identity for secure, passwordless login
                </p>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={login}
                disabled={isLoading}
                data-ocid="login.primary_button"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    Connecting…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Login with Internet Identity
                  </span>
                )}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Your data is stored securely on the Internet Computer and only
                accessible by you.
              </p>
            </CardContent>
          </Card>

          {/* Feature list */}
          <div className="space-y-3">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div key={feat.title} className="flex items-start gap-3 px-1">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {feat.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{feat.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/40 border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground text-center">
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
      </footer>
    </div>
  );
}
