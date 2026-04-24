import type React from "react";
import type {
  CartItem,
  CustomerId,
  CustomerInput,
  CustomerPublic,
  DiscountType,
  ProductId,
  ProfileKey,
  ProfilePublic,
  SaleId,
  SaleInput,
  SaleItem,
  Timestamp,
  UserId,
  UserProfilePublic,
} from "../backend";

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
  UpdateSaleInput,
  PurchaseOrder,
  PurchaseOrderId,
  PurchaseOrderInput,
  PurchaseOrderItemInput,
  ProfileInput,
  ProfilePublic,
  ProfileKey,
  ProfileStatus,
  UserProfilePublic,
  UserProfileInput,
  CustomerPublic,
  CustomerId,
  CustomerInput,
  CustomerOrderDetail,
  DiscountType,
  DuplicateCheckResult,
  DashboardStats,
  MonthlySalesTrend,
  SuperAdminStats,
  ProfileStats,
  Timestamp,
  UserId,
  WarehouseName,
} from "../backend";

export { POStatus, UserRole, PaymentMode, PaymentStatus } from "../backend";

// ─── Discount type helper ─────────────────────────────────────────────────────

// DiscountType is a backend enum with values "Percentage" | "Fixed"
// Re-exported above so all pages can use: import type { DiscountType } from "@/types"

/** Extends CustomerPublic — notes field overridden to single string for UI display.
 * Use notes[0] from CustomerPublic to populate; use notesText for UI forms. */
export interface CustomerPublicWithDiscount
  extends Omit<CustomerPublic, "notes"> {
  notes: string[]; // keep backend type
  notesText?: string; // flattened display string for UI
}

/** Extends CustomerInput with optional discount and notes fields for UI forms.
 * notes field maps to backend CustomerInput.note (single string) */
export interface CustomerInputExtended extends CustomerInput {
  discount_applicable?: DiscountType;
  discount_value?: number;
  notes?: string; // UI form field; maps to backend CustomerInput.note
}

// ─── Extended Sale Input / Update types ──────────────────────────────────────

/** Extends SaleInput with discount context fields for UI calculations.
 * payment_mode/payment_status are strings (lowercase) as used in the UI;
 * useCreateSale maps them to backend PaymentMode/PaymentStatus enums. */
export interface SaleInputExtended {
  cart_items: import("../backend").CartItem[];
  customer_id: import("../backend").CustomerId;
  discount_applied?: number;
  discount_type?: DiscountType;
  original_subtotal?: number;
  balance_due?: number;
  payment_mode?: string;
  payment_status?: string;
  amount_paid?: number;
}

/** Frontend UpdateSale input — uses string payment fields (mapped to enums in hook) */
export interface UpdateSaleInputUI {
  sale_id: import("../backend").SaleId;
  items: import("../backend").CartItem[];
  payment_mode?: string;
  payment_status?: string;
  amount_paid?: number;
}

// ─── Extended Sale fields ─────────────────────────────────────────────────────
// The Sale type from backend now includes all payment/discount fields directly.
// SaleExtended is kept as an alias for backward compatibility.

export type SaleExtended = import("../backend").Sale;

// ─── Customer Order Item (for UI display) ─────────────────────────────────────
// Backend CustomerOrderDetail = { sale: Sale, items: SaleItem[] }

export interface CustomerOrderItem {
  product_id: ProductId;
  product_name: string;
  quantity: bigint;
  actual_sale_price: number;
  unit_cost_snapshot: number;
  volume_points_snapshot: number;
  mrp_snapshot: number;
}

/** Flattened customer order view built from backend CustomerOrderDetail */
export interface CustomerOrderFlat {
  sale_id: SaleId;
  timestamp: Timestamp;
  items: CustomerOrderItem[];
  total_revenue: number;
  total_profit: number;
  discount_applied: number;
  payment_mode?: string;
  payment_status?: string;
  amount_paid?: number;
  balance_due?: number;
}

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
  userProfile: UserProfilePublic | null;
  profile: ProfilePublic | null;
  isLoadingProfile: boolean;
  refetchProfile: () => Promise<void>;
}

export const ROLES = {
  SUPER_ADMIN: "superAdmin",
  ADMIN: "admin",
  STAFF: "staff",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

// ─── Impersonation state ──────────────────────────────────────────────────────

export interface ImpersonationState {
  isImpersonating: boolean;
  profileKey: string;
  profileName: string;
  originalRole: string;
}

// ─── User Profile Public (mirrors backend UserProfilePublic) ─────────────────
// Fully re-exported via `export type { UserProfilePublic }` from backend above.
// UserProfilePublicExtended adds display helpers used in user management UI.
export interface UserProfilePublicExtended {
  /** Principal as string (via .toText()) */
  user_id: string;
  profile_key: string;
  role: string;
  warehouse_name: string;
  display_name: string;
  joined_at: bigint;
}

// ─── Super Admin extended view ─────────────────────────────────────────────────

export interface SuperAdminProfileView {
  profile_key: string;
  business_name: string;
  owner: string;
  is_enabled: boolean;
  start_date?: number;
  end_date?: number;
  user_count: number;
  storage_estimate_bytes: bigint;
  last_activity?: number;
  is_archived: boolean;
}

// ─── Who-columns (audit trail) ────────────────────────────────────────────────

export interface WhoColumns {
  createdBy?: string;
  lastUpdatedBy?: string;
  creationDate?: bigint;
  lastUpdateDate?: bigint;
}

// ─── Extended ProfileStats with governance fields ──────────────────────────────
// ProfileStats from backend now includes is_enabled / start_date / end_date.
// ProfileStatsExtended is kept as an alias for backward compatibility.

export type ProfileStatsExtended = import("../backend").ProfileStats;

// ─── Body Composition types ───────────────────────────────────────────────────

export interface BodyCompositionEntry {
  id: string;
  customer_id: string;
  profile_key: string;
  date: string;
  weight?: number;
  body_fat?: number;
  visceral_fat?: number;
  bmr?: number;
  bmi?: number;
  body_age?: number;
  trunk_fat?: number;
  muscle_mass?: number;
  created_by: string;
  creation_date: bigint;
}

export interface BodyCompositionInput {
  date: string;
  weight?: number;
  body_fat?: number;
  visceral_fat?: number;
  bmr?: number;
  bmi?: number;
  body_age?: number;
  trunk_fat?: number;
  muscle_mass?: number;
}

// Unused SaleItem and UserId imports are consumed by CustomerOrderItem/CustomerOrderFlat
// Declare as used to avoid lint errors
type _SaleItemRef = SaleItem;
type _UserIdRef = UserId;
