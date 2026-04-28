import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useGetUserProfile } from "@/hooks/useBackend";
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

/** Returns true when the user has access to the given module key */
function hasModuleAccess(
  moduleAccess: string | undefined | null,
  role: string | undefined | null,
  module: string,
): boolean {
  // Admins/Super Admins have access to everything
  if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN) return true;
  if (!moduleAccess) return false;
  // Try JSON array first (e.g. ["PO","Customer"]), fall back to comma-split
  let modules: string[];
  try {
    const parsed = JSON.parse(moduleAccess);
    modules = Array.isArray(parsed) ? parsed.map((m: string) => m.trim()) : [];
  } catch {
    modules = moduleAccess.split(",").map((m) => m.trim());
  }
  return modules.includes(module);
}

export function Header({
  onMenuToggle,
  pageTitle,
  notificationCount = 0,
  onNotificationsClick,
  onNavigate,
  onHelpOpen,
}: HeaderProps) {
  const { data: userProfileData } = useGetUserProfile();
  const { userProfile } = useProfile();
  const { isImpersonating } = useImpersonation();

  // Prefer the freshest data — hook result first, context fallback
  const resolvedProfile = userProfileData ?? userProfile;
  const displayName = resolvedProfile?.display_name?.trim() || "User";
  const role = resolvedProfile?.role as string | undefined;
  const moduleAccess = resolvedProfile?.module_access;

  // Super Admin: hide create icons unless impersonating
  const isSuperAdmin = role === ROLES.SUPER_ADMIN;
  const showOperationalIcons = !isSuperAdmin || isImpersonating;

  // Avatar initials from display name
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const canSales =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "sales");
  const canCustomer =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "customer");
  const canPO =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "po");
  const canInventory =
    showOperationalIcons && hasModuleAccess(moduleAccess, role, "inventory");

  /** Navigate to a path — safe when onNavigate is not provided */
  function nav(path: string) {
    if (onNavigate) {
      onNavigate(path);
    }
  }

  /** Open notifications — safe fallback */
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
      {/* Left: hamburger + logo + page title */}
      <div className="flex items-center gap-3 min-w-0">
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

        <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-base font-semibold font-display text-foreground truncate">
          {pageTitle}
        </h1>
      </div>

      {/* Right: quick actions + notification bell + help + user name */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Home — always visible */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => nav("/dashboard")}
          aria-label="Go to Dashboard"
          data-ocid="header.home_button"
          title="Dashboard"
        >
          <Home className="w-4 h-4" />
        </Button>

        {/* Create Inventory Entry — visible only when user has inventory access */}
        {canInventory && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/inventory")}
            aria-label="Go to Inventory"
            data-ocid="header.inventory_button"
            title="Inventory"
          >
            <Package className="w-4 h-4" />
          </Button>
        )}

        {/* Create Customer — visible only when user has customer access */}
        {canCustomer && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/customers")}
            aria-label="Go to Customers"
            data-ocid="header.create_customer_button"
            title="Customers"
          >
            <UserPlus className="w-4 h-4" />
          </Button>
        )}

        {/* Create Purchase Order — visible only when user has PO access */}
        {canPO && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/purchase-orders")}
            aria-label="Go to Purchase Orders"
            data-ocid="header.create_po_button"
            title="Purchase Orders"
          >
            <ClipboardList className="w-4 h-4" />
          </Button>
        )}

        {/* Create Sale Order — visible only when user has sales access */}
        {canSales && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => nav("/sales")}
            aria-label="Go to Sales / Cart"
            data-ocid="header.create_so_button"
            title="Sales / Cart"
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
        )}

        {/* Notification bell */}
        <NotificationsBellButton
          unreadCount={notificationCount}
          onClick={handleNotificationsClick}
        />

        {/* Help icon — beside notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onHelpOpen?.()}
          aria-label="Open help"
          data-ocid="header.help_button"
          title="Help"
        >
          <BookOpen className="w-4 h-4" />
        </Button>

        {/* User avatar + display name — shows DISPLAY NAME, not profile/business name */}
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
