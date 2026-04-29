/**
 * App.tsx — Root component and application routing engine.
 *
 * WHAT THIS FILE DOES:
 * This is the entry point React renders. It decides WHICH screen to show based
 * on three factors:
 *   1. Is the user on the public index route? → show IndexPage (no login needed)
 *   2. Is the user authenticated? → show the authenticated app
 *   3. What is the user's routing status from the backend? → show the right page
 *
 * ROUTING FLOW:
 *   App (root)
 *   ├─ public "/" → IndexPage
 *   ├─ not logged in → LoginPage
 *   └─ logged in → AuthenticatedApp
 *       ├─ loading prefs/actor → AppLoader spinner
 *       ├─ no super admin yet → SuperAdminSetupPage (first-time setup)
 *       ├─ routingStatus = superAdmin → SuperAdminApp
 *       ├─ routingStatus = active → AppContent
 *       ├─ routingStatus = noprofile → OnboardingPage
 *       ├─ routingStatus = pending_approval → PendingApprovalGate
 *       └─ routingStatus = profile_pending_super_admin → ProfilePendingApprovalGate
 *
 * KEY DESIGN DECISIONS:
 * - A single `renderSharedPage()` function handles page rendering for BOTH
 *   AppContent (normal users) and SuperAdminApp (Super Admin impersonating).
 *   This eliminates ~200 lines of duplicated switch statements.
 * - Route strings are imported from ROUTES (lib/routes.ts) — no raw literals.
 * - Language/theme preferences are loaded before the app renders (BUG-15 fix).
 *   The UserPreferencesProvider exposes `isLoading`; we block render until done.
 *
 * WHO IMPORTS THIS: main.tsx — it renders <App /> into the DOM root.
 */

import { RoutingStatus, UserRole } from "@/backend";
import { createActor } from "@/backend";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ImpersonationProvider,
  useImpersonation,
} from "@/contexts/ImpersonationContext";
import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
import {
  UserPreferencesProvider,
  useUserPreferences,
} from "@/contexts/UserPreferencesContext";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/routes";
import { AdminTestsPage } from "@/pages/AdminTestsPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { CustomerGoalsPage } from "@/pages/CustomerGoalsPage";
import { CustomerMedicalIssuesPage } from "@/pages/CustomerMedicalIssuesPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DataInspectorPage } from "@/pages/DataInspectorPage";
import { IndexPage } from "@/pages/IndexPage";
import { InventoryMovementPage } from "@/pages/InventoryMovementPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { LoanerInventoryPage } from "@/pages/LoanerInventoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfileApprovalPage } from "@/pages/ProfileApprovalPage";
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

// ── AppPath type ───────────────────────────────────────────────────────────────
// TypeScript union of all valid in-app paths.
// Keeps the `currentPath` state type-safe — any path not in this list will
// cause a compile-time error rather than silently navigating nowhere.
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
  | "/admin/tests"
  // "/tests" is a legacy/checklist alias that maps to "/admin/tests".
  // The spec and 148-item QA checklist reference "/tests" throughout;
  // the actual ROUTES constant is "/admin/tests". Both must work.
  | "/tests"
  | "/data-inspector"
  | "/profile-approvals";

// ── Page title map ─────────────────────────────────────────────────────────────
// Maps each route path to a human-readable page title shown in the header.
// Used by both AppContent and SuperAdminApp via `getPageTitle()`.
function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    [ROUTES.dashboard]: "Dashboard",
    [ROUTES.sales]: "New Sale",
    [ROUTES.inventory]: "Inventory",
    [ROUTES.inventoryMovement]: "Inventory Movement",
    [ROUTES.purchaseOrders]: "Purchase Orders",
    [ROUTES.vendors]: "Vendors",
    [ROUTES.products]: "Products & Categories",
    [ROUTES.analytics]: "Analytics",
    [ROUTES.profile]: "Business Profile",
    [ROUTES.receipt]: "Sale Receipt",
    [ROUTES.customers]: "Customer Management",
    [ROUTES.customerGoals]: "Customer Primary Goals",
    [ROUTES.customerMedicalIssues]: "Customer Medical Issues",
    [ROUTES.superAdmin]: "Super Admin",
    [ROUTES.userManagement]: "User Management",
    [ROUTES.loanerInventory]: "Loaner Inventory",
    [ROUTES.stageInventory]: "Stage Inventory",
    [ROUTES.userPreferences]: "User Preferences",
    [ROUTES.adminTests]: "Regression Tests",
    [ROUTES.dataInspector]: "Data Inspector",
    [ROUTES.profileApprovals]: "Profile Approvals",
  };
  return titles[path] ?? "Indi Negocio Livre";
}

