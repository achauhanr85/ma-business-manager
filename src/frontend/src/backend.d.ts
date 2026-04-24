import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserProfileInput {
    display_name: string;
    warehouse_name: WarehouseName;
    profile_key: ProfileKey;
}
export interface SaleItem {
    unit_cost_snapshot: number;
    product_id: ProductId;
    last_update_date: Timestamp;
    product_name_snapshot: string;
    created_by: UserId;
    volume_points_snapshot: number;
    last_updated_by: UserId;
    quantity: bigint;
    actual_sale_price: number;
    sale_id: SaleId;
    mrp_snapshot: number;
    creation_date: Timestamp;
}
export type Timestamp = bigint;
export type CategoryId = bigint;
export interface CartItem {
    product_id: ProductId;
    quantity: bigint;
    actual_sale_price: number;
}
export interface CategoryInput {
    name: string;
    description: string;
}
export type PurchaseOrderId = bigint;
export interface BodyCompositionInput {
    bmi?: number;
    bmr?: number;
    weight?: number;
    date: string;
    visceral_fat?: number;
    muscle_mass?: number;
    body_age?: bigint;
    body_fat?: number;
    trunk_fat?: number;
}
export type ProfileKey = string;
export interface SuperAdminStats {
    total_users: bigint;
    total_profiles: bigint;
    profiles: Array<ProfileStats>;
}
export interface ProfileStatus {
    is_enabled: boolean;
    end_date?: Timestamp;
    start_date?: Timestamp;
    is_within_window: boolean;
}
export interface InventoryMovementInput {
    from_warehouse: WarehouseName;
    product_id: ProductId;
    quantity: bigint;
    to_warehouse: WarehouseName;
}
export interface CustomerPublic {
    id: CustomerId;
    total_sales: bigint;
    name: string;
    lifetime_revenue: number;
    discount_value?: number;
    last_purchase_at: Timestamp;
    created_at: Timestamp;
    email: string;
    discount_applicable?: DiscountType;
    address: string;
    gender?: string;
    notes: Array<string>;
    date_of_birth?: string;
    phone: string;
    profile_key: ProfileKey;
}
export type BatchId = bigint;
export type MovementId = bigint;
export interface CustomerInput {
    name: string;
    note?: string;
    discount_value?: number;
    email: string;
    discount_applicable?: DiscountType;
    address: string;
    gender?: string;
    date_of_birth?: string;
    phone: string;
}
export interface InventoryMovement {
    id: MovementId;
    from_warehouse: WarehouseName;
    product_id: ProductId;
    last_update_date: Timestamp;
    created_by: UserId;
    last_updated_by: UserId;
    quantity: bigint;
    to_warehouse: WarehouseName;
    profile_key: ProfileKey;
    creation_date: Timestamp;
    moved_at: Timestamp;
    moved_by: UserId;
}
export interface CustomerOrderDetail {
    sale: Sale;
    items: Array<SaleItem>;
}
export interface PurchaseOrderItemInput {
    product_id: ProductId;
    unit_cost: number;
    quantity: bigint;
}
export interface DuplicateCheckResult {
    similar_customers: Array<CustomerPublic>;
    has_similar: boolean;
}
export interface InventoryBatchPublic {
    id: BatchId;
    quantity_remaining: bigint;
    product_id: ProductId;
    unit_cost: number;
    date_received: Timestamp;
    warehouse_name: WarehouseName;
    profile_key: ProfileKey;
}
export interface PurchaseOrder {
    id: PurchaseOrderId;
    status: POStatus;
    owner: UserId;
    last_update_date: Timestamp;
    created_by: UserId;
    vendor: string;
    last_updated_by: UserId;
    timestamp: Timestamp;
    warehouse_name: WarehouseName;
    profile_key: ProfileKey;
    creation_date: Timestamp;
}
export interface ProfileStats {
    user_count: bigint;
    storage_estimate_bytes: bigint;
    is_enabled: boolean;
    business_name: string;
    end_date?: Timestamp;
    is_archived: boolean;
    start_date?: Timestamp;
    last_activity: Timestamp;
    owner_principal: UserId;
    profile_key: ProfileKey;
}
export interface Category {
    id: CategoryId;
    owner: UserId;
    last_update_date: Timestamp;
    name: string;
    description: string;
    created_by: UserId;
    last_updated_by: UserId;
    profile_key: ProfileKey;
    creation_date: Timestamp;
}
export type WarehouseName = string;
export interface BodyCompositionEntry {
    id: string;
    bmi?: number;
    bmr?: number;
    weight?: number;
    date: string;
    created_by: string;
    visceral_fat?: number;
    customer_id: string;
    muscle_mass?: number;
    body_age?: bigint;
    body_fat?: number;
    trunk_fat?: number;
    profile_key: ProfileKey;
    creation_date: Timestamp;
}
export interface ProductInput {
    mrp: number;
    sku: string;
    name: string;
    earn_base: number;
    volume_points: number;
    hsn_code: string;
    category_id: CategoryId;
}
export interface InventoryLevel {
    product_id: ProductId;
    total_qty: bigint;
    batches: Array<InventoryBatchPublic>;
}
export interface PurchaseOrderInput {
    vendor: string;
    items: Array<PurchaseOrderItemInput>;
    warehouse_name: WarehouseName;
}
export interface PurchaseOrderItem {
    product_id: ProductId;
    last_update_date: Timestamp;
    unit_cost: number;
    created_by: UserId;
    last_updated_by: UserId;
    quantity: bigint;
    po_id: PurchaseOrderId;
    creation_date: Timestamp;
}
export interface UpdateSaleInput {
    payment_mode?: PaymentMode;
    payment_status?: PaymentStatus;
    amount_paid?: number;
    items: Array<CartItem>;
    sale_id: SaleId;
}
export interface MonthlySalesTrend {
    month_label: string;
    total_revenue: number;
    total_volume_points: number;
}
export interface Sale {
    id: SaleId;
    payment_mode?: PaymentMode;
    owner: UserId;
    last_update_date: Timestamp;
    discount_type?: DiscountType;
    created_by: UserId;
    payment_status?: PaymentStatus;
    customer_id: CustomerId;
    discount_applied?: number;
    sold_by: UserId;
    amount_paid?: number;
    last_updated_by: UserId;
    timestamp: Timestamp;
    total_revenue: number;
    balance_due?: number;
    customer_name: string;
    total_volume_points: number;
    profile_key: ProfileKey;
    original_subtotal?: number;
    creation_date: Timestamp;
    total_profit: number;
}
export interface DashboardStats {
    monthly_profit: number;
    total_inventory_value: number;
    recent_sales: Array<Sale>;
    monthly_volume_points: number;
}
export interface UserProfilePublic {
    principal: UserId;
    role: UserRole;
    display_name: string;
    joined_at: Timestamp;
    warehouse_name: WarehouseName;
    profile_key: ProfileKey;
}
export type UserId = Principal;
export type CustomerId = bigint;
export interface SaleInput {
    payment_mode?: PaymentMode;
    cart_items: Array<CartItem>;
    payment_status?: PaymentStatus;
    customer_id: CustomerId;
    amount_paid?: number;
}
export type SaleId = bigint;
export type ProductId = bigint;
export interface ProfileInput {
    business_name: string;
    email: string;
    business_address: string;
    logo_url: string;
    receipt_notes: string;
    phone_number: string;
    theme_color: string;
    profile_key: ProfileKey;
    fssai_number: string;
}
export interface ProfilePublic {
    owner: UserId;
    is_enabled: boolean;
    business_name: string;
    end_date?: Timestamp;
    created_at: Timestamp;
    email: string;
    is_archived: boolean;
    business_address: string;
    start_date?: Timestamp;
    logo_url: string;
    receipt_notes: string;
    phone_number: string;
    theme_color: string;
    profile_key: ProfileKey;
    fssai_number: string;
}
export interface Product {
    id: ProductId;
    mrp: number;
    sku: string;
    owner: UserId;
    last_update_date: Timestamp;
    name: string;
    earn_base: number;
    created_by: UserId;
    last_updated_by: UserId;
    volume_points: number;
    hsn_code: string;
    profile_key: ProfileKey;
    category_id: CategoryId;
    creation_date: Timestamp;
}
export enum DiscountType {
    Fixed = "Fixed",
    Percentage = "Percentage"
}
export enum POStatus {
    Received = "Received",
    Pending = "Pending"
}
export enum PaymentMode {
    Card = "Card",
    Cash = "Cash",
    BankTransfer = "BankTransfer",
    Other = "Other",
    Check = "Check"
}
export enum PaymentStatus {
    Paid = "Paid",
    Unpaid = "Unpaid",
    Partial_ = "Partial"
}
export enum UserRole {
    admin = "admin",
    superAdmin = "superAdmin",
    staff = "staff"
}
export interface backendInterface {
    assignUserRole(targetUserId: UserId, newRole: UserRole, profile_key: ProfileKey): Promise<boolean>;
    checkCustomerDuplicate(name: string): Promise<DuplicateCheckResult>;
    /**
     * / Claim or re-claim superAdmin role.
     */
    claimSuperAdmin(): Promise<boolean>;
    /**
     * / Wipe ALL stored data — clears every Map store and resets the super admin principal.
     * / Use this in preview/development to start with a completely fresh state.
     */
    clearAllData(): Promise<void>;
    createBodyCompositionEntry(customerId: CustomerId, input: BodyCompositionInput): Promise<BodyCompositionEntry | null>;
    createCategory(input: CategoryInput): Promise<CategoryId>;
    createCustomer(input: CustomerInput): Promise<CustomerId>;
    createProduct(input: ProductInput): Promise<ProductId | null>;
    createProfile(input: ProfileInput): Promise<boolean>;
    createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrderId | null>;
    createSale(input: SaleInput): Promise<SaleId | null>;
    deleteBodyCompositionEntry(id: string): Promise<boolean>;
    deleteCategory(id: CategoryId): Promise<boolean>;
    deleteCustomer(id: CustomerId): Promise<boolean>;
    deleteProduct(id: ProductId): Promise<boolean>;
    deleteProfile(profile_key: ProfileKey): Promise<boolean>;
    enableProfile(profile_key: ProfileKey, enabled: boolean): Promise<boolean>;
    getAllProfilesForAdmin(): Promise<Array<ProfilePublic>>;
    getAllUsersForAdmin(): Promise<Array<UserProfilePublic>>;
    getBodyCompositionHistory(customerId: CustomerId): Promise<Array<BodyCompositionEntry>>;
    getCategories(): Promise<Array<Category>>;
    getCustomer(id: CustomerId): Promise<CustomerPublic | null>;
    getCustomerOrders(customer_id: CustomerId): Promise<Array<CustomerOrderDetail>>;
    getCustomers(): Promise<Array<CustomerPublic>>;
    getDashboardStats(): Promise<DashboardStats>;
    getInventoryBatches(product_id: ProductId): Promise<Array<InventoryBatchPublic>>;
    getInventoryLevels(): Promise<Array<InventoryLevel>>;
    getInventoryMovements(): Promise<Array<InventoryMovement>>;
    getMonthlySalesTrend(): Promise<Array<MonthlySalesTrend>>;
    getProducts(): Promise<Array<Product>>;
    getProfile(): Promise<ProfilePublic | null>;
    getProfileByKey(profile_key: ProfileKey): Promise<ProfilePublic | null>;
    getProfileStatus(profile_key: ProfileKey): Promise<ProfileStatus | null>;
    getPurchaseOrderItems(po_id: PurchaseOrderId): Promise<Array<PurchaseOrderItem>>;
    getPurchaseOrders(): Promise<Array<PurchaseOrder>>;
    getSale(sale_id: SaleId): Promise<Sale | null>;
    /**
     * / Helper: upsert userStore entry with #superAdmin role for the given principal.
     */
    getSaleItems(sale_id: SaleId): Promise<Array<SaleItem>>;
    getSales(): Promise<Array<Sale>>;
    getSalesByCustomer(customer_id: CustomerId): Promise<Array<Sale>>;
    getSuperAdminStats(): Promise<SuperAdminStats>;
    getUserProfile(): Promise<UserProfilePublic | null>;
    getUsersByProfile(profile_key: ProfileKey): Promise<Array<UserProfilePublic>>;
    /**
     * / One-time bootstrap: first caller becomes super admin (if not already set).
     */
    initSuperAdmin(): Promise<boolean>;
    joinProfile(profile_key: ProfileKey, display_name: string, warehouse_name: WarehouseName): Promise<boolean>;
    markPurchaseOrderReceived(po_id: PurchaseOrderId): Promise<boolean>;
    moveInventory(input: InventoryMovementInput): Promise<MovementId | null>;
    setProfileWindow(profile_key: ProfileKey, start_date: Timestamp | null, end_date: Timestamp | null): Promise<boolean>;
    updateCategory(id: CategoryId, input: CategoryInput): Promise<boolean>;
    updateCustomer(id: CustomerId, input: CustomerInput): Promise<boolean>;
    updateProduct(id: ProductId, input: ProductInput): Promise<boolean>;
    updateProfile(input: ProfileInput): Promise<boolean>;
    updateProfileKey(oldKey: ProfileKey, newKey: ProfileKey): Promise<boolean>;
    updateSale(input: UpdateSaleInput): Promise<boolean>;
    updateUserProfile(input: UserProfileInput): Promise<boolean>;
}
