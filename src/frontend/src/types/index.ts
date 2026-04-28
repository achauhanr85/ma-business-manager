import type React from "react";
import type {
  CartItem,
  CustomerId,
  CustomerInput,
  CustomerNote,
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
  CustomerNote,
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
  Vendor,
  VendorInput,
  LocationMasterEntry,
  Notification,
} from "../backend";

export {
  POStatus,
  UserRole,
  PaymentMode,
  PaymentStatus,
  LoanedItemStatus,
} from "../backend";

export interface InventoryBatchInput {
  product_id: bigint;
  quantity: bigint;
  unit_cost: number;
  loaned_source?: string;
}

// ─── User Preferences ─────────────────────────────────────────────────────────

export interface UserPreferences {
  language: "en" | "gu" | "hi";
  dateFormat: string;
  defaultReceiptLanguage: string;
}

// ─── Discount type helper ─────────────────────────────────────────────────────

/** Extends CustomerPublic — adds UI-only helper fields.
 * notes keeps the backend CustomerNote[] type; notesText is a flattened display string. */
export interface CustomerPublicWithDiscount
  extends Omit<CustomerPublic, never> {
  notesText?: string; // flattened display string for UI forms
  referred_by?: string; // referral user display name
  referral_commission_amount?: number; // commission for referral
}

/** Extends CustomerInput with optional discount and notes fields for UI forms.
 * notes field (string) maps to backend CustomerInput.note (single string) */
export interface CustomerInputExtended extends Omit<CustomerInput, "notes"> {
  discount_applicable?: DiscountType;
  discount_value?: number;
  notes?: string; // UI form field; maps to backend CustomerInput.note
  referred_by?: string; // Display name of referral user
  referral_commission_amount?: number; // Commission amount for referral user
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
  sale_note?: string;
  payment_due_date?: string;
}

/** Frontend UpdateSale input — uses string payment fields (mapped to enums in hook) */
export interface UpdateSaleInputUI {
  sale_id: import("../backend").SaleId;
  items: import("../backend").CartItem[];
  payment_mode?: string;
  payment_status?: string;
  amount_paid?: number;
  sale_note?: string;
  payment_due_date?: string;
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
  sale_note?: string;
  payment_due_date?: string;
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
  REFERRAL_USER: "referralUser",
  REGULAR_USER: "regularUser",
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

// ─── Impersonation state ──────────────────────────────────────────────────────

export interface ImpersonationState {
  isImpersonating: boolean;
  profileKey: string;
  profileName: string;
  originalRole: string;
  impersonateAsRole: "admin" | "staff";
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
  approval_status?: string;
  module_access?: string;
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
  body_age?: bigint;
  trunk_fat?: number;
  muscle_mass?: number;
  created_by: string;
  creation_date: bigint;
}

export interface BodyCompositionInputUI {
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
type _CartItemRef = CartItem;
type _SaleInputRef = SaleInput;
type _CustomerInputRef = CustomerInput;
type _CustomerPublicRef = CustomerPublic;
type _ProfilePublicRef = ProfilePublic;
type _ProfileKeyRef = ProfileKey;
type _CustomerNoteRef = CustomerNote;