// ── Gate screens ───────────────────────────────────────────────────────────────
// These full-screen pages are shown when the user cannot access the main app.
// Each one logs the user out immediately (BUG-08 fix) so they must re-authenticate.

/**
 * PendingApprovalGate — shown to Staff or Referral Users whose Admin has not
 * yet approved their account. The user is logged out so they cannot retry
 * without a real login. Shown when routingStatus = pending_approval.
 *
 * FIX: We track whether logout has been called with local state so this
 * component can call logout once on mount and then STAY rendered showing
 * the "approval pending" message. Without this, the logout causes an
 * auth state change that unmounts the component before the user sees it.
 */
function PendingApprovalGate() {
  const { logout } = useAuth();
  // Track whether we have already called logout so we don't call it repeatedly
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  // Call logout once on mount — but keep this component rendered afterwards
  // so the user still sees the "Approval Pending" message after their session ends.
  useEffect(() => {
    if (!hasLoggedOut) {
      setHasLoggedOut(true);
      logout();
    }
  }, [hasLoggedOut, logout]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8"
      data-ocid="pending_approval.page"
    >
      {/* Decorative background gradient — purely visual, hidden from screen readers */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.92 0.06 130 / 0.35) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm text-center space-y-6">
        {/* Amber clock icon signals "waiting for approval" */}
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
        {/* Explainer card — helps user understand what to do next */}
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
        {/* "Try logging in again" button — does not auto-redirect, user must click */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          data-ocid="pending_approval.retry_button"
        >
          Try logging in again
        </button>
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

/**
 * ProfilePendingApprovalGate — shown to the Admin of a newly created profile
 * that the Super Admin has not yet approved. Logs the user out immediately.
 * Shown when routingStatus = profile_pending_super_admin.
 *
 * FIX: Same pattern as PendingApprovalGate — track logout with local state
 * so the component stays mounted and the message remains visible.
 */
export function ProfilePendingApprovalGate() {
  const { logout } = useAuth();
  const [hasLoggedOut, setHasLoggedOut] = useState(false);

  // Call logout once on mount — keep this component rendered afterwards
  // so the user still sees the "Profile Under Review" message.
  useEffect(() => {
    if (!hasLoggedOut) {
      setHasLoggedOut(true);
      logout();
    }
  }, [hasLoggedOut, logout]);

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8"
      data-ocid="profile_pending_approval.page"
    >
      {/* Decorative radial gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, oklch(0.92 0.06 130 / 0.35) 0%, transparent 70%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm text-center space-y-6">
        {/* Leaf icon matches the app brand and signals "under review" */}
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
        {/* What-happens-next guide — reduces support questions */}
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
        {/* "Try logging in again" button — does not auto-redirect, user must click */}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          data-ocid="profile_pending_approval.retry_button"
        >
          Try logging in again
        </button>
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

/**
 * ProfileDisabledPage — shown when the user's business profile has been
 * disabled by the Super Admin or its active date window has expired.
 * No logout here — the user can still log in but will see this screen.
 */
function ProfileDisabledPage() {
  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4"
      data-ocid="profile_disabled.page"
    >
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Lock icon signals access restriction */}
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
        {/* Guidance on what the user can do to resolve this */}
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

/**
 * AppLoader — generic full-screen loading spinner.
 * Shown while:
 *   - The Internet Identity SDK is initialising
 *   - The backend actor is connecting
 *   - User preferences are loading (BUG-15 fix)
 *   - The routing status is being fetched
 */
function AppLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      data-ocid="app.loading_state"
    >
      <div className="flex flex-col items-center gap-4">
        {/* Pulsing leaf logo — branded loading indicator */}
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🌿</span>
        </div>
        {/* Skeleton bars give the impression of content loading underneath */}
        <div className="space-y-2 text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

// ── Shared page renderer ───────────────────────────────────────────────────────
//
// WHY THIS EXISTS:
// Before this was extracted, both `AppContent` (normal users) and `SuperAdminApp`
// (Super Admin impersonating) had identical switch statements mapping path strings
// to page components. That was ~200 lines of duplicated code. Any new page required
// adding it to BOTH switch blocks — easy to forget and cause a navigation dead-end.
//
// Now there is ONE function. Both components call it with `(path, navigate, receiptSaleId)`.
//
// NOTE: Super Admin-only routes (/super-admin, /admin/tests, /data-inspector) are NOT
// included here because normal users must never reach them. They are handled separately
// inside SuperAdminApp below.
//
// @param path          - The current route path (e.g. "/dashboard")
// @param navigate      - The local navigate function that updates currentPath state
// @param receiptSaleId - The sale ID to pass to ReceiptPage (null if not on receipt)

function renderSharedPage(
  path: string,
  navigate: (path: string, saleId?: bigint) => void,
  receiptSaleId: bigint | null,
): React.ReactNode {
  switch (path) {
    // ── Sales section ────────────────────────────────────────────────────────
    case ROUTES.sales:
      return <SalesPage onNavigate={navigate} />;
    case ROUTES.receipt:
      // ReceiptPage needs the saleId of the specific sale to display
      return <ReceiptPage saleId={receiptSaleId} onNavigate={navigate} />;
    case ROUTES.purchaseOrders:
      return <PurchaseOrdersPage onNavigate={navigate} />;
    case ROUTES.vendors:
      return <VendorsPage onNavigate={navigate} />;

    // ── Customers section ────────────────────────────────────────────────────
    case ROUTES.customers:
      return <CustomersPage onNavigate={navigate} />;
    case ROUTES.customerGoals:
      return <CustomerGoalsPage onNavigate={navigate} />;
    case ROUTES.customerMedicalIssues:
      return <CustomerMedicalIssuesPage onNavigate={navigate} />;

    // ── Inventory section ────────────────────────────────────────────────────
    case ROUTES.inventory:
      return <InventoryPage onNavigate={navigate} />;
    case ROUTES.inventoryMovement:
      return <InventoryMovementPage onNavigate={navigate} />;
    case ROUTES.loanerInventory:
      return <LoanerInventoryPage onNavigate={navigate} />;
    case ROUTES.stageInventory:
      return <StageInventoryPage onNavigate={navigate} />;

    // ── Catalog & Analytics ───────────────────────────────────────────────────
    case ROUTES.products:
      return <ProductsPage onNavigate={navigate} />;
    case ROUTES.analytics:
      return <AnalyticsPage onNavigate={navigate} />;

    // ── Admin / Settings ─────────────────────────────────────────────────────
    case ROUTES.profile:
      return <ProfilePage onNavigate={navigate} />;
    case ROUTES.userManagement:
      return <UserManagementPage onNavigate={navigate} />;
    case ROUTES.userPreferences:
      return <UserPreferencesPage onNavigate={navigate} />;

    // ── Dashboard (default) ──────────────────────────────────────────────────
    // /dashboard is the fallback for any unrecognised path
    default:
      return <DashboardPage onNavigate={navigate} />;
  }
}

// ── AppContent — Normal users (Admin / Staff / Referral) ──────────────────────

/**
 * AppContent is the shell for authenticated non-Super-Admin users.
 * It manages the current page path in local state and delegates all rendering
 * to `renderSharedPage()`. Referral Users are always shown the Customers page
 * regardless of which path is active.
 */
function AppContent() {
  // `currentPath` tracks which page is currently shown — it's our "router"
  const [currentPath, setCurrentPath] = useState<AppPath>(ROUTES.dashboard);

  // `receiptSaleId` holds the sale ID for the receipt page — set when navigating to /receipt
  const [receiptSaleId, setReceiptSaleId] = useState<bigint | null>(null);

  const { userProfile } = useProfile();

  /**
   * navigate() — called by any page or header icon to switch pages.
   * @param path   - Target route (e.g. ROUTES.customers)
   * @param saleId - Optional; only needed when navigating to /receipt
   */
  const navigate = (path: string, saleId?: bigint) => {
    setCurrentPath(path as AppPath);
    if (saleId !== undefined) setReceiptSaleId(saleId);
    // Scroll to top so the new page starts at the beginning
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Referral Users can only access the Customer module — restrict at the app level
  const role = userProfile?.role as string | undefined;
  const isReferralUser = role === "referralUser";

  /**
   * renderPage() — decides what to show in the main content area.
   * Referral Users always see Customers; everyone else goes through the shared switch.
   */
  const renderPage = () => {
    // Referral users are pinned to the Customers page — no navigation elsewhere
    if (isReferralUser) return <CustomersPage onNavigate={navigate} />;
    return renderSharedPage(currentPath, navigate, receiptSaleId);
  };

  return (
    <Layout
      // When Referral User is active, always show Customers as the active sidebar item
      currentPath={isReferralUser ? ROUTES.customers : currentPath}
      pageTitle={getPageTitle(isReferralUser ? ROUTES.customers : currentPath)}
      onNavigate={navigate}
    >
      {renderPage()}
    </Layout>
  );
}

// ── SuperAdminApp — Super Admin's own dashboard and impersonation shell ───────

/**
 * SuperAdminApp is the shell for the Super Admin user.
 * It has two modes:
 *   1. Normal Super Admin: shows /super-admin, /admin/tests, /data-inspector, /profile, /user-preferences
 *   2. Impersonating: shows the same page set as AppContent for the selected profile
 *
 * The impersonation banner (yellow strip at the top) tells the Super Admin
 * which profile and role they are currently viewing as.
 */
function SuperAdminApp() {
  const {
    isImpersonating,
    profileKey,
    profileName,
    impersonateAsRole,
    stopImpersonation,
  } = useImpersonation();

  // Default path depends on whether we are impersonating — impersonation starts at dashboard
  const [currentPath, setCurrentPath] = useState<AppPath>(
    isImpersonating ? ROUTES.dashboard : ROUTES.superAdmin,
  );

  // `receiptSaleId` is needed if Super Admin navigates to /receipt while impersonating
  const [receiptSaleId, setReceiptSaleId] = useState<bigint | null>(null);

  /**
   * navigate() — same pattern as AppContent's navigate; updates path state
   */
  const navigate = (path: string, saleId?: bigint) => {
    setCurrentPath(path as AppPath);
    if (saleId !== undefined) setReceiptSaleId(saleId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // When impersonation starts or ends, reset the current path appropriately.
  // Without this, a Super Admin who just stopped impersonating would still see
  // the impersonated Dashboard instead of their own Super Admin dashboard.
  useEffect(() => {
    if (isImpersonating) {
      setCurrentPath(ROUTES.dashboard);
    } else {
      setCurrentPath(ROUTES.superAdmin);
    }
  }, [isImpersonating]);

  /**
   * renderPage() — what to show in the main content area.
   *
   * WHILE IMPERSONATING:
   *   Delegates to renderSharedPage() — shows the same pages as a normal user would see.
   *
   * WHEN NOT IMPERSONATING:
   *   Only Super Admin-specific pages are available.
   *   Super Admin cannot accidentally navigate to /sales or /customers from their own dashboard.
   */
  const renderPage = () => {
    if (isImpersonating) {
      // Super Admin is acting as Admin/Staff of a profile — show normal pages
      return renderSharedPage(currentPath, navigate, receiptSaleId);
    }

    // Super Admin's own pages — NOT available to normal users
    switch (currentPath) {
      case ROUTES.superAdmin:
        return <SuperAdminPage onNavigate={navigate} />;
      case ROUTES.profile:
        // Super Admin can also view/update their own preferences
        return <ProfilePage onNavigate={navigate} />;
      case ROUTES.userPreferences:
        return <UserPreferencesPage onNavigate={navigate} />;
      case ROUTES.adminTests:
        // Regression test suite — Super Admin only
        return <AdminTestsPage />;
      case "/tests":
        // "/tests" is the legacy alias used throughout the QA checklist and specs.
        // The canonical ROUTES constant is "/admin/tests" but both paths must render
        // the same page so checklist item 14 and external references continue to work.
        // Super Admin only — normal users never reach this switch branch.
        return <AdminTestsPage />;
      case ROUTES.dataInspector:
        // Raw data browser — Super Admin only
        return <DataInspectorPage />;
      case ROUTES.profileApprovals:
        // Profile approval queue — Super Admin only
        return <ProfileApprovalPage onNavigate={navigate} />;
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
      {/* Impersonation banner — only visible while impersonating. Stays at the top
          of the page so the Super Admin always knows they are in "view as" mode. */}
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
          {/* Clicking Exit ends impersonation and returns to the Super Admin dashboard */}
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

// ── AuthenticatedApp — Routing engine for logged-in users ────────────────────

/**
 * RoutingState — the possible states of the routing check.
 * "loading" is the initial state before we hear back from the backend.
 * "setup_needed" means no Super Admin exists yet — show the first-time setup screen.
 * All other values come from the backend RoutingStatus enum.
 */
type RoutingState = "loading" | "setup_needed" | RoutingStatus;

/**
 * AuthenticatedApp — runs for every authenticated user. Its sole job is to
 * call `getRoutingStatus()` on the backend and route to the correct shell:
 *
 *   superAdmin         → SuperAdminApp
 *   active             → AppContent
 *   noprofile          → OnboardingPage   (BUG-13 fix: NEVER "Profile Under Review")
 *   pending_approval   → PendingApprovalGate
 *   profile_pending... → ProfilePendingApprovalGate
 *
 * It also handles the preference-loading gate (BUG-15 fix): the app will not
 * render ANY content until user preferences (language, theme) have been fetched
 * from the backend so no English-flash occurs on first load.
 */
function AuthenticatedApp() {
  const { actor, isFetching: actorFetching } = useActor(createActor);
  const { isProfileDisabled } = useProfile();

  // `isLoading` from UserPreferencesContext is true until language/theme are fetched.
  // We block rendering until this is false to prevent a flash of the wrong language/theme.
  const { isLoading: isPrefsLoading } = useUserPreferences();

  // The current routing state — starts as "loading" until the backend responds
  const [routingState, setRoutingState] = useState<RoutingState>("loading");

  // `superAdminSetupDone` becomes true after the first-time setup form completes.
  // It bypasses the routing check briefly while the backend processes the new SA.
  const [superAdminSetupDone, setSuperAdminSetupDone] = useState(false);

  // Guard against calling the backend twice (React Strict Mode fires effects twice in dev)
  const fetchAttempted = useRef(false);

  // On first render (or after actor connects), fetch the routing status
  useEffect(() => {
    if (fetchAttempted.current || actorFetching || !actor) return;
    fetchAttempted.current = true;

    (async () => {
      try {
        // Step 1: check if any Super Admin exists (public call, no auth needed)
        const saExists = await actor.doesSuperAdminExist();
        if (!saExists) {
          // No Super Admin yet — must show the first-time setup screen
          setRoutingState("setup_needed");
          return;
        }
        // Step 2: ask the backend which screen this user should see
        // getRoutingStatus() is the single source of truth for all routing decisions
        const rs = await actor.getRoutingStatus();
        setRoutingState(rs);
      } catch {
        // Network error — allow a retry on the next render cycle
        fetchAttempted.current = false;
      }
    })();
  }, [actor, actorFetching]);

  // After Super Admin setup completes, re-run routing to confirm the SA role
  useEffect(() => {
    if (!superAdminSetupDone || !actor || actorFetching) return;
    // Reset the guard so the effect above can fire again
    fetchAttempted.current = false;
    setRoutingState("loading");

    // Small delay to let the backend finish processing the setup
    const timer = setTimeout(async () => {
      fetchAttempted.current = true;
      try {
        const rs = await actor.getRoutingStatus();
        setRoutingState(rs);
      } catch {
        // Fallback: assume Super Admin routing succeeded even if the check fails
        setRoutingState(RoutingStatus.superAdmin);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [superAdminSetupDone, actor, actorFetching]);

  // ── Loading gate (BUG-15 fix) ─────────────────────────────────────────────
  // Block ALL rendering until BOTH conditions are true:
  //   1. The routing state has been determined (not "loading")
  //   2. User preferences (language, theme) have been loaded from the backend
  // This prevents the flash of English labels on first load for non-English users.
  if (routingState === "loading" || isPrefsLoading) return <AppLoader />;

  // ── First-time setup ──────────────────────────────────────────────────────
  // No Super Admin exists — show the setup form. Hidden once SA is created.
  if (routingState === "setup_needed") {
    return (
      <SuperAdminSetupPage onComplete={() => setSuperAdminSetupDone(true)} />
    );
  }

  // ── Super Admin bypass (BUG-14 / BUG-06 fix) ─────────────────────────────
  // Super Admin bypasses ALL approval gates unconditionally.
  // `superAdminSetupDone` also bypasses in case the routing fetch hasn't updated yet.
  if (routingState === RoutingStatus.superAdmin || superAdminSetupDone) {
    return <SuperAdminApp />;
  }

  // ── Profile disabled check (non-Super-Admin only) ─────────────────────────
  // Check if profile is archived, disabled, or outside its active date window
  if (isProfileDisabled) return <ProfileDisabledPage />;

  // ── Route by status (non-Super-Admin users) ───────────────────────────────
  switch (routingState) {
    // Active user with an approved profile — show the main app
    case RoutingStatus.active:
      return <AppContent />;

    // BUG-13 fix: users with no profile → onboarding, NEVER "Profile Under Review"
    // `noprofile` means the user exists but has not created or joined any profile yet
    case RoutingStatus.noprofile:
      return <OnboardingPage />;

    // Staff or Referral User whose Admin has not yet approved them
    case RoutingStatus.pending_approval:
      return <PendingApprovalGate />;

    // Admin who created a new profile that the Super Admin has not yet approved
    case RoutingStatus.profile_pending_super_admin:
      return <ProfilePendingApprovalGate />;

    // Unexpected/unknown state — show loading as a safe fallback
    default:
      return <AppLoader />;
  }
}

// ── Root App component ────────────────────────────────────────────────────────

/**
 * App — the root React component rendered by main.tsx.
 *
 * Three top-level cases:
 *   1. Public index route "/" — shown without any login to anyone
 *   2. Not authenticated — show LoginPage
 *   3. Authenticated — wrap in all context providers then show AuthenticatedApp
 *
 * Provider order matters:
 *   ImpersonationProvider → provides isImpersonating to ProfileProvider
 *   ProfileProvider       → fetches user profile and exposes it to all children
 *   UserPreferencesProvider → fetches language/theme; MUST be inside ProfileProvider
 *                             because it needs the actor (which needs auth)
 */
export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  // Check if the user is on the public index/marketing page.
  // "/" shows the app's marketing page to non-users without any login prompt.
  // ROUTING NOTE: Authenticated users visiting "/" intentionally bypass this block
  // and fall through to the authenticated routing engine below — the index/marketing
  // page is for non-logged-in visitors only. Do not change this without updating the
  // product spec (index page is a public marketing surface, not an app landing page).
  const isIndexRoute =
    window.location.pathname === "/" ||
    window.location.pathname === "/index" ||
    window.location.pathname === "";

  // Public index page — no authentication required, shown to anyone
  if (isIndexRoute && !isAuthenticated && !isLoading) {
    return <IndexPage />;
  }

  // Still checking if the user is logged in — show spinner
  if (isLoading) return <AppLoader />;

  // User is definitely not logged in — show login page
  if (!isAuthenticated) return <LoginPage />;

  // User is authenticated — wrap in all providers then show the routing engine
  return (
    // ImpersonationProvider: tracks whether Super Admin is currently viewing as another role.
    // Persists impersonation state to localStorage so a page refresh doesn't reset it.
    <ImpersonationProvider>
      {/* ProfileProvider: fetches and caches the user's profile and role.
          Also applies the profile's brand color as a CSS variable overlay. */}
      <ProfileProvider>
        {/* UserPreferencesProvider: fetches language and theme before first render.
            Exposes `isLoading` which AuthenticatedApp uses to block the render gate. */}
        <UserPreferencesProvider>
          <AuthenticatedApp />
        </UserPreferencesProvider>
      </ProfileProvider>
    </ImpersonationProvider>
  );
}

// Re-export UserRole so page components don't need to import it from the backend
// module directly — they can just import it from App.tsx or types/index.ts.
export { UserRole };
