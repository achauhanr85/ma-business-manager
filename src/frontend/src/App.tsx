import { RoutingStatus, UserRole } from "@/backend";
import { createActor } from "@/backend";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ImpersonationProvider,
  useImpersonation,
} from "@/contexts/ImpersonationContext";
import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { useAuth } from "@/hooks/useAuth";
import { AdminTestsPage } from "@/pages/AdminTestsPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { CustomerGoalsPage } from "@/pages/CustomerGoalsPage";
import { CustomerMedicalIssuesPage } from "@/pages/CustomerMedicalIssuesPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { IndexPage } from "@/pages/IndexPage";
import { InventoryMovementPage } from "@/pages/InventoryMovementPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { LoanerInventoryPage } from "@/pages/LoanerInventoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage";
import { ReceiptPage } from "@/pages/ReceiptPage";
import { SalesPage } from "@/pages/SalesPage";
import { StageInventoryPage } from "@/pages/StageInventoryPage";
import { SuperAdminPage } from "@/pages/SuperAdminPage";
import { SuperAdminSetupPage } from "@/pages/SuperAdminSetupPage";
import { UserManagementPage } from "@/pages/UserManagementPage";
import { UserPreferencesPage } from "@/pages/UserPreferencesPage";
import { VendorsPage } from "@/pages/VendorsPage";
import { useActor } from "@caffeineai/core-infrastructure";
import { Clock, Leaf } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AppPath =
  | "/dashboard"
  | "/sales"
  | "/inventory"
  | "/inventory-movement"
  | "/purchase-orders"
  | "/vendors"
  | "/products"
  | "/analytics"
  | "/profile"
  | "/receipt"
  | "/customers"
  | "/customer-goals"
  | "/customer-medical-issues"
  | "/super-admin"
  | "/user-management"
  | "/loaner-inventory"
  | "/stage-inventory"
  | "/user-preferences"
  | "/admin/tests";

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/sales": "New Sale",
    "/inventory": "Inventory",
    "/inventory-movement": "Inventory Movement",
    "/purchase-orders": "Purchase Orders",
    "/vendors": "Vendors",
    "/products": "Products & Categories",
    "/analytics": "Analytics",
    "/profile": "Business Profile",
    "/receipt": "Sale Receipt",
    "/customers": "Customer Management",
    "/customer-goals": "Customer Primary Goals",
    "/customer-medical-issues": "Customer Medical Issues",
    "/super-admin": "Super Admin",
    "/user-management": "User Management",
    "/loaner-inventory": "Loaner Inventory",
    "/stage-inventory": "Stage Inventory",
    "/user-preferences": "User Preferences",
    "/admin/tests": "Regression Tests",
  };
  return titles[path] ?? "Indi Negocio Livre";
}

// ── Shared gate screens ───────────────────────────────────────────────────────

function PendingApprovalGate() {
  const { logout } = useAuth();

  // Log the user out so they must log in again next time — they should not
  // retain an active session while their account is blocked.
  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8"
      data-ocid="pending_approval.page"
    >
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.92 0.06 130 / 0.35) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-400/30 mb-2">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-display font-bold text-foreground">
            Approval Pending
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have been logged out. Admin has been notified — please log back
            in once you've been approved.
          </p>
        </div>
        <div className="rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/30 px-4 py-4 text-left space-y-2">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">
            What's happening:
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1.5 list-disc list-inside">
            <li>Your join request has been sent to the Admin</li>
            <li>The Admin will review and approve your account</li>
            <li>
              You will gain full access once approved — log back in to check
            </li>
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

