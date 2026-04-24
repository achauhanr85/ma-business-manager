import { UserRole } from "@/backend";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { InventoryMovementPage } from "@/pages/InventoryMovementPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage";
import { ReceiptPage } from "@/pages/ReceiptPage";
import { SalesPage } from "@/pages/SalesPage";
import { SuperAdminPage } from "@/pages/SuperAdminPage";
import { SuperAdminSetupPage } from "@/pages/SuperAdminSetupPage";
import { useState } from "react";

type AppPath =
  | "/dashboard"
  | "/sales"
  | "/inventory"
  | "/inventory-movement"
  | "/purchase-orders"
  | "/products"
  | "/analytics"
  | "/profile"
  | "/receipt"
  | "/customers"
  | "/super-admin";

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/sales": "New Sale",
    "/inventory": "Inventory",
    "/inventory-movement": "Inventory Movement",
    "/purchase-orders": "Purchase Orders",
    "/products": "Products & Categories",
    "/analytics": "Analytics",
    "/profile": "Business Profile",
    "/receipt": "Sale Receipt",
    "/customers": "Customer Management",
    "/super-admin": "Super Admin",
  };
  return titles[path] ?? "MA Herb";
}

function AppContent() {
  const [currentPath, setCurrentPath] = useState<AppPath>("/dashboard");
  const [receiptSaleId, setReceiptSaleId] = useState<bigint | null>(null);

  const navigate = (path: string, saleId?: bigint) => {
    setCurrentPath(path as AppPath);
    if (saleId !== undefined) setReceiptSaleId(saleId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPage = () => {
    switch (currentPath) {
      case "/dashboard":
        return <DashboardPage onNavigate={navigate} />;
      case "/sales":
        return <SalesPage onNavigate={navigate} />;
      case "/inventory":
        return <InventoryPage onNavigate={navigate} />;
      case "/inventory-movement":
        return <InventoryMovementPage onNavigate={navigate} />;
      case "/purchase-orders":
        return <PurchaseOrdersPage onNavigate={navigate} />;
      case "/products":
        return <ProductsPage onNavigate={navigate} />;
      case "/analytics":
        return <AnalyticsPage onNavigate={navigate} />;
      case "/profile":
        return <ProfilePage onNavigate={navigate} />;
      case "/receipt":
        return <ReceiptPage saleId={receiptSaleId} onNavigate={navigate} />;
      case "/customers":
        return <CustomersPage onNavigate={navigate} />;
      case "/super-admin":
        return <SuperAdminPage onNavigate={navigate} />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <Layout
      currentPath={currentPath}
      pageTitle={getPageTitle(currentPath)}
      onNavigate={navigate}
    >
      {renderPage()}
    </Layout>
  );
}

function SuperAdminApp() {
  // Super Admin bypasses all onboarding/profile requirements.
  // They land directly on the Super Admin dashboard.
  return (
    <Layout
      currentPath="/super-admin"
      pageTitle="Super Admin"
      onNavigate={() => {}}
    >
      <SuperAdminPage onNavigate={() => {}} />
    </Layout>
  );
}

function AuthenticatedApp() {
  const {
    userProfile,
    isLoadingProfile,
    hasFetchedProfile,
    isProfileDisabled,
  } = useProfile();
  // superAdminSetupDone tracks whether the first-run setup page has been
  // completed this session. It persists until the user refreshes.
  const [superAdminSetupDone, setSuperAdminSetupDone] = useState(false);

  // ── Step 1: Wait for profile to load ────────────────────────────────────────
  // Show loader while the actor is initialising OR while the fetch is in-flight.
  // We also keep the loader until we have at least one confirmed fetch result so
  // we never accidentally render the setup page due to a transient null state.
  if (isLoadingProfile || !hasFetchedProfile) return <AppLoader />;

  // ── Step 2: Super Admin shortcut ─────────────────────────────────────────────
  // If the user already has a Super Admin role, send them directly to the
  // Super Admin dashboard — skip onboarding and setup entirely.
  // This check MUST come before any onboarding/setup screen checks.
  if (userProfile?.role === UserRole.superAdmin) {
    return <SuperAdminApp />;
  }

  // ── Step 3: Profile disabled gate ────────────────────────────────────────────
  if (isProfileDisabled) {
    return <ProfileDisabledPage />;
  }

  // ── Step 4: First-run Super Admin setup ──────────────────────────────────────
  // Only show the setup screen if:
  // - We have confirmed (hasFetchedProfile = true) that the user truly has no profile
  // - The setup hasn't been completed in this session
  // hasFetchedProfile ensures we never show this page due to a loading race.
  if (!userProfile && !superAdminSetupDone) {
    return (
      <SuperAdminSetupPage onComplete={() => setSuperAdminSetupDone(true)} />
    );
  }

  // ── Step 5: Business profile onboarding ──────────────────────────────────────
  if (!userProfile) return <OnboardingPage />;

  // ── Step 6: Main application ─────────────────────────────────────────────────
  return <AppContent />;
}

function ProfileDisabledPage() {
  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4"
      data-ocid="profile_disabled.page"
    >
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 mb-2">
          <span className="text-3xl">🔒</span>
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-display font-bold text-foreground">
            Account Restricted
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your business profile has been disabled or its active window has
            expired. Please contact your Super Administrator to reactivate your
            account.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-left space-y-1">
          <p className="text-xs font-semibold text-foreground">
            What you can do:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>Contact your Super Admin to re-enable the profile</li>
            <li>Ask them to extend the active window dates</li>
            <li>Reach out via the contact details they provided</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}

function AppLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      data-ocid="app.loading_state"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🌿</span>
        </div>
        <div className="space-y-2 text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AppLoader />;
  if (!isAuthenticated) return <LoginPage />;

  return (
    <ProfileProvider>
      <AuthenticatedApp />
    </ProfileProvider>
  );
}
