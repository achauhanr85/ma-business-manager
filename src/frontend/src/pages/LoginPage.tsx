import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Leaf, Shield, TrendingUp, Zap } from "lucide-react";

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

export function LoginPage() {
  const { login, isLoading } = useAuth();

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
            MA Herb
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
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
              <Leaf className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-foreground">
                MA Herb
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Business Manager
              </p>
            </div>
            <p className="text-foreground/70 text-sm max-w-xs mx-auto leading-relaxed">
              Manage your herbal products distribution — sales, inventory,
              purchase orders, and analytics all in one place.
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
