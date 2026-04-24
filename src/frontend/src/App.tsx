import { UserRole } from "@/backend";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ImpersonationProvider,
  useImpersonation,
} from "@/contexts/ImpersonationContext";
import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { useClaimSuperAdmin } from "@/hooks/useBackend";
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
import { useEffect, useRef, useState } from "react";

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
  | "/super-admin"
  | "/user-management";

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
    "/user-management": "User Management",
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

/** Super Admin's own dashboard — full access + impersonation controls */
function SuperAdminApp() {
  const { isImpersonating, profileKey, profileName, stopImpersonation } =
    useImpersonation();
  const [currentPath, setCurrentPath] = useState<AppPath>(
    isImpersonating ? "/dashboard" : "/super-admin",
  );
  const [receiptSaleId, setReceiptSaleId] = useState<bigint | null>(null);

  const navigate = (path: string, saleId?: bigint) => {
    setCurrentPath(path as AppPath);
    if (saleId !== undefined) setReceiptSaleId(saleId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // When impersonation starts/stops, reset path to appropriate default
  useEffect(() => {
    if (isImpersonating) {
      setCurrentPath("/dashboard");
    } else {
      setCurrentPath("/super-admin");
    }
  }, [isImpersonating]);

  const renderPage = () => {
    if (isImpersonating) {
      // Show normal user views for the impersonated profile
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
        default:
          return <DashboardPage onNavigate={navigate} />;
      }
    }

    // Normal super-admin view
    switch (currentPath) {
      case "/super-admin":
        return <SuperAdminPage onNavigate={navigate} />;
      case "/profile":
        return <ProfilePage onNavigate={navigate} />;
      default:
        return <SuperAdminPage onNavigate={navigate} />;
    }
  };

  return (
    <Layout
      currentPath={currentPath}
      pageTitle={getPageTitle(currentPath)}
      onNavigate={navigate}
    >
      {/* Impersonation banner */}
      {isImpersonating && (
        <div
          className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400"
          data-ocid="impersonation.banner"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">👁️</span>
            <p className="text-sm font-medium truncate">
              Viewing as Staff of{" "}
              <span className="font-bold">{profileName}</span>
              {profileKey && (
                <span className="text-xs font-normal opacity-70 ml-1">
                  ({profileKey})
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={stopImpersonation}
            className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
            data-ocid="impersonation.exit_button"
          >
            Exit
          </button>
        </div>
      )}
      {renderPage()}
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
  const [superAdminSetupDone, setSuperAdminSetupDone] = useState(false);

  const claimSuperAdmin = useClaimSuperAdmin();
  const claimAttempted = useRef(false);

  useEffect(() => {
    if (
      !claimAttempted.current &&
      hasFetchedProfile &&
      userProfile !== null &&
      userProfile?.role !== UserRole.superAdmin
    ) {
      claimAttempted.current = true;
      claimSuperAdmin.mutate();
    }
  }, [hasFetchedProfile, userProfile, claimSuperAdmin]);

  if (isLoadingProfile || !hasFetchedProfile) return <AppLoader />;

  if (userProfile?.role === UserRole.superAdmin) {
    return <SuperAdminApp />;
  }

  if (isProfileDisabled) {
    return <ProfileDisabledPage />;
  }

  if (!userProfile && !superAdminSetupDone) {
    return (
      <SuperAdminSetupPage onComplete={() => setSuperAdminSetupDone(true)} />
    );
  }

  if (!userProfile) return <OnboardingPage />;

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
    <ImpersonationProvider>
      <ProfileProvider>
        <AuthenticatedApp />
      </ProfileProvider>
    </ImpersonationProvider>
  );
}
