/**
 * Header.tsx — Sticky top bar shown on every authenticated page.
 *
 * WHAT THIS FILE DOES:
 * The header contains:
 *   - Left: hamburger menu toggle (mobile only) + app logo + page title
 *   - Right: quick-action icon buttons + notification bell + help icon + user name
 *
 * QUICK-ACTION ICONS:
 * Each icon is only shown if the user has access to that module. The icons are:
 *   Home        — always visible, navigates to /dashboard
 *   Inventory   — visible if user has inventory module access
 *   Customer    — visible if user has customer module access
 *   PO          — visible if user has purchase order module access
 *   Sale        — visible if user has sales module access
 *   Notification bell — always visible, shows unread count badge
 *   Help        — always visible, opens the help panel
 *   User name   — always visible, shows the logged-in user's display name (NOT profile name)
 *
 * Super Admin: all operational icons are hidden UNLESS they are currently impersonating.
 * This prevents Super Admin from accidentally navigating to data pages from their own dashboard.
 *
 * WHO USES THIS:
 *   Layout.tsx — renders Header at the top of every page
 */

import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useGetUserProfile } from "@/hooks/useBackend";
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

/** Props accepted by the Header component */
interface HeaderProps {
  /** Called when the hamburger menu icon is clicked on mobile */
  onMenuToggle: () => void;
  /** Human-readable page title shown in the centre/left of the header */
  pageTitle: string;
  /** Number of unread notifications — drives the badge on the bell icon */
  notificationCount?: number;
  /** Called when the bell icon is clicked — opens the notifications panel */
  onNotificationsClick?: () => void;
  /** Called when any quick-action icon is clicked with the target route path */
  onNavigate?: (path: string) => void;
  /** Called when the help icon is clicked — opens the help panel */
  onHelpOpen?: () => void;
}

/**
 * hasModuleAccess — checks whether the user has access to a given module.
 * Admins and Super Admins always have access to everything.
 * Staff access is controlled by the `module_access` field on their user profile.
 *
 * `moduleAccess` is a JSON array string or comma-separated string of module keys
 * e.g. `["sales","customer","inventory"]` or `"sales,customer"`.
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
  // Admins and Super Admins always have full access — no restriction needed
  if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) return true;
  if (!moduleAccess) return false;
  // Parse the module_access field — try JSON first, fall back to comma-split
  let modules: string[];
  try {
    const parsed = JSON.parse(moduleAccess);
    modules = Array.isArray(parsed) ? parsed.map((m: string) => m.trim()) : [];
  } catch {
    modules = moduleAccess.split(",").map((m) => m.trim());
  }
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
  // Try the React Query hook first — it returns the freshest data.
  // Fall back to the context value which may be slightly stale after an update.
  const { data: userProfileData } = useGetUserProfile();
  const { userProfile } = useProfile();
  const { isImpersonating } = useImpersonation();
  const t = useTranslation();

  // Use the freshest available profile data
  const resolvedProfile = userProfileData ?? userProfile;
  // Display name falls back to "User" if empty — this is the PERSON's name, not the business name
  const displayName = resolvedProfile?.display_name?.trim() || "User";
  const role = resolvedProfile?.role as string | undefined;
  const moduleAccess = resolvedProfile?.module_access;

  // Super Admin: hide all operational create icons unless they are impersonating a profile.
  // When impersonating, they should see the same icons a normal user would see.
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const showOperationalIcons = !isSuperAdmin || isImpersonating;

  // Generate avatar initials from the display name (up to 2 words)
  // e.g. "Ankit Chauhan" → "AC", "Staff One" → "SO"
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Permission checks for each quick-action icon — uses hasModuleAccess() helper above
  const canSales =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "sales");
  const canCustomer =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "customer");
  const canPO =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "po");
  const canInventory =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "inventory");

  /** Safe navigate — handles case where onNavigate prop is not provided */
  function nav(path: string) {
    if (onNavigate) {
      onNavigate(path);
    }
  }

  /** Safe notifications click — handles case where onNotificationsClick is not provided */
  function handleNotificationsClick() {
    if (onNotificationsClick) {
      onNotificationsClick();
    }
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-card border-b border-border shadow-xs"
      data-ocid="header"
    >
      {/* ── Left section: menu toggle + logo + page title ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Hamburger button — only visible on mobile/tablet (hidden on lg+) */}
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

        {/* App logo mark — only shown on desktop (sidebar shows it on mobile) */}
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

      {/* ── Right section: quick-action icons + bell + help + user ── */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Home — always visible to all roles, navigates to /dashboard */}
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

        {/* Inventory icon — visible only when user has inventory module access */}
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

        {/* Create Customer icon — visible only when user has customer module access */}
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

        {/* Create Purchase Order icon — visible only when user has PO module access */}
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

        {/* Create Sale icon — visible only when user has sales module access */}
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
          onClick={() => onHelpOpen?.()}
          aria-label={t.nav.help}
          data-ocid="header.help_button"
          title={t.nav.help}
        >
          <BookOpen className="w-4 h-4" />
        </Button>

        {/* User avatar + display name — shows the PERSON's name, NOT the business name */}
        <div className="flex items-center gap-2 pl-1 border-l border-border ml-1">
          {/* Avatar circle with initials — used instead of a photo */}
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center border border-border flex-shrink-0">
            <span className="text-xs font-semibold text-primary">
              {initials || "U"}
            </span>
          </div>
          {/* Display name — hidden on very small screens to save space */}
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
