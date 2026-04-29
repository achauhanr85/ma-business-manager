/**
 * Sidebar.tsx — The left navigation sidebar for authenticated users.
 *
 * WHAT THIS FILE DOES:
 * Renders the fixed sidebar with a grouped navigation menu. The nav items shown
 * depend on the user's role and module access permissions:
 *
 *   Super Admin (not impersonating): sees only admin-specific items
 *   Super Admin (impersonating): sees items appropriate to the impersonated role
 *   Admin: sees all items for their profile
 *   Staff: sees only items for their permitted modules
 *   Referral User: sees ONLY the Customers item
 *
 * MENU GROUPING STRUCTURE:
 *   1. Order Management — Customer, Customer Goals, Medical Issues, Sales
 *   2. Purchasing       — Vendor, Purchase Order
 *   3. Inventory        — Inventory, Movement, Loaner, Stage
 *   4. Catalog          — Products & Categories
 *   5. Settings         — User Management, Preferences, Analytics
 *   6. Super Admin      — SA Dashboard, Data Inspector, Tests (SA only)
 *   7. Account          — Business Profile (all roles)
 *
 * WHO USES THIS:
 *   Layout.tsx — renders Sidebar inside the main layout wrapper
 */

import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/translations";
import { ROLES } from "@/types";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Database,
  FlaskConical,
  Goal,
  Grid3X3,
  HeartPulse,
  Leaf,
  LogOut,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  User,
  Users,
  Users2,
  X,
} from "lucide-react";

/** Props accepted by the Sidebar component */
interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MODULE_PATH_MAP — maps each module key to the route paths it controls.
 * Used to check whether a Staff member's module_access grants them a specific nav item.
 */
const MODULE_PATH_MAP: Record<string, string[]> = {
  sales: [ROUTES.sales],
  po: [ROUTES.purchaseOrders, ROUTES.vendors],
  customer: [
    ROUTES.customers,
    ROUTES.customerGoals,
    ROUTES.customerMedicalIssues,
  ],
  product: [ROUTES.products],
  inventory: [
    ROUTES.inventory,
    ROUTES.inventoryMovement,
    ROUTES.loanerInventory,
    ROUTES.stageInventory,
  ],
  analytics: [ROUTES.analytics],
};

/** Shape of a single navigation item */
interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ElementType;
  roles: readonly string[] | null;
  module: string | null;
  superAdminDisabled: boolean;
}

/** A labelled group of nav items */
interface NavSection {
  id: string;
  /** Displayed directly (no translation key needed for section headers) */
  label: string;
  items: NavItem[];
}

/**
 * NAV_SECTIONS — the full navigation structure.
 *
 * IMPORTANT: Each item appears EXACTLY ONCE — no duplicates.
 * Sections with no visible items (after permission filtering) are hidden.
 */
