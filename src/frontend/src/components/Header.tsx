/**
 * Header.tsx — Sticky top bar shown on every authenticated page.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RENDER FLOW:
 *   1. useGetUserProfile() — freshest data from React Query
 *   2. Falls back to useProfile() context value (may be slightly stale)
 *   3. resolvedProfile = userProfileData ?? userProfile
 *   4. Derive displayName, role, moduleAccess from resolvedProfile
 *   5. isSuperAdmin + isImpersonating → showOperationalIcons computed
 *   6. hasModuleAccess() called for each quick-action icon
 *   7. Icons rendered conditionally based on access
 *
 * PERMISSION CHECK FLOW (hasModuleAccess):
 *   role === ADMIN or SUPER_ADMIN → always true (full access)
 *   role === STAFF → parse moduleAccess JSON or CSV string → check module key
 *   role === REFERRAL_USER → covered by Sidebar (only Customers accessible)
 *
 * SUPER ADMIN ICON VISIBILITY FLOW:
 *   isSuperAdmin + !isImpersonating → showOperationalIcons = false
 *     → all create/action icons hidden (SA uses their own dashboard)
 *   isSuperAdmin + isImpersonating → showOperationalIcons = true
 *     → SA sees the same icons as the impersonated role
 *
 * NAVIGATION FLOW:
 *   User clicks quick-action icon → nav(path) called
 *   → onNavigate(path) prop called → router navigates
 *
 * DIAGNOSTIC LOGGING:
 *   TRACE (0): variable initialization (displayName, role, permissions)
 *   DEBUG (1): function entry, nav() called with path
 *   WARN  (3): role check failures, missing moduleAccess
 *
 * WHO USES THIS:
 *   Layout.tsx — renders Header at the top of every authenticated page
 */

import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useGetUserProfile } from "@/hooks/useBackend";
import { logDebug, logTrace, logWarn } from "@/lib/logger";
import { useTranslation } from "@/translations";
import { ROLES } from "@/types";
import {
  BookOpen,
  ClipboardList,
  Home,
  Leaf,
  Menu,
  Package,
  ShoppingCart,
  UserPlus,
} from "lucide-react";
import { NotificationsBellButton } from "./NotificationsPanel";

interface HeaderProps {
  onMenuToggle: () => void;
  pageTitle: string;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  onNavigate?: (path: string) => void;
  onHelpOpen?: () => void;
}

/**
 * hasModuleAccess — checks whether the user has access to a given module.
 *
 * FLOW:
 *   1. Admin or Super Admin → return true (full access, no module restriction)
 *   2. No moduleAccess string → return false (Staff with no permissions)
 *   3. Parse moduleAccess: try JSON array first, fall back to CSV split
 *   4. Return true if module key is in the parsed list
 *
 * VARIABLE INITIALIZATION:
 *   modules: string[] — parsed from moduleAccess JSON or CSV
 *
 * @param moduleAccess - The user's module_access field from their profile
 * @param role         - The user's role string
 * @param module       - The module key to check (e.g. "sales", "po", "customer")
 */
function hasModuleAccess(
  moduleAccess: string | undefined | null,
  role: string | undefined | null,
  module: string,
): boolean {
  // Admins and Super Admins always have full access
  if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) return true;
  if (!moduleAccess) {
    logWarn("hasModuleAccess: no moduleAccess for non-admin user", {
      role,
      module,
    });
    return false;
  }
  // Parse module_access — try JSON first, fall back to CSV
  let modules: string[];
  try {
    const parsed = JSON.parse(moduleAccess);
    modules = Array.isArray(parsed) ? parsed.map((m: string) => m.trim()) : [];
  } catch {
    modules = moduleAccess.split(",").map((m) => m.trim());
  }
  // TRACE: variable initialization for parsed modules
  logTrace("hasModuleAccess: parsed modules", { modules, module });
  return modules.includes(module);
}

/**
 * Header — the sticky top bar rendered by Layout on every page.
 */
