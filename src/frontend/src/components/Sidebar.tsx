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
 * The sidebar is:
 *   - Fixed on desktop (always visible, main content shifts right via lg:ml-64)
 *   - Overlay on mobile (hidden by default, toggled by hamburger button in Header)
 *
 * NAVIGATION GROUPING:
 * Items are grouped into sections: Main, Sales, Customers, Inventory, Catalog, Admin.
 * Sections with no visible items (after permission filtering) are hidden.
 *
 * VENDOR MENU ENTRY:
 * The Vendors entry is in the "Sales" section under the "po" module.
 * It is visible to Admin and Staff who have PO module access.
 *
 * WHO USES THIS:
 *   Layout.tsx — renders Sidebar inside the main layout wrapper
 */

import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/translations";
import { ROLES } from "@/types";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Database,
  FlaskConical,
  Goal,
  HeartPulse,
  LayoutDashboard,
  Leaf,
  LogOut,
  Package,
  Settings,
  Shield,
  ShoppingCart,
  Store,
  Tag,
  User,
  Users,
  X,
} from "lucide-react";

/** Props accepted by the Sidebar component */
interface SidebarProps {
  /** The current active route — used to highlight the matching nav item */
  currentPath: string;
  /** Called when a nav item is clicked with its target path */
  onNavigate: (path: string) => void;
  /** Whether the mobile overlay sidebar is open */
  isOpen: boolean;
  /** Called to close the mobile overlay sidebar */
  onClose: () => void;
}

/**
 * MODULE_PATH_MAP — maps each module key to the route paths it controls.
 * Used to check whether a Staff member's module_access grants them a specific nav item.
 *
 * Example: A staff member with module_access = "sales,customer" can see:
 *   /sales, /customers, /customer-goals, /customer-medical-issues
 * But NOT /inventory, /purchase-orders, etc.
 */
const MODULE_PATH_MAP: Record<string, string[]> = {
  sales: ["/sales"],
  po: ["/purchase-orders", "/vendors"],
  customer: ["/customers", "/customer-goals", "/customer-medical-issues"],
  product: ["/products"],
  inventory: [
    "/inventory",
    "/inventory-movement",
    "/loaner-inventory",
    "/stage-inventory",
  ],
  analytics: ["/analytics"],
};

/** Shape of a single navigation item */
interface NavItem {
  /** Dot-path into the translation object, e.g. "nav.dashboard" */
  labelKey: string;
  /** The route this item navigates to */
  path: string;
  /** Lucide icon component to display */
  icon: React.ElementType;
  /**
   * Role restriction — if set, only users with one of these roles see this item.
   * null = no role restriction (visible to any non-referral user who passes module check)
   */
  roles: readonly string[] | null;
  /**
   * Module key restriction — if set, Staff users must have this module in their
   * module_access field. Admins ignore this check.
   * null = no module restriction
   */
  module: string | null;
  /**
   * If true, this item is hidden from Super Admin when NOT impersonating.
   * Operational pages (sales, inventory, etc.) should be true.
   * Admin-only pages (super-admin, tests, data-inspector) should be false.
   */
  superAdminDisabled: boolean;
}

/** A labelled group of nav items */
interface NavSection {
  /** Unique ID for this section — used as a key and for data-ocid */
  id: string;
  /** Translation key for the section label */
  labelKey: string;
  items: NavItem[];
}

