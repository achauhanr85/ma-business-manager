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
    product_name_snapshot: string;
    volume_points_snapshot: number;
    quantity: bigint;
    actual_sale_price: number;
    sale_id: SaleId;
    mrp_snapshot: number;
}
export type Timestamp = bigint;
export interface CategoryInput {
    name: string;
    description: string;
}
export type PurchaseOrderId = bigint;
export type ProfileKey = string;
export interface SuperAdminStats {
    total_users: bigint;
    total_profiles: bigint;
    profiles: Array<ProfileStats>;
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
    last_purchase_at: Timestamp;
    created_at: Timestamp;
    email: string;
    address: string;
    phone: string;
    profile_key: ProfileKey;
}
export type BatchId = bigint;
export type MovementId = bigint;
export interface CustomerInput {
    name: string;
    email: string;
    address: string;
    phone: string;
}
export interface InventoryMovement {
    id: MovementId;
    from_warehouse: WarehouseName;
    product_id: ProductId;
    quantity: bigint;
    to_warehouse: WarehouseName;
    profile_key: ProfileKey;
    moved_at: Timestamp;
    moved_by: UserId;
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
    vendor: string;
    timestamp: Timestamp;
    warehouse_name: WarehouseName;
    profile_key: ProfileKey;
}
export interface ProfileStats {
    user_count: bigint;
    storage_estimate_bytes: bigint;
    business_name: string;
    is_archived: boolean;
    last_activity: Timestamp;
    owner_principal: UserId;
    profile_key: ProfileKey;
}
export interface Category {
    id: CategoryId;
    owner: UserId;
    name: string;
    description: string;
    profile_key: ProfileKey;
}
export type WarehouseName = string;
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
    unit_cost: number;
    quantity: bigint;
    po_id: PurchaseOrderId;
}
export interface MonthlySalesTrend {
    month_label: string;
    total_revenue: number;
    total_volume_points: number;
}
export interface Sale {
    id: SaleId;
    owner: UserId;
    customer_id: CustomerId;
    sold_by: UserId;
    timestamp: Timestamp;
    total_revenue: number;
    customer_name: string;
    total_volume_points: number;
    profile_key: ProfileKey;
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
    cart_items: Array<CartItem>;
    customer_id: CustomerId;
}
export type SaleId = bigint;
export type ProductId = bigint;
export type CategoryId = bigint;
export interface CartItem {
    product_id: ProductId;
    quantity: bigint;
    actual_sale_price: number;
}
export interface ProfileInput {
    business_name: string;
    email: string;
    business_address: string;
    logo_url: string;
    phone_number: string;
    theme_color: string;
    profile_key: ProfileKey;
    fssai_number: string;
}
export interface ProfilePublic {
    owner: UserId;
    business_name: string;
    created_at: Timestamp;
    email: string;
    is_archived: boolean;
    business_address: string;
    logo_url: string;
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
    name: string;
    earn_base: number;
    volume_points: number;
    hsn_code: string;
    profile_key: ProfileKey;
    category_id: CategoryId;
}
export enum POStatus {
    Received = "Received",
    Pending = "Pending"
}
export enum UserRole {
    admin = "admin",
    superAdmin = "superAdmin",
    subAdmin = "subAdmin"
}
export interface backendInterface {
    checkCustomerDuplicate(name: string): Promise<DuplicateCheckResult>;
    createCategory(input: CategoryInput): Promise<CategoryId>;
    createCustomer(input: CustomerInput): Promise<CustomerId>;
    createProduct(input: ProductInput): Promise<ProductId | null>;
    createProfile(input: ProfileInput): Promise<boolean>;
    createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrderId>;
    createSale(input: SaleInput): Promise<SaleId | null>;
    deleteCategory(id: CategoryId): Promise<boolean>;
    deleteCustomer(id: CustomerId): Promise<boolean>;
    deleteProduct(id: ProductId): Promise<boolean>;
    getCategories(): Promise<Array<Category>>;
    getCustomer(id: CustomerId): Promise<CustomerPublic | null>;
    getCustomers(): Promise<Array<CustomerPublic>>;
    getDashboardStats(): Promise<DashboardStats>;
    getInventoryBatches(product_id: ProductId): Promise<Array<InventoryBatchPublic>>;
    getInventoryLevels(): Promise<Array<InventoryLevel>>;
    getInventoryMovements(): Promise<Array<InventoryMovement>>;
    getMonthlySalesTrend(): Promise<Array<MonthlySalesTrend>>;
    getProducts(): Promise<Array<Product>>;
    getProfile(): Promise<ProfilePublic | null>;
    getProfileByKey(profile_key: ProfileKey): Promise<ProfilePublic | null>;
    getPurchaseOrderItems(po_id: PurchaseOrderId): Promise<Array<PurchaseOrderItem>>;
    getPurchaseOrders(): Promise<Array<PurchaseOrder>>;
    getSale(sale_id: SaleId): Promise<Sale | null>;
    getSaleItems(sale_id: SaleId): Promise<Array<SaleItem>>;
    getSales(): Promise<Array<Sale>>;
    getSalesByCustomer(customer_id: CustomerId): Promise<Array<Sale>>;
    getSuperAdminStats(): Promise<SuperAdminStats>;
    getUserProfile(): Promise<UserProfilePublic | null>;
    /**
     * / One-time bootstrap: first caller becomes super admin (if not already set)
     */
    initSuperAdmin(): Promise<boolean>;
    joinProfile(profile_key: ProfileKey, display_name: string, warehouse_name: WarehouseName): Promise<boolean>;
    markPurchaseOrderReceived(po_id: PurchaseOrderId): Promise<boolean>;
    moveInventory(input: InventoryMovementInput): Promise<MovementId | null>;
    updateCategory(id: CategoryId, input: CategoryInput): Promise<boolean>;
    updateCustomer(id: CustomerId, input: CustomerInput): Promise<boolean>;
    /**
     * / One-time bootstrap: first caller becomes super admin (if not already set)
     */
    updateProduct(id: ProductId, input: ProductInput): Promise<boolean>;
    updateProfile(input: ProfileInput): Promise<boolean>;
    updateUserProfile(input: UserProfileInput): Promise<boolean>;
}