const NAV_SECTIONS: NavSection[] = [
  // ── 1. Order Management ──────────────────────────────────────────────────
  {
    id: "order-management",
    label: "Order Management",
    items: [
      {
        labelKey: "nav.customers",
        path: ROUTES.customers,
        icon: Users,
        roles: [ROLES.ADMIN, ROLES.STAFF, ROLES.REFERRAL_USER],
        module: "customer",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.customerGoals",
        path: ROUTES.customerGoals,
        icon: Goal,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "customer",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.medicalIssues",
        path: ROUTES.customerMedicalIssues,
        icon: HeartPulse,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "customer",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.sales",
        path: ROUTES.sales,
        icon: ShoppingCart,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "sales",
        superAdminDisabled: true,
      },
    ],
  },

  // ── 2. Purchasing ─────────────────────────────────────────────────────────
  {
    id: "purchasing",
    label: "Purchasing",
    items: [
      {
        // Vendor management — suppliers for purchase orders
        labelKey: "nav.vendors",
        path: ROUTES.vendors,
        icon: Building2,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "po",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.purchaseOrders",
        path: ROUTES.purchaseOrders,
        icon: ClipboardList,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "po",
        superAdminDisabled: true,
      },
    ],
  },

  // ── 3. Inventory ──────────────────────────────────────────────────────────
  {
    id: "inventory",
    label: "Inventory",
    items: [
      {
        labelKey: "nav.inventory",
        path: ROUTES.inventory,
        icon: Boxes,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.inventoryMovement",
        path: ROUTES.inventoryMovement,
        icon: ArrowRightLeft,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.loanerInventory",
        path: ROUTES.loanerInventory,
        icon: Package,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        // Stage Inventory — returned items pending Admin/Staff review
        labelKey: "nav.stageInventory",
        path: ROUTES.stageInventory,
        icon: ClipboardCheck,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
    ],
  },

  // ── 4. Catalog ────────────────────────────────────────────────────────────
  // Products and Categories are on the same page (tabs).
  // "Product" opens /products (defaults to Products tab).
  // "Category" opens /products?tab=categories (pre-selects the Categories tab).
  {
    id: "catalog",
    label: "Catalog",
    items: [
      {
        // Product — opens the products tab of the Products & Categories page
        labelKey: "nav.productsOnly",
        path: ROUTES.products,
        icon: Tag,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "product",
        superAdminDisabled: true,
      },
      {
        // Category — opens the categories tab of the Products & Categories page
        labelKey: "nav.categories",
        path: ROUTES.categories,
        icon: Grid3X3,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "product",
        superAdminDisabled: true,
      },
    ],
  },

  // ── 5. Settings ───────────────────────────────────────────────────────────
  {
    id: "settings",
    label: "Settings",
    items: [
      {
        // User Management — Admin only
        labelKey: "nav.userManagement",
        path: ROUTES.userManagement,
        icon: Users2,
        roles: [ROLES.ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        // Preferences — all roles can access their own preferences
        labelKey: "nav.userPreferences",
        path: ROUTES.userPreferences,
        icon: Settings,
        roles: null,
        module: null,
        superAdminDisabled: false,
      },
      {
        // Analytics — Admin-scoped KPI and reporting
        labelKey: "nav.analytics",
        path: ROUTES.analytics,
        icon: BarChart3,
        roles: [ROLES.ADMIN],
        module: "analytics",
        superAdminDisabled: true,
      },
    ],
  },

  // ── 6. Super Admin ────────────────────────────────────────────────────────
  // `superAdminDisabled: false` means SA CAN see these items even without impersonating.
  {
    id: "super-admin-tools",
    label: "Super Admin",
    items: [
      {
        labelKey: "nav.superAdmin",
        path: ROUTES.superAdmin,
        icon: Shield,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        // Profile Approvals — Super Admin approves/rejects new profile registrations
        labelKey: "nav.profileApprovals",
        path: ROUTES.profileApprovals,
        icon: ClipboardCheck,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        labelKey: "nav.dataInspector",
        path: ROUTES.dataInspector,
        icon: Database,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        labelKey: "nav.adminTests",
        path: ROUTES.adminTests,
        icon: FlaskConical,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
    ],
  },

  // ── 7. Account ────────────────────────────────────────────────────────────
  {
    id: "account",
    label: "Account",
    items: [
      {
        labelKey: "nav.profile",
        path: ROUTES.profile,
        icon: User,
        roles: null,
        module: null,
        superAdminDisabled: false,
      },
    ],
  },
];

/**
 * filterItem — determines whether a nav item should be visible for the current user.
 *
 * Rules in order:
 *   1. Referral users see ONLY /customers
 *   2. Role restriction — if `item.roles` is set, user's role must be in the list
 *   3. Super Admin + not impersonating: hide items marked `superAdminDisabled`
 *   4. Staff module access — if `item.module` is set and user is Staff, check module_access
 */
function filterItem(
  item: NavItem,
  effectiveRole: string | undefined,
  isSuperAdmin: boolean,
  isImpersonating: boolean,
  moduleAccess: string[] | null,
): boolean {
  // Referral users are restricted to the Customers page only
  if (effectiveRole === ROLES.REFERRAL_USER) {
    return item.path === ROUTES.customers;
  }

  // Role restriction check — if roles array is set, user must have a matching role
  if (item.roles) {
    if (!effectiveRole) return false;
    if (!(item.roles as readonly string[]).includes(effectiveRole))
      return false;
  }

  // Super Admin sees operational items ONLY when impersonating a profile
  if (isSuperAdmin && !isImpersonating && item.superAdminDisabled) {
    return false;
  }

  // Staff module access check — only applies to Staff users (Admins bypass this)
  if (item.module && moduleAccess !== null && effectiveRole === ROLES.STAFF) {
    const modulePaths = MODULE_PATH_MAP[item.module] ?? [];
    const allowed =
      moduleAccess.some((mod) =>
        (MODULE_PATH_MAP[mod] ?? []).some((p) => modulePaths.includes(p)),
      ) || moduleAccess.includes(item.module);
    if (!allowed) return false;
  }

  return true;
}

/**
 * resolveLabel — resolves a dot-path translation key into the matching string.
 * e.g. "nav.dashboard" → looks up t["nav"]["dashboard"] → "Dashboard"
 * Falls back to the key itself if the path doesn't resolve.
 */
function resolveLabel(t: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let obj: unknown = t;
  for (const p of parts) {
    if (typeof obj !== "object" || obj === null) return key;
    obj = (obj as Record<string, unknown>)[p];
  }
  return typeof obj === "string" ? obj : key;
}

/**
 * Sidebar — renders the navigation sidebar with grouped, filtered menu items.
 * Fixed on desktop, toggled as an overlay on mobile.
 */
export function Sidebar({
  currentPath,
  onNavigate,
  isOpen,
  onClose,
}: SidebarProps) {
  const { logout } = useAuth();
  const { profile, userProfile } = useProfile();
  const { isImpersonating, impersonateAsRole } = useImpersonation();
  const t = useTranslation();

  // Current role from the user's profile record
  const currentRole = userProfile?.role;
  const isSuperAdmin = currentRole === ROLES.SUPER_ADMIN;

  // Parse the `module_access` field (stored as comma-separated string) into an array.
  // null = no module restrictions (Admin/SA bypass module filtering anyway)
  const moduleAccess: string[] | null = userProfile?.module_access
    ? userProfile.module_access
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : null;

  // While impersonating, use the impersonated role for filtering instead of Super Admin
  const effectiveRole = isImpersonating
    ? impersonateAsRole
    : (currentRole as string | undefined);

  /** handleNav — navigate to a path AND close the mobile overlay */
  const handleNav = (path: string) => {
    onNavigate(path);
    onClose();
  };

  // Cast translation to plain record for resolveLabel traversal
  const tExt = t as Record<string, unknown>;

  return (
    <>
      {/* Mobile overlay — dim background behind the open sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyUp={(e) => e.key === "Escape" && onClose()}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        data-ocid="sidebar"
      >
        {/* ── Logo header ── */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          <button
            type="button"
            onClick={() => handleNav(ROUTES.dashboard)}
            className="flex items-center gap-2 hover:opacity-80 transition-smooth"
            data-ocid="sidebar.logo_link"
          >
            {profile?.logo_url ? (
              <img
                src={profile.logo_url}
                alt={profile.business_name}
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Leaf className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
            )}
            <div className="flex flex-col leading-none">
              <span className="font-display font-semibold text-sidebar-foreground text-sm truncate max-w-[120px]">
                {profile?.business_name ?? "Indi Negocio"}
              </span>
              <span className="text-sidebar-accent-foreground text-[10px] opacity-60">
                Indi Negocio Livre
              </span>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-7 w-7"
            onClick={onClose}
            aria-label="Close sidebar"
            data-ocid="sidebar.close_button"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* ── User info strip ── */}
        {userProfile && (
          <div className="px-4 py-2.5 border-b border-sidebar-border bg-sidebar-accent/30">
            <p className="text-xs text-sidebar-accent-foreground">
              {userProfile.display_name}
            </p>
            {userProfile.warehouse_name && (
              <p className="text-[11px] font-medium text-sidebar-primary truncate mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                {userProfile.warehouse_name}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sidebar-primary/10 text-sidebar-primary capitalize">
                {currentRole === ROLES.SUPER_ADMIN
                  ? "Super Admin"
                  : currentRole === ROLES.ADMIN
                    ? "Admin"
                    : "Staff"}
              </span>
              {isImpersonating && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 capitalize">
                  as {impersonateAsRole}
                </span>
              )}
              {userProfile.approval_status === "pending" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-700">
                  Pending
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Navigation sections ── */}
        <nav
          className="flex-1 py-2 overflow-y-auto"
          aria-label="Main navigation"
        >
          {NAV_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) =>
              filterItem(
                item,
                effectiveRole,
                isSuperAdmin,
                isImpersonating,
                moduleAccess,
              ),
            );

            // Hide entire section if no items are visible
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.id} className="mb-1">
                <div className="px-4 pt-3 pb-1">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-accent-foreground/55"
                    data-ocid={`sidebar.section.${section.id}`}
                  >
                    {section.label}
                  </span>
                </div>
                <ul className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      currentPath === item.path ||
                      currentPath.startsWith(`${item.path}/`);
                    const label = resolveLabel(tExt, item.labelKey);
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          onClick={() => handleNav(item.path)}
                          data-ocid={`sidebar.nav.${item.path.replace(/\//g, "").replace(/-/g, "_")}_link`}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth text-left",
                            isActive
                              ? "bg-sidebar-primary/10 text-sidebar-primary"
                              : "text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                          )}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4 flex-shrink-0",
                              isActive && "text-sidebar-primary",
                            )}
                          />
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ── Logout button ── */}
        <div className="px-2 py-3 border-t border-sidebar-border">
          <button
            type="button"
            onClick={logout}
            data-ocid="sidebar.logout_button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-accent-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {t.nav.logout}
          </button>
        </div>
      </aside>
    </>
  );
}
