import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ROLES } from "@/types";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
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
  Tag,
  User,
  Users,
  X,
} from "lucide-react";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/** Module key → path mapping for permission filtering */
const MODULE_PATH_MAP: Record<string, string[]> = {
  sales: ["/sales"],
  po: ["/purchase-orders"],
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

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: readonly string[] | null;
  module: string | null;
  superAdminDisabled: boolean;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Nav items grouped into labeled sections.
 * Items appear EXACTLY ONCE — no duplicates.
 */
const NAV_SECTIONS: NavSection[] = [
  {
    id: "main",
    label: "Main",
    items: [
      {
        label: "Dashboard",
        path: "/dashboard",
        icon: LayoutDashboard,
        roles: null,
        module: null,
        superAdminDisabled: false,
      },
      {
        label: "Profile",
        path: "/profile",
        icon: User,
        roles: null,
        module: null,
        superAdminDisabled: false,
      },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      {
        label: "Sales / Cart",
        path: "/sales",
        icon: ShoppingCart,
        roles: null,
        module: "sales",
        superAdminDisabled: true,
      },
      {
        label: "Purchase Orders",
        path: "/purchase-orders",
        icon: ClipboardList,
        roles: null,
        module: "po",
        superAdminDisabled: true,
      },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    items: [
      {
        label: "Customers",
        path: "/customers",
        icon: Users,
        roles: null,
        module: "customer",
        superAdminDisabled: true,
      },
      {
        label: "Customer Goals",
        path: "/customer-goals",
        icon: Goal,
        roles: [ROLES.ADMIN, ROLES.STAFF],
        module: "customer",
        superAdminDisabled: true,
      },
      {
        label: "Medical Issues",
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
    label: "Inventory",
    items: [
      {
        label: "Inventory",
        path: "/inventory",
        icon: Boxes,
        roles: null,
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        label: "Inventory Movement",
        path: "/inventory-movement",
        icon: ArrowRightLeft,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        label: "Loaner Inventory",
        path: "/loaner-inventory",
        icon: Package,
        roles: [ROLES.STAFF, ROLES.ADMIN],
        module: "inventory",
        superAdminDisabled: true,
      },
      {
        label: "Stage Inventory",
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
    label: "Catalog",
    items: [
      {
        label: "Products & Categories",
        path: "/products",
        icon: Tag,
        roles: null,
        module: "product",
        superAdminDisabled: true,
      },
      {
        label: "Analytics",
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
    label: "Admin",
    items: [
      {
        label: "User Management",
        path: "/user-management",
        icon: Users,
        roles: [ROLES.ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        label: "Preferences",
        path: "/user-preferences",
        icon: Settings,
        roles: null,
        module: null,
        superAdminDisabled: false,
      },
      {
        label: "Super Admin",
        path: "/super-admin",
        icon: Shield,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
      {
        label: "Regression Tests",
        path: "/admin/tests",
        icon: FlaskConical,
        roles: [ROLES.SUPER_ADMIN],
        module: null,
        superAdminDisabled: false,
      },
    ],
  },
];

function filterItem(
  item: NavItem,
  effectiveRole: string | undefined,
  isSuperAdmin: boolean,
  isImpersonating: boolean,
  moduleAccess: string[] | null,
): boolean {
  // Referral users can ONLY see Customers
  if (effectiveRole === "referralUser") {
    return item.path === "/customers";
  }

  // Role-restricted items
  if (item.roles) {
    if (!effectiveRole) return false;
    if (!(item.roles as readonly string[]).includes(effectiveRole))
      return false;
  }

  // Super Admin: disable operational links unless impersonating
  if (isSuperAdmin && !isImpersonating && item.superAdminDisabled) {
    return false;
  }

  // Module access filtering for staff
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

export function Sidebar({
  currentPath,
  onNavigate,
  isOpen,
  onClose,
}: SidebarProps) {
  const { logout } = useAuth();
  const { profile, userProfile } = useProfile();
  const { isImpersonating, impersonateAsRole } = useImpersonation();

  const currentRole = userProfile?.role;
  const isSuperAdmin = currentRole === ROLES.SUPER_ADMIN;

  // Parse module_access for staff/permission filtering
  const moduleAccess: string[] | null = userProfile?.module_access
    ? userProfile.module_access
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean)
    : null;

  // Effective role during impersonation
  const effectiveRole = isImpersonating
    ? impersonateAsRole
    : (currentRole as string | undefined);

  const handleNav = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyUp={(e) => e.key === "Escape" && onClose()}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out",
          "lg:translate-x-0 lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
        data-ocid="sidebar"
      >
        {/* Logo header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <button
            type="button"
            onClick={() => handleNav("/dashboard")}
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
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Leaf className="w-4 h-4 text-primary-foreground" />
              </div>
            )}
            <div className="flex flex-col leading-none">
              <span className="font-display font-semibold text-foreground text-sm truncate max-w-[120px]">
                {profile?.business_name ?? "Indi Negocio"}
              </span>
              <span className="text-muted-foreground text-[10px]">
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

        {/* User + warehouse info */}
        {userProfile && (
          <div className="px-4 py-2.5 border-b border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {userProfile.display_name}
            </p>
            {userProfile.warehouse_name && (
              <p className="text-[11px] font-medium text-primary truncate mt-0.5 flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
                {userProfile.warehouse_name}
              </p>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">
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

        {/* Nav sections */}
        <nav
          className="flex-1 py-2 overflow-y-auto"
          aria-label="Main navigation"
        >
          {NAV_SECTIONS.map((section) => {
            // Filter items visible to current role
            const visibleItems = section.items.filter((item) =>
              filterItem(
                item,
                effectiveRole,
                isSuperAdmin,
                isImpersonating,
                moduleAccess,
              ),
            );
            // Hide entire section when no items are visible
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.id} className="mb-1">
                {/* Section label */}
                <div className="px-4 pt-3 pb-1">
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/55"
                    data-ocid={`sidebar.section.${section.id}`}
                  >
                    {section.label}
                  </span>
                </div>
                {/* Section items */}
                <ul className="space-y-0.5 px-2">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      currentPath === item.path ||
                      currentPath.startsWith(`${item.path}/`);
                    return (
                      <li key={item.path}>
                        <button
                          type="button"
                          onClick={() => handleNav(item.path)}
                          data-ocid={`sidebar.nav.${item.label.toLowerCase().replace(/[^a-z0-9]/gu, "_")}_link`}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-smooth text-left",
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                          aria-current={isActive ? "page" : undefined}
                        >
                          <Icon
                            className={cn(
                              "w-4 h-4 flex-shrink-0",
                              isActive && "text-primary",
                            )}
                          />
                          {item.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-2 py-3 border-t border-border">
          <button
            type="button"
            onClick={logout}
            data-ocid="sidebar.logout_button"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-smooth"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
