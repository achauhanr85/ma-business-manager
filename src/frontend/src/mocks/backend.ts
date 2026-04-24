import type { backendInterface, Category, Product, InventoryLevel, InventoryBatchPublic, Sale, SaleItem, PurchaseOrder, PurchaseOrderItem, DashboardStats, MonthlySalesTrend, ProfileInput } from "../backend";
import { POStatus } from "../backend";
import { Principal } from "@icp-sdk/core/principal";

const mockPrincipal = Principal.fromText("aaaaa-aa");

const mockCategories: Category[] = [
  { id: BigInt(1), owner: mockPrincipal, name: "Teas", description: "Herbal teas and blends" },
  { id: BigInt(2), owner: mockPrincipal, name: "Supplements", description: "Herbal supplements" },
  { id: BigInt(3), owner: mockPrincipal, name: "Essential Oils", description: "Pure essential oils" },
];

const mockProducts: Product[] = [
  { id: BigInt(1), owner: mockPrincipal, sku: "TEA-001", name: "Tulsi Green Tea", category_id: BigInt(1), volume_points: 10, earn_base: 5, mrp: 299, hsn_code: "0902" },
  { id: BigInt(2), owner: mockPrincipal, sku: "TEA-002", name: "Ginger Lemon Tea", category_id: BigInt(1), volume_points: 8, earn_base: 4, mrp: 199, hsn_code: "0902" },
  { id: BigInt(3), owner: mockPrincipal, sku: "SUP-001", name: "Ashwagandha Capsules", category_id: BigInt(2), volume_points: 20, earn_base: 10, mrp: 499, hsn_code: "1211" },
  { id: BigInt(4), owner: mockPrincipal, sku: "OIL-001", name: "Lavender Essential Oil", category_id: BigInt(3), volume_points: 15, earn_base: 8, mrp: 399, hsn_code: "3301" },
];

const mockBatches: InventoryBatchPublic[] = [
  { id: BigInt(1), product_id: BigInt(1), quantity_remaining: BigInt(45), unit_cost: 150, date_received: BigInt(Date.now() * 1000000) },
  { id: BigInt(2), product_id: BigInt(2), quantity_remaining: BigInt(30), unit_cost: 90, date_received: BigInt(Date.now() * 1000000) },
  { id: BigInt(3), product_id: BigInt(3), quantity_remaining: BigInt(8), unit_cost: 250, date_received: BigInt(Date.now() * 1000000) },
  { id: BigInt(4), product_id: BigInt(4), quantity_remaining: BigInt(20), unit_cost: 180, date_received: BigInt(Date.now() * 1000000) },
];

const mockInventoryLevels: InventoryLevel[] = [
  { product_id: BigInt(1), total_qty: BigInt(45), batches: [mockBatches[0]] },
  { product_id: BigInt(2), total_qty: BigInt(30), batches: [mockBatches[1]] },
  { product_id: BigInt(3), total_qty: BigInt(8), batches: [mockBatches[2]] },
  { product_id: BigInt(4), total_qty: BigInt(20), batches: [mockBatches[3]] },
];

const mockSales: Sale[] = [
  { id: BigInt(1), owner: mockPrincipal, timestamp: BigInt(Date.now() * 1000000), total_revenue: 897, total_volume_points: 33, total_profit: 297 },
  { id: BigInt(2), owner: mockPrincipal, timestamp: BigInt(Date.now() * 1000000), total_revenue: 499, total_volume_points: 20, total_profit: 249 },
];

const mockSaleItems: SaleItem[] = [
  { sale_id: BigInt(1), product_id: BigInt(1), product_name_snapshot: "Tulsi Green Tea", quantity: BigInt(2), actual_sale_price: 299, mrp_snapshot: 299, unit_cost_snapshot: 150, volume_points_snapshot: 10 },
  { sale_id: BigInt(1), product_id: BigInt(2), product_name_snapshot: "Ginger Lemon Tea", quantity: BigInt(1), actual_sale_price: 199, mrp_snapshot: 199, unit_cost_snapshot: 90, volume_points_snapshot: 8 },
];

const mockPurchaseOrders: PurchaseOrder[] = [
  { id: BigInt(1), owner: mockPrincipal, vendor: "Green Valley Herbs", status: POStatus.Received, timestamp: BigInt(Date.now() * 1000000) },
  { id: BigInt(2), owner: mockPrincipal, vendor: "Nature's Best Suppliers", status: POStatus.Pending, timestamp: BigInt(Date.now() * 1000000) },
];

const mockPurchaseOrderItems: PurchaseOrderItem[] = [
  { po_id: BigInt(1), product_id: BigInt(1), quantity: BigInt(50), unit_cost: 150 },
  { po_id: BigInt(1), product_id: BigInt(2), quantity: BigInt(40), unit_cost: 90 },
];

const mockDashboardStats: DashboardStats = {
  monthly_profit: 12450,
  total_inventory_value: 38950,
  monthly_volume_points: 1580,
  recent_sales: mockSales,
};

const mockSalesTrend: MonthlySalesTrend[] = [
  { month_label: "Jan", total_revenue: 15200, total_volume_points: 890 },
  { month_label: "Feb", total_revenue: 18400, total_volume_points: 1050 },
  { month_label: "Mar", total_revenue: 22100, total_volume_points: 1280 },
  { month_label: "Apr", total_revenue: 19800, total_volume_points: 1150 },
  { month_label: "May", total_revenue: 25600, total_volume_points: 1480 },
  { month_label: "Jun", total_revenue: 28900, total_volume_points: 1680 },
];

const mockProfile: ProfileInput = {
  business_name: "MA Herb Distributors",
  phone_number: "+91 98765 43210",
  business_address: "123 Green Market Street, Mumbai, Maharashtra 400001",
  fssai_number: "12345678901234",
  email: "info@maherb.com",
};

export const mockBackend: backendInterface = {
  createCategory: async () => BigInt(4),
  createProduct: async () => BigInt(5),
  createPurchaseOrder: async () => BigInt(3),
  createSale: async () => BigInt(3),
  deleteCategory: async () => true,
  deleteProduct: async () => true,
  getCategories: async () => mockCategories,
  getDashboardStats: async () => mockDashboardStats,
  getInventoryBatches: async () => mockBatches,
  getInventoryLevels: async () => mockInventoryLevels,
  getMonthlySalesTrend: async () => mockSalesTrend,
  getProducts: async () => mockProducts,
  getProfile: async () => mockProfile,
  getPurchaseOrderItems: async () => mockPurchaseOrderItems,
  getPurchaseOrders: async () => mockPurchaseOrders,
  getSale: async () => mockSales[0],
  getSaleItems: async () => mockSaleItems,
  getSales: async () => mockSales,
  markPurchaseOrderReceived: async () => true,
  updateCategory: async () => true,
  updateProduct: async () => true,
  updateProfile: async () => true,
};
