import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
import { useAuth } from "@/hooks/useAuth";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { InventoryMovementPage } from "@/pages/InventoryMovementPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { PurchaseOrdersPage } from "@/pages/PurchaseOrdersPage";
import { ReceiptPage } from "@/pages/ReceiptPage";
import { SalesPage } from "@/pages/SalesPage";
import { SuperAdminPage } from "@/pages/SuperAdminPage";
import { useState } from "react";

type AppPath =
  | "/dashboard"
  | "/sales"
  | "/inventory"
  | "/inventory-movement"
  | "/purchase-orders"
  | "/products"
  | "/analytics"
  | "/profile"
  | "/receipt"
  | "/customers"
  | "/super-admin";

function getPageTitle(path: string): string {
  const titles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/sales": "New Sale",
    "/inventory": "Inventory",
    "/inventory-movement": "Inventory Movement",
    "/purchase-orders": "Purchase Orders",
    "/products": "Products & Categories",
    "/analytics": "Analytics",
    "/profile": "Business Profile",
    "/receipt": "Sale Receipt",
    "/customers": "Customer Management",
    "/super-admin": "Super Admin",
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
      case "/inventory-movement":
        return <InventoryMovementPage onNavigate={navigate} />;
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
      case "/customers":
        return <CustomersPage onNavigate={navigate} />;
      case "/super-admin":
        return <SuperAdminPage onNavigate={navigate} />;
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

function AuthenticatedApp() {
  const { userProfile, isLoadingProfile } = useProfile();

  if (isLoadingProfile) return <AppLoader />;
  if (!userProfile) return <OnboardingPage />;
  return <AppContent />;
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

  return (
    <ProfileProvider>
      <AuthenticatedApp />
    </ProfileProvider>
  );
}
