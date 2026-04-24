import { Button } from "@/components/ui/button";
import { useGetProfile } from "@/hooks/useBackend";
import { Bell, Leaf, Menu } from "lucide-react";

interface HeaderProps {
  onMenuToggle: () => void;
  pageTitle: string;
}

export function Header({ onMenuToggle, pageTitle }: HeaderProps) {
  const { data: profile } = useGetProfile();

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-card border-b border-border shadow-xs"
      data-ocid="header"
    >
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={onMenuToggle}
          aria-label="Toggle sidebar"
          data-ocid="header.menu_toggle"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Desktop logo (shown when sidebar is always visible) */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
            <Leaf className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
        </div>

        <h1 className="text-base font-semibold font-display text-foreground truncate">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 relative"
          aria-label="Notifications"
          data-ocid="header.notifications_button"
        >
          <Bell className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 pl-1">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center border border-border">
            <span className="text-xs font-semibold text-primary">
              {profile?.business_name?.[0]?.toUpperCase() ?? "M"}
            </span>
          </div>
          <span className="hidden sm:block text-sm text-muted-foreground max-w-[120px] truncate">
            {profile?.business_name ?? "MA Herb"}
          </span>
        </div>
      </div>
    </header>
  );
}
