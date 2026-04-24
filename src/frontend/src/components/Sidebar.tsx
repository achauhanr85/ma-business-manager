import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { ROLES } from "@/types";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LogOut,
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

const BASE_NAV_ITEMS = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    roles: null,
  },
  { label: "Sales", path: "/sales", icon: ShoppingCart, roles: null },
  { label: "Inventory", path: "/inventory", icon: Boxes, roles: null },
  {
    label: "Purchase Orders",
    path: "/purchase-orders",
    icon: ClipboardList,
    roles: null,
  },
  { label: "Products & Categories", path: "/products", icon: Tag, roles: null },
  { label: "Analytics", path: "/analytics", icon: BarChart3, roles: null },
  { label: "Customers", path: "/customers", icon: Users, roles: null },
  {
    label: "Inventory Movement",
    path: "/inventory-movement",
    icon: ArrowRightLeft,
    roles: [ROLES.STAFF, ROLES.ADMIN],
  },
  { label: "Profile", path: "/profile", icon: User, roles: null },
  {
    label: "Super Admin",
    path: "/super-admin",
    icon: Shield,
    roles: [ROLES.SUPER_ADMIN],
  },
];

export function Sidebar({
  currentPath,
  onNavigate,
  isOpen,
  onClose,
}: SidebarProps) {
  const { logout } = useAuth();
  const { profile, userProfile } = useProfile();

  const currentRole = userProfile?.role;

  const visibleNavItems = BASE_NAV_ITEMS.filter((item) => {
    if (!item.roles) return true;
    if (!currentRole) return false;
    return (item.roles as string[]).includes(currentRole as unknown as string);
  });

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
                {profile?.business_name ?? "MA Herb"}
              </span>
              <span className="text-muted-foreground text-[10px]">
                Business Manager
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
            <span className="inline-flex mt-1 items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary capitalize">
              {userProfile.role === ROLES.SUPER_ADMIN
                ? "Super Admin"
                : userProfile.role === ROLES.ADMIN
                  ? "Admin"
                  : "Staff"}
            </span>
          </div>
        )}

        {/* Nav items */}
        <nav
          className="flex-1 py-3 overflow-y-auto"
          aria-label="Main navigation"
        >
          <ul className="space-y-0.5 px-2">
            {visibleNavItems.map((item) => {
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
