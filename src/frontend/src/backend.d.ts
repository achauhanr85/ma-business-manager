import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ProductInput {
    mrp: number;
    sku: string;
    name: string;
    earn_base: number;
    volume_points: number;
    hsn_code: string;
    category_id: CategoryId;
}
export type Timestamp = bigint;
export interface InventoryLevel {
    product_id: ProductId;
    total_qty: bigint;
    batches: Array<InventoryBatchPublic>;
}
export interface Category {
    id: CategoryId;
    owner: UserId;
    name: string;
    description: string;
}
export interface CategoryInput {
    name: string;
    description: string;
}
export interface PurchaseOrderInput {
    vendor: string;
    items: Array<PurchaseOrderItemInput>;
}
export type PurchaseOrderId = bigint;
export interface PurchaseOrderItem {
    product_id: ProductId;
    unit_cost: number;
    quantity: bigint;
    po_id: PurchaseOrderId;
}
export interface CartItem {
    product_id: ProductId;
    quantity: bigint;
    actual_sale_price: number;
}
export interface MonthlySalesTrend {
    month_label: string;
    total_revenue: number;
    total_volume_points: number;
}
export interface Sale {
    id: SaleId;
    owner: UserId;
    timestamp: Timestamp;
    total_revenue: number;
    total_volume_points: number;
    total_profit: number;
}
export interface DashboardStats {
    monthly_profit: number;
    total_inventory_value: number;
    recent_sales: Array<Sale>;
    monthly_volume_points: number;
}
export type BatchId = bigint;
export type UserId = Principal;
export interface PurchaseOrderItemInput {
    product_id: ProductId;
    unit_cost: number;
    quantity: bigint;
}
export type CategoryId = bigint;
export type SaleId = bigint;
export type ProductId = bigint;
export interface PurchaseOrder {
    id: PurchaseOrderId;
    status: POStatus;
    owner: UserId;
    vendor: string;
    timestamp: Timestamp;
}
export interface InventoryBatchPublic {
    id: BatchId;
    quantity_remaining: bigint;
    product_id: ProductId;
    unit_cost: number;
    date_received: Timestamp;
}
export interface ProfileInput {
    business_name: string;
    email: string;
    business_address: string;
    phone_number: string;
    fssai_number: string;
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
export interface Product {
    id: ProductId;
    mrp: number;
    sku: string;
    owner: UserId;
    name: string;
    earn_base: number;
    volume_points: number;
    hsn_code: string;
    category_id: CategoryId;
}
export enum POStatus {
    Received = "Received",
    Pending = "Pending"
}
export interface backendInterface {
    createCategory(input: CategoryInput): Promise<CategoryId>;
    createProduct(input: ProductInput): Promise<ProductId | null>;
    createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrderId>;
    createSale(cartItems: Array<CartItem>): Promise<SaleId | null>;
    deleteCategory(id: CategoryId): Promise<boolean>;
    deleteProduct(id: ProductId): Promise<boolean>;
    getCategories(): Promise<Array<Category>>;
    getDashboardStats(): Promise<DashboardStats>;
    getInventoryBatches(product_id: ProductId): Promise<Array<InventoryBatchPublic>>;
    getInventoryLevels(): Promise<Array<InventoryLevel>>;
    getMonthlySalesTrend(): Promise<Array<MonthlySalesTrend>>;
    getProducts(): Promise<Array<Product>>;
    getProfile(): Promise<ProfileInput | null>;
    getPurchaseOrderItems(po_id: PurchaseOrderId): Promise<Array<PurchaseOrderItem>>;
    getPurchaseOrders(): Promise<Array<PurchaseOrder>>;
    getSale(sale_id: SaleId): Promise<Sale | null>;
    getSaleItems(sale_id: SaleId): Promise<Array<SaleItem>>;
    getSales(): Promise<Array<Sale>>;
    markPurchaseOrderReceived(po_id: PurchaseOrderId): Promise<boolean>;
    updateCategory(id: CategoryId, input: CategoryInput): Promise<boolean>;
    updateProduct(id: ProductId, input: ProductInput): Promise<boolean>;
    updateProfile(input: ProfileInput): Promise<boolean>;
}
