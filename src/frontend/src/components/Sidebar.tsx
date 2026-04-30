/**
 * Sidebar.tsx — The left navigation sidebar for authenticated users.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * PAGE FLOW
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * RENDER FLOW:
 *   1. Read: currentRole from useProfile(), isImpersonating from useImpersonation()
 *   2. Parse moduleAccess field (CSV string → string[] or null for Admin/SA)
 *   3. effectiveRole = isImpersonating ? impersonateAsRole : currentRole
 *      (SA impersonating as staff → sees staff nav items)
 *   4. For each NAV_SECTION: filter items via filterItem()
 *   5. Hide entire section if no visible items remain after filtering
 *   6. Render visible sections and items
 *
 * FILTERING FLOW (filterItem):
 *   - Referral users: only /customers allowed
 *   - Role restriction: item.roles must include effectiveRole
 *   - Super Admin + not impersonating: skip items marked superAdminDisabled
 *   - Staff module access: check moduleAccess array against item.module
 *
 * NAVIGATION FLOW:
 *   User clicks nav item → handleNav(path) called
 *   → onNavigate(path) prop called → router navigates
 *   → onClose() called → mobile sidebar overlay closes
 *
 * LOGOUT FLOW:
 *   User clicks Logout → logout() called
 *   → Internet Identity session cleared
 *   → isAuthenticated = false → App.tsx shows login view
 *
 * DIAGNOSTIC LOGGING:
 *   TRACE (0): module access parsing, effective role computation
 *   DEBUG (1): function entry, nav events, filter decisions
 *   INFO  (2): logout initiated
 *   WARN  (3): item filtered out for unexpected reasons
 *
 * WHO USES THIS:
 *   Layout.tsx — renders Sidebar inside the main layout wrapper
 */

import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { logDebug, logInfo, logTrace } from "@/lib/logger";
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
  FileText,
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

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * MODULE_PATH_MAP — maps each module key to the route paths it controls.
 * Used to check whether a Staff member's module_access grants a specific nav item.
 *
 * VARIABLE INITIALIZATION:
 *   Each key is a module name (e.g. "sales", "po", "customer").
 *   Each value is an array of route paths that module controls.
 */
const MODULE_PATH_MAP: Record<string, string[]> = {
  sales: [ROUTES.sales, ROUTES.salesSummary],
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

interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ElementType;
  /** null = visible to all roles */
  roles: readonly string[] | null;
  /** null = no module restriction */
  module: string | null;
  /** true = hide for SA when not impersonating */
  superAdminDisabled: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * NAV_SECTIONS — the full navigation structure.
 *
 * MENU GROUPING (per spec):
 *   1. Order Management — Customer, Customer Goals, Medical Issues, Sales, Sales Summary
 *   2. Purchasing       — Vendor, Purchase Order
 *   3. Inventory        — Inventory, Movement, Loaner, Stage
 *   4. Catalog          — Products, Categories
 *   5. Settings         — User Management, Preferences, Analytics
 *   6. Super Admin      — SA Dashboard, Profile Approvals, Data Inspector, Tests
 *   7. Account          — Business Profile
 *
 * IMPORTANT: Each item appears EXACTLY ONCE — no duplicates across sections.
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
      {
        labelKey: "nav.salesSummary",
        path: ROUTES.salesSummary,
        icon: FileText,
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
  {
    id: "catalog",
    label: "Catalog",
    items: [
      {
        labelKey: "nav.productsOnly",
        path: ROUTES.products,
        icon: Tag,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "product",
        superAdminDisabled: true,
      },
      {
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
        labelKey: "nav.userManagement",
        path: ROUTES.userManagement,
        icon: Users2,
        roles: [ROLES.ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        labelKey: "nav.userPreferences",
        path: ROUTES.userPreferences,
        icon: Settings,
        roles: null, // all roles can access preferences
        module: null,
        superAdminDisabled: false,
      },
      {
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
  // superAdminDisabled: false = SA CAN see these even without impersonating
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
        roles: null, // all roles can access their own business profile
        module: null,
        superAdminDisabled: false,
      },
    ],
  },
];

/**
 * filterItem — determines whether a nav item should be visible for the current user.
 *
 * RULES (in order):
 *   1. Referral users: ONLY /customers allowed
 *   2. Role restriction: if item.roles is set, effectiveRole must be in the list
 *   3. Super Admin + not impersonating: hide items marked superAdminDisabled
 *   4. Staff module access: if item.module set and user is Staff, check moduleAccess
 *
 * VARIABLE INITIALIZATION:
 *   effectiveRole: string | undefined — impersonated role or current role
 *   moduleAccess: string[] | null — parsed from profile field
 *   modulePaths: string[] — paths controlled by a module (from MODULE_PATH_MAP)
 *   allowed: boolean — whether Staff has access to this module
 */
function filterItem(
  item: NavItem,
  effectiveRole: string | undefined,
  isSuperAdmin: boolean,
  isImpersonating: boolean,
  moduleAccess: string[] | null,
): boolean {
  // Rule 1: Referral users only see /customers
  if (effectiveRole === ROLES.REFERRAL_USER) {
    return item.path === ROUTES.customers;
  }

  // Rule 2: Role restriction
  if (item.roles) {
    if (!effectiveRole) return false;
    if (!(item.roles as readonly string[]).includes(effectiveRole))
      return false;
  }

  // Rule 3: Super Admin operational item visibility
  if (isSuperAdmin && !isImpersonating && item.superAdminDisabled) {
    return false;
  }

  // Rule 4: Staff module access check
  if (item.module && moduleAccess !== null && effectiveRole === ROLES.STAFF) {
    const modulePaths = MODULE_PATH_MAP[item.module] ?? [];
    const allowed =
      moduleAccess.some((mod) =>
        (MODULE_PATH_MAP[mod] ?? []).some((p) => modulePaths.includes(p)),
      ) || moduleAccess.includes(item.module);
    if (!allowed) {
      logTrace("filterItem: Staff access denied for module", {
        module: item.module,
        path: item.path,
        moduleAccess,
      });
      return false;
    }
  }

  return true;
}

/**
 * resolveLabel — resolves a dot-path translation key into the matching string.
 * e.g. "nav.dashboard" → t["nav"]["dashboard"] → "Dashboard"
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

  /**
   * moduleAccess — parsed from the user's module_access field.
   *
   * VARIABLE INITIALIZATION:
   *   null = no module restrictions (Admin/SA bypass module filtering)
   *   string[] = modules the Staff member can access
   */
  const moduleAccess: string[] | null = userProfile?.module_access
    ? userProfile.module_access
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : null;

  /**
   * effectiveRole — the role used for nav item filtering.
   *
   * VARIABLE INITIALIZATION:
   *   isImpersonating = true  → use impersonateAsRole ("admin" | "staff")
   *   isImpersonating = false → use currentRole from userProfile
   */
  const effectiveRole = isImpersonating
    ? impersonateAsRole
    : (currentRole as string | undefined);

  logTrace("Sidebar: role computation", {
    currentRole,
    isImpersonating,
    impersonateAsRole,
    effectiveRole,
    isSuperAdmin,
    moduleAccess,
  });

  /** handleNav — navigate to a path AND close the mobile overlay */
  const handleNav = (path: string) => {
    logDebug("Sidebar: navigating", { path, effectiveRole });
    onNavigate(path);
    onClose();
  };

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

            // Hide entire section if no items visible
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
            onClick={() => {
              logInfo("Sidebar: logout button clicked");
              logout();
            }}
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
