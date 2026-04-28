import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface SaleItem {
    unit_cost_snapshot: number;
    is_loaned_item: boolean;
    product_id: ProductId;
    last_update_date: Timestamp;
    product_instructions?: string;
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
export type CategoryId = bigint;
export interface CategoryInput {
    name: string;
    description: string;
}
export type PurchaseOrderId = bigint;
export interface ProfileCyclesEntry {
    business_name: string;
    estimated_cycles: bigint;
    profile_key: ProfileKey;
}
export type ProfileKey = string;
export interface GoalMasterInput {
    name: string;
    description: string;
    product_bundle: Array<ProductId>;
}
export interface InventoryMovementInput {
    from_warehouse: WarehouseName;
    product_id: ProductId;
    is_loaned_move?: boolean;
    loaned_source?: string;
    quantity: bigint;
    to_warehouse: WarehouseName;
}
export interface CyclesInfo {
    profiles_cycles: Array<ProfileCyclesEntry>;
    total_cycles: bigint;
}
export interface CustomerNoteInput {
    text: string;
    note_date: Timestamp;
}
export interface CustomerOrderDetail {
    sale: Sale;
    items: Array<SaleItem>;
}
export interface ReferralCommissionEntry {
    month: string;
    total_commission: number;
    customer_count: bigint;
    referral_user_principal: UserId;
    referral_user_display_name: string;
    profile_key: ProfileKey;
}
export interface CustomerInput {
    age?: bigint;
    height?: string;
    pin_code?: string;
    medical_issue_ids?: Array<bigint>;
    body_composition?: Array<BodyCompositionInput>;
    country?: string;
    address_line1?: string;
    address_line2?: string;
    referral_commission_amount?: number;
    city?: string;
    name: string;
    note?: string;
    referred_by?: string;
    discount_value?: number;
    lead_follow_up_date?: bigint;
    email: string;
    discount_applicable?: DiscountType;
    state?: string;
    lead_to_active_datetime?: Timestamp;
    address: string;
    gender?: string;
    notes?: Array<CustomerNoteInput>;
    date_of_birth?: string;
    phone: string;
    primary_goal_ids?: Array<bigint>;
    customer_type?: Variant_active_lead_inactive;
    lead_notes?: string;
    customer_created_by?: UserId;
}
export interface InventoryBatchPublic {
    id: BatchId;
    quantity_remaining: bigint;
    product_id: ProductId;
    staged_status?: StagedBatchStatus;
    unit_cost: number;
    loaned_status?: LoanedItemStatus;
    loaned_source?: string;
    date_received: Timestamp;
    warehouse_name: WarehouseName;
    return_order_id?: SaleId;
    profile_key: ProfileKey;
    is_loaned: boolean;
}
export interface BodyInchesPublic {
    id: bigint;
    hips?: number;
    chest?: number;
    entry_date: Timestamp;
    created_by: string;
    customer_id: bigint;
    thighs?: number;
    calves?: number;
    waist?: number;
    biceps?: number;
    profile_key: ProfileKey;
    creation_date: Timestamp;
}
export type WarehouseName = string;
export interface ProductInput {
    mrp: number;
    sku: string;
    name: string;
    earn_base: number;
    instructions?: string;
    volume_points: number;
    serving_size?: string;
    hsn_code: string;
    category_id: CategoryId;
}
export interface InventoryLevel {
    product_id: ProductId;
    total_qty: bigint;
    batches: Array<InventoryBatchPublic>;
}
export interface CustomerNote {
    id: bigint;
    text: string;
    created_by: string;
    note_date: Timestamp;
    creation_date: Timestamp;
}
export interface MedicalIssueMasterPublic {
    id: bigint;
    last_update_date: Timestamp;
    name: string;
    description: string;
    creation_date: Timestamp;
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
export interface VendorInput {
    name: string;
    email?: string;
    is_default: boolean;
    address?: string;
    contact_name?: string;
    phone?: string;
}
export interface UpdateSaleInput {
    payment_mode?: PaymentMode;
    sale_note?: string;
    payment_status?: PaymentStatus;
    amount_paid?: number;
    payment_due_date?: string;
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
    return_of_sale_id?: SaleId;
    payment_mode?: PaymentMode;
    owner: UserId;
    last_update_date: Timestamp;
    discount_type?: DiscountType;
    sale_note?: string;
    created_by: UserId;
    payment_status?: PaymentStatus;
    customer_id: CustomerId;
    discount_applied?: number;
    sold_by: UserId;
    amount_paid?: number;
    payment_history: Array<PaymentEntry>;
    last_updated_by: UserId;
    order_type?: OrderType;
    timestamp: Timestamp;
    total_revenue: number;
    balance_due?: number;
    payment_due_date?: string;
    customer_name: string;
    total_volume_points: number;
    profile_key: ProfileKey;
    original_subtotal?: number;
    creation_date: Timestamp;
    total_profit: number;
}
export interface DashboardStats {
    monthly_profit: number;
    inactive_count: bigint;
    total_inventory_value: number;
    active_count: bigint;
    lead_count: bigint;
    recent_sales: Array<Sale>;
    monthly_volume_points: number;
}
export interface BodyInchesInput {
    hips?: number;
    chest?: number;
    entry_date: Timestamp;
    thighs?: number;
    calves?: number;
    waist?: number;
    biceps?: number;
}
export type UserId = Principal;
export type CustomerId = bigint;
export interface Notification {
    id: string;
    is_read: boolean;
    created_at: Timestamp;
    notification_type: string;
    related_id?: string;
    message: string;
    profile_key: string;
    target_role: string;
}
export interface PaymentEntry {
    id: string;
    payment_date: Timestamp;
    payment_method: string;
    recorded_by: string;
    amount: number;
}
export interface MedicalIssueMasterPublic__1 {
    id: bigint;
    name: string;
    description: string;
}
export interface SaleInput {
    return_of_sale_id?: SaleId;
    payment_mode?: PaymentMode;
    sale_note?: string;
    cart_items: Array<CartItem>;
    payment_status?: PaymentStatus;
    customer_id: CustomerId;
    amount_paid?: number;
    order_type?: OrderType;
    payment_due_date?: string;
}
export interface CartItem {
    is_loaned_item?: boolean;
    product_id: ProductId;
    product_instructions?: string;
    quantity: bigint;
    actual_sale_price: number;
}
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
    instagram_handle: string;
    profile_approval_status: ProfileApprovalStatus;
    receipt_notes: string;
    phone_number: string;
    theme_color: string;
    profile_key: ProfileKey;
    fssai_number: string;
}
export interface UserPreferences {
    defaultReceiptLanguage: string;
    language: string;
    whatsappNumber: string;
    dateFormat: string;
}
export type Timestamp = bigint;
export interface GoalMasterPublic {
    id: bigint;
    last_update_date: Timestamp;
    name: string;
    description: string;
    product_bundle: Array<ProductId>;
    creation_date: Timestamp;
}
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
    profile_approval_status: ProfileApprovalStatus;
}
export interface CustomerPublic {
    id: CustomerId;
    age?: bigint;
    height?: string;
    pin_code?: string;
    total_sales: bigint;
    medical_issue_ids: Array<bigint>;
    country?: string;
    address_line1?: string;
    address_line2?: string;
    referral_commission_amount?: number;
    city?: string;
    name: string;
    lifetime_revenue: number;
    referred_by?: string;
    discount_value?: number;
    last_purchase_at: Timestamp;
    created_at: Timestamp;
    lead_follow_up_date?: bigint;
    email: string;
    discount_applicable?: DiscountType;
    state?: string;
    lead_to_active_datetime?: Timestamp;
    address: string;
    gender?: string;
    notes: Array<CustomerNote>;
    date_of_birth?: string;
    phone: string;
    primary_goal_ids: Array<bigint>;
    customer_type: Variant_active_lead_inactive;
    lead_notes?: string;
    profile_key: ProfileKey;
    customer_created_by?: UserId;
}
export type MovementId = bigint;
export type BatchId = bigint;
export interface InventoryMovement {
    id: MovementId;
    from_warehouse: WarehouseName;
    product_id: ProductId;
    is_loaned_move: boolean;
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
export interface PurchaseOrderItemInput {
    product_id: ProductId;
    unit_cost: number;
    quantity: bigint;
}
export interface DuplicateCheckResult {
    similar_customers: Array<CustomerPublic>;
    has_similar: boolean;
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
export interface PurchaseOrder {
    id: PurchaseOrderId;
    status: POStatus;
    po_number?: string;
    owner: UserId;
    last_update_date: Timestamp;
    created_by: UserId;
    vendor: string;
    last_updated_by: UserId;
    timestamp: Timestamp;
    warehouse_name: WarehouseName;
    vendor_name?: string;
    vendor_id?: string;
    profile_key: ProfileKey;
    creation_date: Timestamp;
}
export interface Vendor {
    id: string;
    last_update_date: Timestamp;
    name: string;
    created_by: UserId;
    email?: string;
    is_default: boolean;
    address?: string;
    last_updated_by: UserId;
    contact_name?: string;
    phone?: string;
    profile_key: string;
    creation_date: Timestamp;
}
export interface GoalMasterPublic__1 {
    id: bigint;
    name: string;
    description: string;
    product_bundle: Array<ProductId>;
}
export interface MedicalIssueMasterInput {
    name: string;
    description: string;
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
export interface PurchaseOrderInput {
    po_number?: string;
    vendor: string;
    items: Array<PurchaseOrderItemInput>;
    warehouse_name: WarehouseName;
    vendor_name?: string;
    vendor_id?: string;
}
export interface UserProfilePublic {
    principal: UserId;
    default_receipt_language: string;
    role: UserRole;
    email?: string;
    approval_status?: string;
    display_name: string;
    module_access?: string;
    joined_at: Timestamp;
    language_preference: string;
    date_format: string;
    warehouse_name: WarehouseName;
    profile_key: ProfileKey;
}
export interface ReturnItem {
    qty: bigint;
    product_id: ProductId;
    unit_price: number;
    is_usable: boolean;
}
export interface LocationMasterEntry {
    id: string;
    name: string;
    entry_type: string;
    parent_id?: string;
}
export type SaleId = bigint;
export interface ReturnOrderResult {
    error?: string;
    success: boolean;
    return_order_id?: SaleId;
}
export type ProductId = bigint;
export interface ProfileInput {
    business_name: string;
    email: string;
    business_address: string;
    logo_url: string;
    instagram_handle: string;
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
    instructions?: string;
    last_updated_by: UserId;
    volume_points: number;
    serving_size?: string;
    hsn_code: string;
    profile_key: ProfileKey;
    category_id: CategoryId;
    creation_date: Timestamp;
}
export interface UserProfileInput {
    default_receipt_language?: string;
    email?: string;
    approval_status?: string;
    display_name: string;
    module_access?: string;
    language_preference?: string;
    date_format?: string;
    warehouse_name: WarehouseName;
    profile_key: ProfileKey;
}
export enum DiscountType {
    Fixed = "Fixed",
    Percentage = "Percentage"
}
export enum LoanedItemStatus {
    active = "active",
    archived = "archived"
}
export enum OrderType {
    return_ = "return",
    standard = "standard"
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
export enum ProfileApprovalStatus {
    approved = "approved",
    suspended = "suspended",
    pending_super_admin_approval = "pending_super_admin_approval"
}
export enum RoutingStatus {
    active = "active",
    pending_approval = "pending_approval",
    noprofile = "noprofile",
    superAdmin = "superAdmin",
    profile_pending_super_admin = "profile_pending_super_admin"
}
export enum StagedBatchStatus {
    pending = "pending",
    rejected = "rejected",
    accepted = "accepted"
}
export enum UserRole {
    admin = "admin",
    referralUser = "referralUser",
    regularUser = "regularUser",
    superAdmin = "superAdmin",
    staff = "staff"
}
export enum Variant_active_lead_inactive {
    active = "active",
    lead = "lead",
    inactive = "inactive"
}
export enum Variant_reject_accept {
    reject = "reject",
    accept = "accept"
}
export interface backendInterface {
    addCustomerNote(customerId: CustomerId, input: CustomerNoteInput): Promise<CustomerNote | null>;
    addLoanerBatch(product_id: ProductId, quantity: bigint, unit_cost: number, loaned_source: string): Promise<BatchId | null>;
    addLocationEntry(entry: LocationMasterEntry): Promise<boolean>;
    addPaymentEntry(sale_id: SaleId, amount: number, payment_method: string): Promise<boolean>;
    approveProfile(profile_key: ProfileKey): Promise<boolean>;
    approveUser(userId: UserId, approved: boolean): Promise<boolean>;
    archiveLoanedBatch(batch_id: BatchId): Promise<boolean>;
    assignUserRole(targetUserId: UserId, newRole: UserRole, profile_key: ProfileKey): Promise<boolean>;
    checkAndCreateNotifications(profileKey: string): Promise<bigint>;
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
    createBodyInchesEntry(customerId: CustomerId, input: BodyInchesInput): Promise<BodyInchesPublic>;
    createCategory(input: CategoryInput): Promise<CategoryId>;
    createCustomer(input: CustomerInput): Promise<CustomerId>;
    createCustomerFromSales(input: CustomerInput): Promise<CustomerId>;
    createGoal(input: GoalMasterInput): Promise<bigint>;
    createGoalMaster(profileKey: ProfileKey, name: string, description: string): Promise<GoalMasterPublic__1>;
    createMedicalIssue(input: MedicalIssueMasterInput): Promise<bigint>;
    createMedicalIssueMaster(profileKey: ProfileKey, name: string, description: string): Promise<MedicalIssueMasterPublic__1>;
    createProduct(input: ProductInput): Promise<ProductId | null>;
    createProfile(input: ProfileInput): Promise<boolean>;
    createPurchaseOrder(input: PurchaseOrderInput): Promise<PurchaseOrderId | null>;
    createReferralUser(profile_key: ProfileKey, display_name: string): Promise<boolean>;
    createReturnOrder(original_sale_id: SaleId, return_items: Array<ReturnItem>): Promise<ReturnOrderResult>;
    createSale(input: SaleInput): Promise<SaleId | null>;
    createVendor(input: VendorInput, profileKey: string): Promise<Vendor | null>;
    deleteBodyCompositionEntry(id: string): Promise<boolean>;
    deleteBodyInchesEntry(id: bigint): Promise<boolean>;
    deleteCategory(id: CategoryId): Promise<boolean>;
    deleteCustomer(id: CustomerId): Promise<boolean>;
    deleteCustomerNote(noteId: bigint, customerId: CustomerId): Promise<boolean>;
    deleteGoal(id: bigint): Promise<boolean>;
    deleteGoalMaster(id: bigint): Promise<boolean>;
    deleteMedicalIssue(id: bigint): Promise<boolean>;
    deleteMedicalIssueMaster(id: bigint): Promise<boolean>;
    deleteProduct(id: ProductId): Promise<boolean>;
    deleteProfile(profile_key: ProfileKey): Promise<boolean>;
    deleteVendor(vendorId: string): Promise<boolean>;
    /**
     * / Returns true if a Super Admin has already been registered (superAdminPrincipal is set).
     * / This is a public, unauthenticated query — used by the frontend to decide whether
     * / a new anonymous user should see the first-time setup screen or the onboarding screen.
     */
    doesSuperAdminExist(): Promise<boolean>;
    enableProfile(profile_key: ProfileKey, enabled: boolean): Promise<boolean>;
    getAllProfilesForAdmin(): Promise<Array<ProfilePublic>>;
    getAllUsersForAdmin(): Promise<Array<UserProfilePublic>>;
    getBodyCompositionHistory(customerId: CustomerId): Promise<Array<BodyCompositionEntry>>;
    getCanisterCyclesInfo(): Promise<{
        per_profile_info: Array<{
            business_name: string;
            cycles_note: string;
            profile_key: string;
        }>;
        total_cycles: bigint;
    }>;
    getCategories(): Promise<Array<Category>>;
    getCitiesByState(stateId: string): Promise<Array<LocationMasterEntry>>;
    getCountries(): Promise<Array<LocationMasterEntry>>;
    getCustomer(id: CustomerId): Promise<CustomerPublic | null>;
    getCustomerOrders(customer_id: CustomerId): Promise<Array<CustomerOrderDetail>>;
    getCustomers(): Promise<Array<CustomerPublic>>;
    getCyclesInfo(): Promise<CyclesInfo>;
    getDashboardStats(): Promise<DashboardStats>;
    getGoal(id: bigint): Promise<GoalMasterPublic | null>;
    getGoalMasterData(profileKey: ProfileKey): Promise<Array<GoalMasterPublic__1>>;
    getInventoryBatches(product_id: ProductId): Promise<Array<InventoryBatchPublic>>;
    getInventoryLevels(): Promise<Array<InventoryLevel>>;
    getInventoryMovements(): Promise<Array<InventoryMovement>>;
    getLastSaleForCustomer(customer_id: CustomerId): Promise<CustomerOrderDetail | null>;
    getMedicalIssue(id: bigint): Promise<MedicalIssueMasterPublic | null>;
    getMedicalIssueMasterData(profileKey: ProfileKey): Promise<Array<MedicalIssueMasterPublic__1>>;
    getMonthlySalesTrend(): Promise<Array<MonthlySalesTrend>>;
    getNotifications(profileKey: string, targetRole: string): Promise<Array<Notification>>;
    getNotificationsForUser(): Promise<Array<Notification>>;
    getPaymentHistory(sale_id: SaleId): Promise<Array<PaymentEntry>>;
    getPendingApprovalUsers(profile_key: ProfileKey): Promise<Array<UserProfilePublic>>;
    getProducts(): Promise<Array<Product>>;
    getProfile(): Promise<ProfilePublic | null>;
    getProfileByKey(profile_key: ProfileKey): Promise<ProfilePublic | null>;
    getProfileStatus(profile_key: ProfileKey): Promise<ProfileStatus | null>;
    getPurchaseOrderItems(po_id: PurchaseOrderId): Promise<Array<PurchaseOrderItem>>;
    getPurchaseOrders(): Promise<Array<PurchaseOrder>>;
    getReferralCommissionByMonth(): Promise<Array<ReferralCommissionEntry>>;
    getReferralUsers(profile_key: ProfileKey): Promise<Array<UserProfilePublic>>;
    getRoutingStatus(): Promise<RoutingStatus>;
    getSale(sale_id: SaleId): Promise<Sale | null>;
    getSaleItems(sale_id: SaleId): Promise<Array<SaleItem>>;
    getSaleWithItems(sale_id: SaleId): Promise<CustomerOrderDetail | null>;
    getSales(): Promise<Array<Sale>>;
    getSalesByCustomer(customer_id: CustomerId): Promise<Array<Sale>>;
    getStagedInventory(): Promise<Array<InventoryBatchPublic>>;
    getStates(): Promise<Array<LocationMasterEntry>>;
    getSuperAdminActiveProfile(): Promise<ProfileKey | null>;
    getSuperAdminStats(): Promise<SuperAdminStats>;
    getUserPreferences(): Promise<UserPreferences>;
    getUserProfile(): Promise<UserProfilePublic | null>;
    getUsersByProfile(profile_key: ProfileKey): Promise<Array<UserProfilePublic>>;
    getVendor(vendorId: string): Promise<Vendor | null>;
    getVendors(profileKey: string): Promise<Array<Vendor>>;
    /**
     * / One-time bootstrap: first caller becomes super admin (if not already set).
     */
    initSuperAdmin(): Promise<boolean>;
    joinProfile(profile_key: ProfileKey, display_name: string, warehouse_name: WarehouseName): Promise<boolean>;
    listBodyInchesHistory(customerId: CustomerId): Promise<Array<BodyInchesPublic>>;
    listCustomerNotes(customerId: CustomerId): Promise<Array<CustomerNote>>;
    listGoals(): Promise<Array<GoalMasterPublic>>;
    listMedicalIssues(): Promise<Array<MedicalIssueMasterPublic>>;
    markNotificationRead(notificationId: string): Promise<boolean>;
    markPurchaseOrderReceived(po_id: PurchaseOrderId): Promise<boolean>;
    moveInventory(input: InventoryMovementInput): Promise<MovementId | null>;
    moveLoanerToStaff(product_id: ProductId, quantity: bigint, to_warehouse: WarehouseName): Promise<MovementId | null>;
    rejectProfile(profile_key: ProfileKey): Promise<boolean>;
    returnToSource(batch_id: BatchId, quantity: bigint): Promise<MovementId | null>;
    reviewStagedItem(batch_id: BatchId, action: Variant_reject_accept): Promise<boolean>;
    runBackgroundChecks(): Promise<bigint>;
    setProfileWindow(profile_key: ProfileKey, start_date: Timestamp | null, end_date: Timestamp | null): Promise<boolean>;
    setSuperAdminActiveProfile(profile_key: ProfileKey): Promise<boolean>;
    updateCategory(id: CategoryId, input: CategoryInput): Promise<boolean>;
    updateCustomer(id: CustomerId, input: CustomerInput): Promise<boolean>;
    updateGoal(id: bigint, input: GoalMasterInput): Promise<boolean>;
    updateGoalMaster(id: bigint, name: string, description: string, productBundle: Array<ProductId>): Promise<boolean>;
    updateMedicalIssue(id: bigint, input: MedicalIssueMasterInput): Promise<boolean>;
    updateMedicalIssueMaster(id: bigint, name: string, description: string): Promise<boolean>;
    updatePaymentStatus(saleId: SaleId, paymentStatus: PaymentStatus, amountPaid: number | null, paymentDueDate: string | null): Promise<boolean>;
    updateProduct(id: ProductId, input: ProductInput): Promise<boolean>;
    updateProfile(input: ProfileInput): Promise<boolean>;
    updateProfileKey(oldKey: ProfileKey, newKey: ProfileKey): Promise<boolean>;
    updateSale(input: UpdateSaleInput): Promise<boolean>;
    updateUserPreferences(language: string, dateFormat: string, defaultReceiptLanguage: string, whatsappNumber: string): Promise<boolean>;
    updateUserProfile(input: UserProfileInput): Promise<boolean>;
    updateVendor(vendorId: string, input: VendorInput): Promise<boolean>;
}