export function ProfilePendingApprovalGate() {
  const { logout } = useAuth();

  // Log the user out so they must re-authenticate after profile approval
  useEffect(() => {
    logout();
  }, [logout]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8"
      data-ocid="profile_pending_approval.page"
    >
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.92 0.06 130 / 0.35) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
          <Leaf className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-display font-bold text-foreground">
            Profile Under Review
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You have been logged out. Your profile is pending Super Admin
            approval — please log back in once access has been granted.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-4 text-left space-y-2">
          <p className="text-xs font-semibold text-foreground">
            What happens next:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
            <li>Super Admin has been notified of your new profile</li>
            <li>They will review your registration</li>
            <li>Once approved, log back in to access your full profile</li>
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
            expired. Please contact your Super Administrator to reactivate.
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

// ── Normal app content (Admin / Staff / Regular / Referral users) ─────────────

function AppContent() {
  const [currentPath, setCurrentPath] = useState<AppPath>("/dashboard");
  const [receiptSaleId, setReceiptSaleId] = useState<bigint | null>(null);
  const { userProfile } = useProfile();

  const navigate = (path: string, saleId?: bigint) => {
    setCurrentPath(path as AppPath);
    if (saleId !== undefined) setReceiptSaleId(saleId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const role = userProfile?.role as string | undefined;
  const isReferralUser = role === "referralUser";

  const renderPage = () => {
    if (isReferralUser) return <CustomersPage onNavigate={navigate} />;

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
      case "/vendors":
        return <VendorsPage onNavigate={navigate} />;
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
      case "/customer-goals":
        return <CustomerGoalsPage onNavigate={navigate} />;
      case "/customer-medical-issues":
        return <CustomerMedicalIssuesPage onNavigate={navigate} />;
      case "/user-management":
        return <UserManagementPage onNavigate={navigate} />;
      case "/loaner-inventory":
        return <LoanerInventoryPage onNavigate={navigate} />;
      case "/stage-inventory":
        return <StageInventoryPage onNavigate={navigate} />;
      case "/user-preferences":
        return <UserPreferencesPage onNavigate={navigate} />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <Layout
      currentPath={isReferralUser ? "/customers" : currentPath}
      pageTitle={getPageTitle(isReferralUser ? "/customers" : currentPath)}
      onNavigate={navigate}
    >
      {renderPage()}
    </Layout>
  );
}

// ── Super Admin's own dashboard ───────────────────────────────────────────────

function SuperAdminApp() {
  const {
    isImpersonating,
    profileKey,
    profileName,
    impersonateAsRole,
    stopImpersonation,
  } = useImpersonation();
  const [currentPath, setCurrentPath] = useState<AppPath>(
    isImpersonating ? "/dashboard" : "/super-admin",
  );
  const [receiptSaleId, setReceiptSaleId] = useState<bigint | null>(null);

  const navigate = (path: string, saleId?: bigint) => {
    setCurrentPath(path as AppPath);
    if (saleId !== undefined) setReceiptSaleId(saleId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (isImpersonating) {
      setCurrentPath("/dashboard");
    } else {
      setCurrentPath("/super-admin");
    }
  }, [isImpersonating]);

  const renderPage = () => {
    if (isImpersonating) {
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
        case "/vendors":
          return <VendorsPage onNavigate={navigate} />;
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
        case "/customer-goals":
          return <CustomerGoalsPage onNavigate={navigate} />;
        case "/customer-medical-issues":
          return <CustomerMedicalIssuesPage onNavigate={navigate} />;
        case "/loaner-inventory":
          return <LoanerInventoryPage onNavigate={navigate} />;
        case "/stage-inventory":
          return <StageInventoryPage onNavigate={navigate} />;
        case "/user-preferences":
          return <UserPreferencesPage onNavigate={navigate} />;
        default:
          return <DashboardPage onNavigate={navigate} />;
      }
    }

    switch (currentPath) {
      case "/super-admin":
        return <SuperAdminPage onNavigate={navigate} />;
      case "/profile":
        return <ProfilePage onNavigate={navigate} />;
      case "/user-preferences":
        return <UserPreferencesPage onNavigate={navigate} />;
      case "/admin/tests":
        return <AdminTestsPage />;
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
      {isImpersonating && (
        <div
          className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-400"
          data-ocid="impersonation.banner"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm">👁️</span>
            <p className="text-sm font-medium truncate">
              Viewing as{" "}
              <span className="font-semibold capitalize">
                {impersonateAsRole}
              </span>{" "}
              of <span className="font-bold">{profileName}</span>
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

// ── Routing engine — uses getRoutingStatus() as single source of truth ────────
// BUG-13 fix: #noprofile → /onboarding — NEVER "Profile Under Review"
// BUG-14 fix: super admin setup done → bypass all gates
// Super Admin always bypasses ALL approval gates

type RoutingState = "loading" | "setup_needed" | RoutingStatus;

function AuthenticatedApp() {
  const { actor, isFetching: actorFetching } = useActor(createActor);
  const { isProfileDisabled } = useProfile();

  const [routingState, setRoutingState] = useState<RoutingState>("loading");
  const [superAdminSetupDone, setSuperAdminSetupDone] = useState(false);
  const fetchAttempted = useRef(false);

  useEffect(() => {
    if (fetchAttempted.current || actorFetching || !actor) return;
    fetchAttempted.current = true;

    (async () => {
      try {
        // First check if super admin exists (public unauthenticated call)
        const saExists = await actor.doesSuperAdminExist();
        if (!saExists) {
          setRoutingState("setup_needed");
          return;
        }
        // Use getRoutingStatus() as authoritative routing source
        const rs = await actor.getRoutingStatus();
        setRoutingState(rs);
      } catch {
        // Allow retry on next render cycle
        fetchAttempted.current = false;
      }
    })();
  }, [actor, actorFetching]);

  // After Super Admin setup completes, re-run routing
  useEffect(() => {
    if (!superAdminSetupDone || !actor || actorFetching) return;
    fetchAttempted.current = false;
    setRoutingState("loading");

    const timer = setTimeout(async () => {
      fetchAttempted.current = true;
      try {
        const rs = await actor.getRoutingStatus();
        setRoutingState(rs);
      } catch {
        // Fall back to superAdmin directly after setup
        setRoutingState(RoutingStatus.superAdmin);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [superAdminSetupDone, actor, actorFetching]);

  if (routingState === "loading") return <AppLoader />;

  // ── No super admin yet — first-time setup screen ─────────────────────────────
  if (routingState === "setup_needed") {
    return (
      <SuperAdminSetupPage onComplete={() => setSuperAdminSetupDone(true)} />
    );
  }

  // ── SUPER ADMIN: unconditional bypass of all gates ────────────────────────────
  // superAdminSetupDone also bypasses in case the routing fetch hasn't updated yet
  if (routingState === RoutingStatus.superAdmin || superAdminSetupDone) {
    return <SuperAdminApp />;
  }

  // ── Profile disabled (non-super-admin only) ───────────────────────────────────
  if (isProfileDisabled) return <ProfileDisabledPage />;

  // ── Route by status ───────────────────────────────────────────────────────────
  switch (routingState) {
    case RoutingStatus.active:
      return <AppContent />;

    // BUG-13 fix: users with no profile → onboarding, NEVER "Profile Under Review"
    case RoutingStatus.noprofile:
      return <OnboardingPage />;

    // Staff / Referral User awaiting Admin approval
    case RoutingStatus.pending_approval:
      return <PendingApprovalGate />;

    // Admin of new profile awaiting Super Admin approval
    case RoutingStatus.profile_pending_super_admin:
      return <ProfilePendingApprovalGate />;

    default:
      return <AppLoader />;
  }
}

// ── Root app ──────────────────────────────────────────────────────────────────

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  // Public index page — no authentication required
  const isIndexRoute =
    window.location.pathname === "/" ||
    window.location.pathname === "/index" ||
    window.location.pathname === "";

  if (isIndexRoute && !isAuthenticated && !isLoading) {
    return <IndexPage />;
  }

  if (isLoading) return <AppLoader />;
  if (!isAuthenticated) return <LoginPage />;

  return (
    <ImpersonationProvider>
      <ProfileProvider>
        <UserPreferencesProvider>
          <AuthenticatedApp />
        </UserPreferencesProvider>
      </ProfileProvider>
    </ImpersonationProvider>
  );
}

// Export UserRole so pages don't need to re-import from backend
export { UserRole };
