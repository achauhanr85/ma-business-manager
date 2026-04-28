import { createActor } from "@/backend";
import type { LeadInput } from "@/backend";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@caffeineai/core-infrastructure";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  Leaf,
  Package,
  ShoppingCart,
  Users,
  Warehouse,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ── Apply Herbal theme unconditionally for the public page ─────────────────────
function useHerbalTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.className;
    root.className = root.className
      .replace(/theme-\w+/g, "")
      .trim()
      .concat(" theme-herbal");
    return () => {
      root.className = prev;
    };
  }, []);
}

// ── Types ──────────────────────────────────────────────────────────────────────
type FormState = "idle" | "submitting" | "success" | "error";

// ── Feature data ───────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: BarChart3,
    title: "Smart Dashboard & KPIs",
    description:
      "Sales trends, customer counts, referral commissions — all in one glance. Filter by staff or time period.",
  },
  {
    icon: Users,
    title: "Customer Management",
    description:
      "Full customer profiles with body composition tracking, goals, medical history, notes, and follow-up scheduling.",
  },
  {
    icon: ShoppingCart,
    title: "Sales & Cart",
    description:
      "Fast cart with last-order auto-fill, return orders, payment history, and WhatsApp receipt sharing.",
  },
  {
    icon: Package,
    title: "Inventory & Warehouses",
    description:
      "Multi-warehouse FIFO inventory with loaner stock tracking, low-stock alerts, and purchase orders.",
  },
  {
    icon: FileText,
    title: "Branded PDF Receipts",
    description:
      "Generate professional receipts with your logo, Instagram handle, body composition data, and product instructions.",
  },
  {
    icon: Globe,
    title: "Multi-Lingual UI",
    description:
      "Full support for English, Gujarati, and Hindi — switch language from preferences, persists across logins.",
  },
  {
    icon: Zap,
    title: "4 UI Themes",
    description:
      "Dark Editorial, Minimalist, Herbal, and Punk — user-selectable, stored per account.",
  },
  {
    icon: Warehouse,
    title: "Multi-Tenant & Private",
    description:
      "Strict data isolation per business profile. Portable — download and run on your own private canister.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Request a Demo",
    description:
      "Fill the form below. Our Super Admin will reach out to you via WhatsApp and provide your onboarding link.",
  },
  {
    step: "02",
    title: "Set Up Your Profile",
    description:
      "Create your business profile with your branding, invite your team, and configure your inventory.",
  },
  {
    step: "03",
    title: "Start Managing",
    description:
      "Process sales, track customers, manage inventory, and generate reports — all from a single platform.",
  },
];

