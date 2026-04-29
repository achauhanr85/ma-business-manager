import type {
  backendInterface,
  Category,
  CustomerOrderDetail,
  CustomerPublic,
  DashboardStats,
  DuplicateCheckResult,
  InventoryBatchPublic,
  InventoryLevel,
  InventoryMovement,
  MonthlySalesTrend,
  ProfilePublic,
  ProfileStats,
  PurchaseOrder,
  PurchaseOrderItem,
  Sale,
  SaleItem,
  SuperAdminStats,
  UserProfilePublic,
  Product,
  UserPreferences,
} from "../backend";
import {
  POStatus,
  RoutingStatus,
  UserRole,
  ProfileApprovalStatus,
  Variant_active_lead_inactive,
} from "../backend";
import { Principal } from "@icp-sdk/core/principal";

const mockPrincipal = Principal.fromText("aaaaa-aa");
const PROFILE_KEY = "ma-herb-demo";
const NOW_NS = BigInt(Date.now()) * BigInt(1_000_000);

const WHO = {
  created_by: mockPrincipal,
  last_updated_by: mockPrincipal,
  creation_date: NOW_NS,
  last_update_date: NOW_NS,
};

const mockCategories: Category[] = [
  { id: BigInt(1), owner: mockPrincipal, name: "Teas", description: "Herbal teas and blends", profile_key: PROFILE_KEY, ...WHO },
  { id: BigInt(2), owner: mockPrincipal, name: "Supplements", description: "Herbal supplements", profile_key: PROFILE_KEY, ...WHO },
  { id: BigInt(3), owner: mockPrincipal, name: "Essential Oils", description: "Pure essential oils", profile_key: PROFILE_KEY, ...WHO },
];

const mockProducts: Product[] = [
  { id: BigInt(1), owner: mockPrincipal, sku: "TEA-001", name: "Tulsi Green Tea", category_id: BigInt(1), volume_points: 10, earn_base: 5, mrp: 299, hsn_code: "0902", profile_key: PROFILE_KEY, ...WHO },
  { id: BigInt(2), owner: mockPrincipal, sku: "TEA-002", name: "Ginger Lemon Tea", category_id: BigInt(1), volume_points: 8, earn_base: 4, mrp: 199, hsn_code: "0902", profile_key: PROFILE_KEY, ...WHO },
  { id: BigInt(3), owner: mockPrincipal, sku: "SUP-001", name: "Ashwagandha Capsules", category_id: BigInt(2), volume_points: 20, earn_base: 10, mrp: 499, hsn_code: "1211", profile_key: PROFILE_KEY, ...WHO },
  { id: BigInt(4), owner: mockPrincipal, sku: "OIL-001", name: "Lavender Essential Oil", category_id: BigInt(3), volume_points: 15, earn_base: 8, mrp: 399, hsn_code: "3301", profile_key: PROFILE_KEY, ...WHO },
];

const mockBatches: InventoryBatchPublic[] = [
  { id: BigInt(1), product_id: BigInt(1), quantity_remaining: BigInt(45), unit_cost: 150, date_received: NOW_NS, warehouse_name: "Main Warehouse", profile_key: PROFILE_KEY, is_loaned: false },
  { id: BigInt(2), product_id: BigInt(2), quantity_remaining: BigInt(30), unit_cost: 90, date_received: NOW_NS, warehouse_name: "Main Warehouse", profile_key: PROFILE_KEY, is_loaned: false },
  { id: BigInt(3), product_id: BigInt(3), quantity_remaining: BigInt(8), unit_cost: 250, date_received: NOW_NS, warehouse_name: "Main Warehouse", profile_key: PROFILE_KEY, is_loaned: false },
  { id: BigInt(4), product_id: BigInt(4), quantity_remaining: BigInt(20), unit_cost: 180, date_received: NOW_NS, warehouse_name: "Main Warehouse", profile_key: PROFILE_KEY, is_loaned: false },
];

const mockInventoryLevels: InventoryLevel[] = [
  { product_id: BigInt(1), total_qty: BigInt(45), batches: [mockBatches[0]] },
  { product_id: BigInt(2), total_qty: BigInt(30), batches: [mockBatches[1]] },
  { product_id: BigInt(3), total_qty: BigInt(8), batches: [mockBatches[2]] },
  { product_id: BigInt(4), total_qty: BigInt(20), batches: [mockBatches[3]] },
];

const mockSales: Sale[] = [
  { id: BigInt(1), owner: mockPrincipal, timestamp: NOW_NS, total_revenue: 897, total_volume_points: 33, total_profit: 297, customer_id: BigInt(1), sold_by: mockPrincipal, customer_name: "Ravi Kumar", profile_key: PROFILE_KEY, payment_history: [], ...WHO },
  { id: BigInt(2), owner: mockPrincipal, timestamp: NOW_NS, total_revenue: 499, total_volume_points: 20, total_profit: 249, customer_id: BigInt(2), sold_by: mockPrincipal, customer_name: "Priya Sharma", profile_key: PROFILE_KEY, payment_history: [], ...WHO },
];

