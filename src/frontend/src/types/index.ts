export type {
  Product,
  ProductInput,
  ProductId,
  Category,
  CategoryInput,
  CategoryId,
  InventoryLevel,
  InventoryBatchPublic,
  BatchId,
  Sale,
  SaleId,
  SaleItem,
  CartItem,
  PurchaseOrder,
  PurchaseOrderId,
  PurchaseOrderInput,
  PurchaseOrderItemInput,
  ProfileInput,
  DashboardStats,
  Timestamp,
  UserId,
} from "../backend";

export { POStatus } from "../backend";

export interface NavItem {
  label: string;
  path: string;
  icon: string;
}

export interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}