// ── Lead Form Component ────────────────────────────────────────────────────────
function LeadForm() {
  const { actor } = useActor(createActor);
  const [formState, setFormState] = useState<FormState>("idle");
  const [form, setForm] = useState<LeadInput>({
    name: "",
    business_name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof LeadInput, string>>
  >({});

  const validate = () => {
    const newErrors: Partial<Record<keyof LeadInput, string>> = {};
    if (!form.name.trim()) newErrors.name = "Full name is required";
    if (!form.business_name.trim())
      newErrors.business_name = "Business name is required";
    if (!form.phone.trim()) newErrors.phone = "Phone number is required";
    if (!form.email.trim()) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Enter a valid email";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setFormState("submitting");
    try {
      // submitLead is callable without authentication (anonymous)
      const actorToUse = actor;
      if (!actorToUse) {
        // Try to call directly using a temporary anon actor
        throw new Error("Actor not ready");
      }
      await actorToUse.submitLead(form);
      setFormState("success");
      setForm({
        name: "",
        business_name: "",
        phone: "",
        email: "",
        message: "",
      });
    } catch {
      setFormState("error");
    }
  };

  const update =
    (field: keyof LeadInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  if (formState === "success") {
    return (
      <div
        className="flex flex-col items-center gap-4 py-12 text-center"
        data-ocid="lead_form.success_state"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-display font-semibold text-foreground">
          Request Received!
        </h3>
        <p className="text-muted-foreground max-w-sm">
          Thank you for your interest. We will contact you via WhatsApp within
          24 hours to arrange your demo.
        </p>
        <Button
          variant="outline"
          onClick={() => setFormState("idle")}
          data-ocid="lead_form.submit_again_button"
        >
          Submit Another Request
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4"
      data-ocid="lead_form.form"
      noValidate
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lead-name">Full Name *</Label>
          <Input
            id="lead-name"
            placeholder="Priya Sharma"
            value={form.name}
            onChange={update("name")}
            data-ocid="lead_form.name_input"
            aria-invalid={!!errors.name}
          />
          {errors.name && (
            <p
              className="text-xs text-destructive"
              data-ocid="lead_form.name_field_error"
            >
              {errors.name}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-business">Business Name *</Label>
          <Input
            id="lead-business"
            placeholder="Green Wellness Distributors"
            value={form.business_name}
            onChange={update("business_name")}
            data-ocid="lead_form.business_name_input"
            aria-invalid={!!errors.business_name}
          />
          {errors.business_name && (
            <p
              className="text-xs text-destructive"
              data-ocid="lead_form.business_name_field_error"
            >
              {errors.business_name}
            </p>
          )}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="lead-phone">Phone Number *</Label>
          <Input
            id="lead-phone"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={update("phone")}
            type="tel"
            data-ocid="lead_form.phone_input"
            aria-invalid={!!errors.phone}
          />
          {errors.phone && (
            <p
              className="text-xs text-destructive"
              data-ocid="lead_form.phone_field_error"
            >
              {errors.phone}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-email">Email Address *</Label>
          <Input
            id="lead-email"
            placeholder="priya@greenwellness.in"
            value={form.email}
            onChange={update("email")}
            type="email"
            data-ocid="lead_form.email_input"
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p
              className="text-xs text-destructive"
              data-ocid="lead_form.email_field_error"
            >
              {errors.email}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lead-message">Message (optional)</Label>
        <Textarea
          id="lead-message"
          placeholder="Tell us about your business, team size, or any specific requirements..."
          rows={3}
          value={form.message}
          onChange={update("message")}
          data-ocid="lead_form.message_textarea"
        />
      </div>
      {formState === "error" && (
        <p
          className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
          data-ocid="lead_form.error_state"
        >
          Something went wrong. Please try again or contact us via WhatsApp.
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={formState === "submitting"}
        data-ocid="lead_form.submit_button"
      >
        {formState === "submitting" ? (
          <span className="flex items-center gap-2">
            <span className="spinner-theme-sm" />
            Sending...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Request a Demo
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </Button>
    </form>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function IndexPage() {
  useHerbalTheme();
  const heroRef = useRef<HTMLElement>(null);
  const demoRef = useRef<HTMLElement>(null);

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToTop = () => {
    heroRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background" data-ocid="index.page">
      {/* ── Top Navigation ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-2 min-w-0"
            aria-label="Indi Negocio Livre — Back to top"
            data-ocid="index.logo_link"
          >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="hidden sm:block min-w-0">
              <p className="text-sm font-display font-bold text-foreground leading-tight truncate">
                Indi Negocio Livre
              </p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <a
              href="#features"
              className="hover:text-foreground transition-colors"
              data-ocid="index.features_nav_link"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-foreground transition-colors"
              data-ocid="index.how_it_works_nav_link"
            >
              How It Works
            </a>
            <a
              href="#demo"
              className="hover:text-foreground transition-colors"
              data-ocid="index.demo_nav_link"
            >
              Request Demo
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={scrollToDemo}
              className="hidden sm:inline-flex"
              data-ocid="index.get_started_button"
            >
              Get Started
            </Button>
            <Button size="sm" asChild data-ocid="index.login_button">
              <a href="/login">Login</a>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero Section ───────────────────────────────────────────────────── */}
      <section
        id="hero"
        ref={heroRef}
        className="relative overflow-hidden"
        data-ocid="index.hero_section"
      >
        {/* Botanical background decoration */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 60% 40%, oklch(0.88 0.06 130 / 0.25) 0%, transparent 65%), radial-gradient(ellipse 60% 50% at 10% 80%, oklch(0.85 0.05 80 / 0.15) 0%, transparent 60%)",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div className="space-y-6">
              <Badge
                variant="secondary"
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1"
              >
                <Leaf className="w-3 h-3 text-primary" />
                Herbal Business Management
              </Badge>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-foreground leading-tight tracking-tight">
                Manage Your{" "}
                <span className="relative text-primary">Herbal Business</span>{" "}
                Smarter
              </h1>

              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-xl">
                The complete mobile-first platform for herbal product
                distributors — inventory, sales, customers, and receipts in one
                place. Multi-lingual, multi-tenant, and fully private.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  onClick={scrollToDemo}
                  className="text-base px-6"
                  data-ocid="index.hero_cta_button"
                >
                  Request a Demo
                  <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="text-base px-6"
                  data-ocid="index.hero_login_button"
                >
                  <a href="/login">Sign In</a>
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground pt-2">
                {[
                  "Multi-lingual",
                  "4 UI Themes",
                  "Private Canister",
                  "FIFO Inventory",
                ].map((tag) => (
                  <span key={tag} className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Right: Hero image */}
            <div className="relative hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
                <img
                  src="/assets/generated/index-hero.dim_1200x700.jpg"
                  alt="Indi Negocio Livre dashboard preview"
                  className="w-full h-auto object-cover"
                  loading="eager"
                />
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-border/50" />
              </div>
              {/* Floating stat card */}
              <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Active Customers
                  </p>
                  <p className="text-lg font-display font-bold text-foreground">
                    1,248
                  </p>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">This Month</p>
                  <p className="text-lg font-display font-bold text-foreground">
                    ₹4.5k
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ───────────────────────────────────────────────── */}
      <section
        id="features"
        className="bg-muted/30 py-16 sm:py-24"
        data-ocid="index.features_section"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="secondary" className="text-xs">
              Everything You Need
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              Built for Herbal Distributors
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              From inventory tracking to branded PDF receipts — every feature
              your herbal business needs, in one cohesive platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((feat, i) => (
              <Card
                key={feat.title}
                className="border border-border bg-card hover:shadow-md transition-smooth group"
                data-ocid={`index.feature_card.${i + 1}`}
              >
                <CardContent className="p-5 space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-smooth">
                    <feat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-display font-semibold text-foreground text-sm leading-snug">
                    {feat.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="bg-background py-16 sm:py-24"
        data-ocid="index.how_it_works_section"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 space-y-3">
            <Badge variant="secondary" className="text-xs">
              Simple Onboarding
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              Up and Running in Minutes
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.step}
                className="relative text-center space-y-4"
                data-ocid={`index.how_it_works_step.${i + 1}`}
              >
                {/* Connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-[-calc(50%-2rem)] h-px bg-border"
                    aria-hidden="true"
                  />
                )}
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground text-xl font-display font-bold shadow-md">
                  {step.step}
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-display font-semibold text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Request Form ──────────────────────────────────────────────── */}
      <section
        id="demo"
        ref={demoRef}
        className="bg-muted/40 py-16 sm:py-24"
        data-ocid="index.demo_section"
      >
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 space-y-3">
            <Badge variant="secondary" className="text-xs">
              Get Started Today
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
              Request a Free Demo
            </h2>
            <p className="text-muted-foreground">
              Fill in your details and our team will contact you via WhatsApp
              within 24 hours to set up your account.
            </p>
          </div>

          <Card className="border border-border bg-card shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <LeadForm />
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-4">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-primary hover:underline font-medium"
              data-ocid="index.login_link"
            >
              Sign in here
            </a>
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer
        className="bg-card border-t border-border py-8"
        data-ocid="index.footer"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-display font-semibold text-foreground">
              Indi Negocio Livre
            </span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()}. Built with love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(
                window.location.hostname,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              caffeine.ai
            </a>
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a
              href="/login"
              className="hover:text-foreground transition-colors"
              data-ocid="index.footer_login_link"
            >
              Login
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