export function Header({
  onMenuToggle,
  pageTitle,
  notificationCount = 0,
  onNotificationsClick,
  onNavigate,
  onHelpOpen,
}: HeaderProps) {
  logDebug("Entering Header render", { pageTitle });

  // Freshest data from React Query; context value as fallback
  const { data: userProfileData } = useGetUserProfile();
  const { userProfile } = useProfile();
  const { isImpersonating } = useImpersonation();
  const t = useTranslation();

  // Use the freshest available profile data
  const resolvedProfile = userProfileData ?? userProfile;

  // TRACE: variable initialization for display values
  const displayName = resolvedProfile?.display_name?.trim() || "User";
  const role = resolvedProfile?.role as string | undefined;
  const moduleAccess = resolvedProfile?.module_access;

  logTrace("Header: resolved user data", {
    displayName,
    role,
    hasModuleAccess: !!moduleAccess,
  });

  /**
   * isSuperAdmin — true when the current user is Super Admin.
   * FLOW: SA + not impersonating → hide all operational icons
   *       SA + impersonating → show icons for impersonated role
   */
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const showOperationalIcons = !isSuperAdmin || isImpersonating;

  logTrace("Header: permission flags", {
    isSuperAdmin,
    isImpersonating,
    showOperationalIcons,
  });

  // Avatar initials from the display name (up to 2 words)
  // e.g. "Ankit Chauhan" → "AC", "Staff One" → "SO"
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Permission checks for each quick-action icon
  // TRACE: computed access flags
  const canSales =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "sales");
  const canCustomer =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "customer");
  const canPO =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "po");
  const canInventory =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "inventory");

  logTrace("Header: icon access flags", {
    canSales,
    canCustomer,
    canPO,
    canInventory,
  });

  /** Safe navigate — handles case where onNavigate prop is not provided */
  function nav(path: string) {
    logDebug("Header: navigating", { path });
    if (onNavigate) {
      onNavigate(path);
    }
  }

  function handleNotificationsClick() {
    logDebug("Header: notifications bell clicked");
    if (onNotificationsClick) {
      onNotificationsClick();
    }
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-card border-b border-border shadow-xs"
      data-ocid="header"
    >
      {/* ── Left: menu toggle + logo + page title ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger — only on mobile/tablet */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8 flex-shrink-0"
          onClick={onMenuToggle}
          aria-label="Toggle sidebar"
          data-ocid="header.menu_toggle"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* App logo mark — desktop only (sidebar has it on mobile) */}
        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        </div>

        {/* Current page title — truncated if too long */}
        <h1 className="text-base font-semibold font-display text-foreground truncate">
          {pageTitle}
        </h1>
      </div>

      {/* ── Right: quick-action icons + bell + help + user ── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Home — always visible, navigates to /dashboard */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => nav("/dashboard")}
          aria-label={t.nav.dashboard}
          data-ocid="header.home_button"
          title={t.nav.dashboard}
        >
          <Home className="w-4 h-4" />
        </Button>

        {/* Inventory — visible only when user has inventory module access */}
        {canInventory && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/inventory")}
            aria-label={t.nav.inventory}
            data-ocid="header.inventory_button"
            title={t.nav.inventory}
          >
            <Package className="w-4 h-4" />
          </Button>
        )}

        {/* Create Customer — visible only when user has customer module access */}
        {canCustomer && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/customers")}
            aria-label={t.customers.addCustomer}
            data-ocid="header.create_customer_button"
            title={t.customers.addCustomer}
          >
            <UserPlus className="w-4 h-4" />
          </Button>
        )}

        {/* Create PO — visible only when user has PO module access */}
        {canPO && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/purchase-orders")}
            aria-label={t.pos.createPO}
            data-ocid="header.create_po_button"
            title={t.pos.createPO}
          >
            <ClipboardList className="w-4 h-4" />
          </Button>
        )}

        {/* Create Sale — visible only when user has sales module access */}
        {canSales && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/sales")}
            aria-label={t.sales.title}
            data-ocid="header.create_so_button"
            title={t.sales.title}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        )}

        {/* Notification bell with unread badge — always visible */}
        <NotificationsBellButton
          unreadCount={notificationCount}
          onClick={handleNotificationsClick}
        />

        {/* Help icon — opens the page-aware help panel */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            logDebug("Header: help button clicked");
            onHelpOpen?.();
          }}
          aria-label={t.nav.help}
          data-ocid="header.help_button"
          title={t.nav.help}
        >
          <BookOpen className="w-4 h-4" />
        </Button>

        {/* User avatar + display name — shows the PERSON's name, not the business name */}
        <div className="flex items-center gap-2 pl-1 border-l border-border ml-1">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center border border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">
              {initials || "U"}
            </span>
          </div>
          <span
            className="hidden sm:block text-sm text-muted-foreground max-w-[120px] truncate"
            data-ocid="header.user_name"
            title={displayName}
          >
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
