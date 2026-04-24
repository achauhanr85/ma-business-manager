import type React from "react";

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
  InventoryMovement,
  InventoryMovementInput,
  MovementId,
  Sale,
  SaleId,
  SaleItem,
  SaleInput,
  CartItem,
  PurchaseOrder,
  PurchaseOrderId,
  PurchaseOrderInput,
  PurchaseOrderItemInput,
  ProfileInput,
  ProfilePublic,
  ProfileKey,
  UserProfilePublic,
  UserProfileInput,
  CustomerPublic,
  CustomerId,
  CustomerInput,
  DuplicateCheckResult,
  DashboardStats,
  MonthlySalesTrend,
  SuperAdminStats,
  ProfileStats,
  Timestamp,
  UserId,
  WarehouseName,
} from "../backend";

export { POStatus, UserRole } from "../backend";

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

export interface ProfileContextValue {
  userProfile: import("../backend").UserProfilePublic | null;
  profile: import("../backend").ProfilePublic | null;
  isLoadingProfile: boolean;
  refetchProfile: () => Promise<void>;
}

export const ROLES = {
  SUPER_ADMIN: "superAdmin",
  ADMIN: "admin",
  SUB_ADMIN: "subAdmin",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];