const mockSaleItems: SaleItem[] = [
  { sale_id: BigInt(1), product_id: BigInt(1), product_name_snapshot: "Tulsi Green Tea", quantity: BigInt(2), actual_sale_price: 299, mrp_snapshot: 299, unit_cost_snapshot: 150, volume_points_snapshot: 10, is_loaned_item: false, ...WHO },
  { sale_id: BigInt(1), product_id: BigInt(2), product_name_snapshot: "Ginger Lemon Tea", quantity: BigInt(1), actual_sale_price: 199, mrp_snapshot: 199, unit_cost_snapshot: 90, volume_points_snapshot: 8, is_loaned_item: false, ...WHO },
];

const mockPurchaseOrders: PurchaseOrder[] = [
  { id: BigInt(1), owner: mockPrincipal, vendor: "Green Valley Herbs", status: POStatus.Received, timestamp: NOW_NS, warehouse_name: "Main Warehouse", profile_key: PROFILE_KEY, ...WHO },
  { id: BigInt(2), owner: mockPrincipal, vendor: "Nature's Best Suppliers", status: POStatus.Pending, timestamp: NOW_NS, warehouse_name: "Main Warehouse", profile_key: PROFILE_KEY, ...WHO },
];

const mockPurchaseOrderItems: PurchaseOrderItem[] = [
  { po_id: BigInt(1), product_id: BigInt(1), quantity: BigInt(50), unit_cost: 150, ...WHO },
  { po_id: BigInt(1), product_id: BigInt(2), quantity: BigInt(40), unit_cost: 90, ...WHO },
];

const mockDashboardStats: DashboardStats = {
  monthly_profit: 12450,
  total_inventory_value: 38950,
  monthly_volume_points: 1580,
  recent_sales: mockSales,
  lead_count: BigInt(2),
  active_count: BigInt(8),
  inactive_count: BigInt(1),
  out_of_stock_count: BigInt(0),
};

const mockSalesTrend: MonthlySalesTrend[] = [
  { month_label: "Jan", total_revenue: 15200, total_volume_points: 890 },
  { month_label: "Feb", total_revenue: 18400, total_volume_points: 1050 },
  { month_label: "Mar", total_revenue: 22100, total_volume_points: 1280 },
  { month_label: "Apr", total_revenue: 19800, total_volume_points: 1150 },
  { month_label: "May", total_revenue: 25600, total_volume_points: 1480 },
  { month_label: "Jun", total_revenue: 28900, total_volume_points: 1680 },
];

const mockProfile: ProfilePublic = {
  owner: mockPrincipal,
  business_name: "MA Herb Distributors",
  phone_number: "+91 98765 43210",
  business_address: "123 Green Market Street, Mumbai, Maharashtra 400001",
  fssai_number: "12345678901234",
  email: "info@maherb.com",
  logo_url: "",
  receipt_notes: "",
  theme_color: "#16a34a",
  profile_key: PROFILE_KEY,
  created_at: NOW_NS,
  is_archived: false,
  is_enabled: true,
  instagram_handle: "",
  profile_approval_status: ProfileApprovalStatus.approved,
};

const mockUserProfile: UserProfilePublic = {
  principal: mockPrincipal,
  role: UserRole.admin,
  display_name: "Demo Admin",
  joined_at: NOW_NS,
  warehouse_name: "Main Warehouse",
  profile_key: PROFILE_KEY,
  language_preference: "en",
  date_format: "DD/MM/YYYY",
  default_receipt_language: "en",
  theme: "dark",
};

const mockCustomers: CustomerPublic[] = [
  { id: BigInt(1), name: "Ravi Kumar", phone: "+91 98765 43210", email: "ravi@example.com", address: "Mumbai", total_sales: BigInt(5), lifetime_revenue: 4500, last_purchase_at: NOW_NS, created_at: NOW_NS, profile_key: PROFILE_KEY, notes: [], customer_type: Variant_active_lead_inactive.active, medical_issue_ids: [], primary_goal_ids: [] },
  { id: BigInt(2), name: "Priya Sharma", phone: "+91 87654 32109", email: "priya@example.com", address: "Delhi", total_sales: BigInt(3), lifetime_revenue: 2800, last_purchase_at: NOW_NS, created_at: NOW_NS, profile_key: PROFILE_KEY, notes: [], customer_type: Variant_active_lead_inactive.active, medical_issue_ids: [], primary_goal_ids: [] },
];

