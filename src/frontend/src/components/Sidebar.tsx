import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useGetProfile } from "@/hooks/useBackend";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Leaf,
  LogOut,
  ShoppingCart,
  Tag,
  User,
  X,
} from "lucide-react";

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Sales", path: "/sales", icon: ShoppingCart },
  { label: "Inventory", path: "/inventory", icon: Boxes },
  { label: "Purchase Orders", path: "/purchase-orders", icon: ClipboardList },
  { label: "Products & Categories", path: "/products", icon: Tag },
  { label: "Analytics", path: "/analytics", icon: BarChart3 },
  { label: "Profile", path: "/profile", icon: User },
];

export function Sidebar({
  currentPath,
  onNavigate,
  isOpen,
  onClose,
}: SidebarProps) {
  const { logout } = useAuth();
  const { data: profile } = useGetProfile();

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
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display font-semibold text-foreground text-sm">
                MA Herb
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

        {/* Business name */}
        {profile?.business_name && (
          <div className="px-4 py-2 border-b border-border">
            <p className="text-xs text-muted-foreground">Logged in as</p>
            <p className="text-sm font-medium text-foreground truncate">
              {profile.business_name}
            </p>
          </div>
        )}

        {/* Nav items */}
        <nav
          className="flex-1 py-3 overflow-y-auto"
          aria-label="Main navigation"
        >
          <ul className="space-y-0.5 px-2">
            {NAV_ITEMS.map((item) => {
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
