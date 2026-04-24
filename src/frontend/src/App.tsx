import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { LoginPage } from "@/pages/LoginPage";
import { useEffect, useState } from "react";

import { AnalyticsPage } from "@/pages/AnalyticsPage";
// Lazy-loaded pages (inline for this foundation pass)
import { DashboardPage } from "@/pages/DashboardPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage";
import { ReceiptPage } from "@/pages/ReceiptPage";
import { SalesPage } from "@/pages/SalesPage";

type AppPath =
  | "/dashboard"
  | "/sales"
  | "/inventory"
  | "/purchase-orders"
  | "/products"
  | "/analytics"
  | "/profile"
  | "/receipt";

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/sales": "New Sale",
    "/inventory": "Inventory",
    "/purchase-orders": "Purchase Orders",
    "/products": "Products & Categories",
    "/analytics": "Analytics",
    "/profile": "Business Profile",
    "/receipt": "Sale Receipt",
  };
  return titles[path] ?? "MA Herb";
}

function AppContent() {
  const [currentPath, setCurrentPath] = useState<AppPath>("/dashboard");
  const [receiptSaleId, setReceiptSaleId] = useState<bigint | null>(null);

  const navigate = (path: string, saleId?: bigint) => {
    setCurrentPath(path as AppPath);
    if (saleId !== undefined) setReceiptSaleId(saleId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderPage = () => {
    switch (currentPath) {
      case "/dashboard":
        return <DashboardPage onNavigate={navigate} />;
      case "/sales":
        return <SalesPage onNavigate={navigate} />;
      case "/inventory":
        return <InventoryPage onNavigate={navigate} />;
      case "/purchase-orders":
        return <PurchaseOrdersPage onNavigate={navigate} />;
      case "/products":
        return <ProductsPage onNavigate={navigate} />;
      case "/analytics":
        return <AnalyticsPage onNavigate={navigate} />;
      case "/profile":
        return <ProfilePage onNavigate={navigate} />;
      case "/receipt":
        return <ReceiptPage saleId={receiptSaleId} onNavigate={navigate} />;
      default:
        return <DashboardPage onNavigate={navigate} />;
    }
  };

  return (
    <Layout
      currentPath={currentPath}
      pageTitle={getPageTitle(currentPath)}
      onNavigate={navigate}
    >
      {renderPage()}
    </Layout>
  );
}

function AppLoader() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background"
      data-ocid="app.loading_state"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
          <span className="text-2xl">🌿</span>
        </div>
        <div className="space-y-2 text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <AppLoader />;
  if (!isAuthenticated) return <LoginPage />;
  return <AppContent />;
}