const mockProfileStats: ProfileStats[] = [
  { profile_key: PROFILE_KEY, business_name: "MA Herb Distributors", user_count: BigInt(3), storage_estimate_bytes: BigInt(2048000), last_activity: NOW_NS, is_archived: false, owner_principal: mockPrincipal, is_enabled: true },
];

const mockSuperAdminStats: SuperAdminStats = {
  total_users: BigInt(5),
  total_profiles: BigInt(2),
  profiles: mockProfileStats,
};

const mockDuplicateCheckResult: DuplicateCheckResult = {
  has_similar: false,
  similar_customers: [],
};

const mockInventoryMovements: InventoryMovement[] = [];

const mockCustomerOrders: CustomerOrderDetail[] = [];

export const mockBackend: backendInterface = {
  assignUserRole: async () => true,
  checkCustomerDuplicate: async () => mockDuplicateCheckResult,
  createCategory: async () => BigInt(4),
  createCustomer: async () => BigInt(3),
  createCustomerFromSales: async () => BigInt(3),
  createProduct: async () => BigInt(5),
  createProfile: async () => true,
  createPurchaseOrder: async () => BigInt(3),
  createSale: async () => BigInt(3),
  deleteCategory: async () => true,
  deleteCustomer: async () => true,
  deleteProduct: async () => true,
  deleteProfile: async () => true,
  enableProfile: async () => true,
  getAllProfilesForAdmin: async () => [mockProfile],
  getAllUsersForAdmin: async () => [mockUserProfile],
  getCategories: async () => mockCategories,
  getCustomer: async () => mockCustomers[0],
  getCustomerOrders: async () => mockCustomerOrders,
  getCustomers: async () => mockCustomers,
  getDashboardStats: async () => mockDashboardStats,
  getInventoryBatches: async () => mockBatches,
  getInventoryLevels: async () => mockInventoryLevels,
  getInventoryMovements: async () => mockInventoryMovements,
  getMonthlySalesTrend: async () => mockSalesTrend,
  getProducts: async () => mockProducts,
  getProfile: async () => mockProfile,
  getProfileByKey: async () => mockProfile,
  getProfileStatus: async () => ({ is_enabled: true, is_within_window: true, profile_approval_status: ProfileApprovalStatus.approved }),
  getPurchaseOrderItems: async () => mockPurchaseOrderItems,
  getPurchaseOrders: async () => mockPurchaseOrders,
  getSale: async () => mockSales[0],
  getSaleItems: async () => mockSaleItems,
  getSales: async () => mockSales,
  getSalesByCustomer: async () => mockSales,
  getSuperAdminStats: async () => mockSuperAdminStats,
  getUserProfile: async () => mockUserProfile,
  getUsersByProfile: async () => [mockUserProfile],
  claimSuperAdmin: async () => true,
  initSuperAdmin: async () => true,
  joinProfile: async () => true,
  markPurchaseOrderReceived: async () => true,
  moveInventory: async () => BigInt(1),
  setProfileWindow: async () => true,
  updateCategory: async () => true,
  updateCustomer: async () => true,
  updateProduct: async () => true,
  updateProfile: async () => true,
  updateProfileKey: async () => true,
  updateSale: async () => true,
  updateUserProfile: async () => true,
  createBodyCompositionEntry: async () => null,
  getBodyCompositionHistory: async () => [],
  deleteBodyCompositionEntry: async () => true,
  clearAllData: async () => {},
  // New endpoints
  addLocationEntry: async () => true,
  approveUser: async () => true,
  checkAndCreateNotifications: async () => BigInt(0),
  createVendor: async () => null,
  deleteVendor: async () => true,
  getCitiesByState: async () => [],
  getCountries: async () => [],
  getNotifications: async () => [],
  getPendingApprovalUsers: async () => [],
  getStates: async () => [],
  getVendor: async () => null,
  getVendors: async () => [],
  markNotificationRead: async () => true,
  updateVendor: async () => true,
  // Loaner inventory
  addLoanerBatch: async () => BigInt(1),
  archiveLoanedBatch: async () => true,
  moveLoanerToStaff: async () => BigInt(1),
  returnToSource: async () => BigInt(1),
  runBackgroundChecks: async () => BigInt(0),
  // Referral & profile approval
  approveProfile: async () => true,
  rejectProfile: async () => true,
  createReferralUser: async () => true,
  getReferralUsers: async () => [],
  getReferralCommissionByMonth: async () => [],
  // Sales helpers
  getLastSaleForCustomer: async () => null,
  getSaleWithItems: async () => ({ sale: mockSales[0], items: mockSaleItems }),
  // Super Admin existence check
  doesSuperAdminExist: async () => true,
  // Customer notes & body inches
  addCustomerNote: async () => null,
  listCustomerNotes: async () => [],
  deleteCustomerNote: async () => true,
  createBodyInchesEntry: async () => ({ id: BigInt(1), entry_date: NOW_NS, created_by: "mock", customer_id: BigInt(1), profile_key: PROFILE_KEY, creation_date: NOW_NS }),
  listBodyInchesHistory: async () => [],
  deleteBodyInchesEntry: async () => true,
  // Goals & medical issues master
  createGoalMaster: async () => ({ id: BigInt(1), name: "mock", description: "", product_bundle: [], profile_key: PROFILE_KEY, creation_date: NOW_NS, last_update_date: NOW_NS }),
  getGoalMasterData: async () => [],
  updateGoalMaster: async () => true,
  deleteGoalMaster: async () => true,
  createMedicalIssueMaster: async () => ({ id: BigInt(1), name: "mock", description: "", profile_key: PROFILE_KEY, creation_date: NOW_NS, last_update_date: NOW_NS }),
  getMedicalIssueMasterData: async () => [],
  updateMedicalIssueMaster: async () => true,
  deleteMedicalIssueMaster: async () => true,
  // Goals & medical issues (new backend)
  createGoal: async () => BigInt(1),
  createMedicalIssue: async () => BigInt(1),
  deleteGoal: async () => true,
  deleteMedicalIssue: async () => true,
  getGoal: async () => null,
  getMedicalIssue: async () => null,
  listGoals: async () => [
    { id: BigInt(1), name: "Weight Loss", description: "Reduce body fat and improve BMI", product_bundle: [BigInt(1)], creation_date: NOW_NS, last_update_date: NOW_NS },
    { id: BigInt(2), name: "Muscle Gain", description: "Increase lean muscle mass", product_bundle: [BigInt(3)], creation_date: NOW_NS, last_update_date: NOW_NS },
  ],
  listMedicalIssues: async () => [
    { id: BigInt(1), name: "Diabetes Type 2", description: "High blood sugar condition", creation_date: NOW_NS, last_update_date: NOW_NS },
    { id: BigInt(2), name: "Thyroid", description: "Thyroid gland disorder", creation_date: NOW_NS, last_update_date: NOW_NS },
  ],
  updateGoal: async () => true,
  updateMedicalIssue: async () => true,
  // Payment
  updatePaymentStatus: async () => true,
  addPaymentEntry: async () => true,
  getPaymentHistory: async () => [],
  // Return orders
  createReturnOrder: async () => ({ success: true, return_order_id: BigInt(1) }),
  // Stage inventory
  getStagedInventory: async () => [
    { id: BigInt(5), product_id: BigInt(1), quantity_remaining: BigInt(3), unit_cost: 150, date_received: NOW_NS, warehouse_name: "Stage", profile_key: PROFILE_KEY, is_loaned: false, staged_status: "pending" as any },
    { id: BigInt(6), product_id: BigInt(2), quantity_remaining: BigInt(2), unit_cost: 90, date_received: NOW_NS, warehouse_name: "Stage", profile_key: PROFILE_KEY, is_loaned: false, staged_status: "pending" as any },
  ],
  reviewStagedItem: async () => true,
  // Cycles
  getCanisterCyclesInfo: async () => ({ total_cycles: BigInt(0), per_profile_info: [] }),
  getCyclesInfo: async () => ({ total_cycles: BigInt(0), profiles_cycles: [] }),
  // Routing & preferences
  getRoutingStatus: async () => RoutingStatus.active,
  getUserPreferences: async (): Promise<UserPreferences> => ({
    language: "en",
    dateFormat: "DD/MM/YYYY",
    defaultReceiptLanguage: "en",
    whatsappNumber: "",
    theme: "dark",
  }),
  updateUserPreferences: async () => true,
  // Super Admin active profile
  getSuperAdminActiveProfile: async () => null,
  setSuperAdminActiveProfile: async () => true,
  // Lead management (public marketing page leads)
  submitLead: async () => ({ id: BigInt(1), name: "", business_name: "", created_at: NOW_NS, email: "", message: "", is_closed: false, phone: "" }),
  getLeads: async () => [],
  getLead: async () => null,
  closeLead: async () => true,
  deleteLead: async () => true,
  // Notifications
  getAllNotificationsRaw: async () => [],
  getAllProfilesRaw: async () => [],
  getAllUsersRaw: async () => [],
  getNotificationsForUser: async () => [
    { id: "notif-1", message: "Welcome to Indi Negocio Livre!", notification_type: "welcome", is_read: false, created_at: NOW_NS, profile_key: PROFILE_KEY, target_role: "admin" },
    { id: "notif-2", message: "New user Ravi Kumar has joined the profile.", notification_type: "new_user", is_read: false, created_at: NOW_NS, profile_key: PROFILE_KEY, target_role: "admin" },
  ],
};