/**
 * NAV_SECTIONS — the full navigation structure.
 *
 * IMPORTANT: Each item appears EXACTLY ONCE — no duplicates.
 * Sections are filtered at render time so empty sections are hidden.
 *
 * Vendor is in the "sales" section under module "po" — visible to Admin/Staff with PO access.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    id: "main",
    labelKey: "sectionMain",
    items: [
      {
        labelKey: "nav.dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        roles: null, // visible to all roles
        module: null,
        superAdminDisabled: false, // Super Admin sees Dashboard
      },
      {
        labelKey: "nav.profile",
        path: "/profile",
        icon: User,
        roles: null,
        module: null,
        superAdminDisabled: false, // Super Admin can view their own profile
      },
    ],
  },
  {
    id: "sales",
    labelKey: "sectionSales",
    items: [
      {
        labelKey: "nav.sales",
        path: "/sales",
        icon: ShoppingCart,
        roles: null,
        module: "sales",
        superAdminDisabled: true, // Super Admin cannot create sales (unless impersonating)
      },
      {
        labelKey: "nav.purchaseOrders",
        path: "/purchase-orders",
        icon: ClipboardList,
        roles: null,
        module: "po",
        superAdminDisabled: true,
      },
      {
        // Vendor management — appears under Sales/PO section because vendors supply POs
        labelKey: "nav.vendors",
        path: "/vendors",
        icon: Store,
        roles: [ROLES.ADMIN, ROLES.STAFF], // only Admin and Staff see Vendors
        module: "po",
        superAdminDisabled: true,
      },
    ],
  },
  {
    id: "customers",
    labelKey: "sectionCustomers",
    items: [
      {
        labelKey: "nav.customers",
        path: "/customers",
        icon: Users,
        roles: null,
        module: "customer",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.customerGoals",
        path: "/customer-goals",
        icon: Goal,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "customer",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.medicalIssues",
        path: "/customer-medical-issues",
        icon: HeartPulse,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "customer",
        superAdminDisabled: true,
      },
    ],
  },
  {
    id: "inventory",
    labelKey: "sectionInventory",
    items: [
      {
        labelKey: "nav.inventory",
        path: "/inventory",
        icon: Boxes,
        roles: null,
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.inventoryMovement",
        path: "/inventory-movement",
        icon: ArrowRightLeft,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.loanerInventory",
        path: "/loaner-inventory",
        icon: Package,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        // Stage Inventory — returned items waiting for Admin/Staff review
        // Accessible by BOTH Admin and Staff (BUG-08 fix)
        labelKey: "nav.stageInventory",
        path: "/stage-inventory",
        icon: ClipboardCheck,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
    ],
  },
  {
    id: "catalog",
    labelKey: "sectionCatalog",
    items: [
      {
        labelKey: "nav.products",
        path: "/products",
        icon: Tag,
        roles: null,
        module: "product",
        superAdminDisabled: true,
      },
      {
        labelKey: "nav.analytics",
        path: "/analytics",
        icon: BarChart3,
        roles: null,
        module: "analytics",
        superAdminDisabled: true,
      },
    ],
  },
  {
    id: "admin",
    labelKey: "sectionAdmin",
    items: [
      {
        labelKey: "nav.userManagement",
        path: "/user-management",
        icon: Users,
        roles: [ROLES.ADMIN], // only Admin can manage team members
        module: null,
        superAdminDisabled: false,
      },
      {
        labelKey: "nav.userPreferences",
        path: "/user-preferences",
        icon: Settings,
        roles: null, // all roles can access preferences
        module: null,
        superAdminDisabled: false,
      },
      {
        // Super Admin dashboard — only Super Admin sees this
        labelKey: "nav.superAdmin",
        path: "/super-admin",
        icon: Shield,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        // Regression test suite — Super Admin only, hidden link
        labelKey: "nav.adminTests",
        path: "/admin/tests",
        icon: FlaskConical,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        // Raw data inspector — Super Admin only
        labelKey: "nav.dataInspector",
        path: "/data-inspector",
        icon: Database,
        roles: [ROLES.SUPER_ADMIN],
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
  if (effectiveRole === "referralUser") {
    return item.path === "/customers";
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

  // Section label strings — English fallbacks for when translations aren't loaded yet
  const sectionLabels: Record<string, string> = {
    sectionMain: "Main",
    sectionSales: "Sales",
    sectionCustomers: "Customers",
    sectionInventory: "Inventory",
    sectionCatalog: "Catalog",
    sectionAdmin: "Admin",
  };

  // Merge translation object with section labels so `resolveLabel` can find them
  const tExt = { ...t, ...sectionLabels } as Record<string, unknown>;

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
          // On desktop: always visible (no transform needed)
          "lg:translate-x-0 lg:z-auto",
          // On mobile: slide in/out based on isOpen
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        data-ocid="sidebar"
      >
        {/* ── Logo header ── */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-sidebar-border">
          {/* Clicking the logo/name navigates to Dashboard */}
          <button
            type="button"
            onClick={() => handleNav("/dashboard")}
            className="flex items-center gap-2 hover:opacity-80 transition-smooth"
            data-ocid="sidebar.logo_link"
          >
            {/* Show profile logo if available, otherwise show the leaf icon */}
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
          {/* Close button — only shown on mobile */}
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
        {/* Shows display name, warehouse (for Staff), role badge, and approval status */}
        {userProfile && (
          <div className="px-4 py-2.5 border-b border-sidebar-border bg-sidebar-accent/30">
            <p className="text-xs text-sidebar-accent-foreground">
              {userProfile.display_name}
            </p>
            {/* Warehouse name — only Staff users are assigned to a specific warehouse */}
            {userProfile.warehouse_name && (
              <p className="text-[11px] font-medium text-sidebar-primary truncate mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sidebar-primary" />
                {userProfile.warehouse_name}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {/* Role badge */}
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sidebar-primary/10 text-sidebar-primary capitalize">
                {currentRole === ROLES.SUPER_ADMIN
                  ? "Super Admin"
                  : currentRole === ROLES.ADMIN
                    ? "Admin"
                    : "Staff"}
              </span>
              {/* Impersonation badge — only shown when Super Admin is viewing as another role */}
              {isImpersonating && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 capitalize">
                  as {impersonateAsRole}
                </span>
              )}
              {/* Pending approval badge — reminds staff their account needs approval */}
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
            // Filter items to only those visible for the current user/role
            const visibleItems = section.items.filter((item) =>
              filterItem(
                item,
                effectiveRole,
                isSuperAdmin,
                isImpersonating,
                moduleAccess,
              ),
            );

            // If no items are visible in this section, hide the entire section header too
            if (visibleItems.length === 0) return null;

            const sectionLabel =
              sectionLabels[section.labelKey] ?? section.labelKey;

            return (
              <div key={section.id} className="mb-1">
                {/* Section heading — small uppercase label */}
                <div className="px-4 pt-3 pb-1">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-accent-foreground/55"
                    data-ocid={`sidebar.section.${section.id}`}
                  >
                    {sectionLabel}
                  </span>
                </div>
                {/* Section nav items */}
                <ul className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    // Highlight when current path matches this item's path
                    const isActive =
                      currentPath === item.path ||
                      currentPath.startsWith(`${item.path}/`);
                    // Resolve the translated label for this item
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
