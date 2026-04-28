module {
  public type UserId = Principal;
  public type Timestamp = Int;
  public type CategoryId = Nat;
  public type ProductId = Nat;
  public type BatchId = Nat;
  public type SaleId = Nat;
  public type PurchaseOrderId = Nat;
  public type CustomerId = Nat;
  public type MovementId = Nat;

  // Multi-tenancy
  public type ProfileKey = Text;

  // Role hierarchy: Super Admin > Admin > Staff > Referral User > Regular User
  public type UserRole = { #superAdmin; #admin; #staff; #referralUser; #regularUser };

  // Warehouse
  public type WarehouseId = Nat;
  public type WarehouseName = Text;

  // ── Who-columns ──────────────────────────────────────────────────────────────
  // All entity types carry these server-side audit fields.
  // They are populated automatically at creation/update time from the caller
  // principal and Time.now(). They are NEVER accepted from client inputs.
  //
  // Dry-run: validate who-column population
  //   1. created_by    = caller principal at first write   (immutable thereafter)
  //   2. creation_date = Time.now() at first write         (immutable thereafter)
  //   3. last_updated_by  = caller principal on every update
  //   4. last_update_date = Time.now() on every update
  public type WhoColumns = {
    created_by : UserId;
    last_updated_by : UserId;
    creation_date : Timestamp;
    last_update_date : Timestamp;
  };

  // Discount variant — shared across Customer and Sale types
  public type DiscountType = { #Percentage; #Fixed };

  // Payment mode and status — used on Sale records for payment tracking
  public type PaymentMode = { #Cash; #Card; #Check; #BankTransfer; #Other };
  public type PaymentStatus = { #Paid; #Unpaid; #Partial };

  // Location master entry — used for Indian State/City/Country LOV data
  // entry_type: "country" | "state" | "city"
  // parent_id: null for countries, state id for cities, country id for states
  public type LocationMasterEntry = {
    id : Text;
    name : Text;
    parent_id : ?Text;
    entry_type : Text;
  };

  // ── NotificationType ──────────────────────────────────────────────────────────
  // Variant-based notification type tag.
  // Used in lib/notifications.mo as the canonical set of notification_type strings.
  //   #StaffPendingApproval         — new staff joined and awaits Admin approval
  //   #PaymentOverdue               — a sale's payment_due_date has passed unpaid
  //   #CustomerFollowUp             — customer hasn't ordered in 20+ days
  //   #LoanedItemSold               — a sale contained a loaned/temporary-stock item;
  //                                   Admin is notified that a payout/replacement is owed
  //   #NewProfilePendingApproval    — a new business profile was registered and awaits
  //                                   Super Admin approval before becoming active
  //   #ReferralUserPendingApproval  — a new referral user joined and awaits Admin approval
  //   #LeadFollowUpDue             — a lead customer's follow-up date has been reached;
  //                                   Admin-only notification to schedule next contact
  public type NotificationType = {
    #StaffPendingApproval;
    #PaymentOverdue;
    #CustomerFollowUp;
    #LoanedItemSold;
    #NewProfilePendingApproval;
    #ReferralUserPendingApproval;
    #LeadFollowUpDue;
  };

  // ── ReferralCommissionEntry ───────────────────────────────────────────────────
  // Returned by getReferralCommissionByMonth query.
  // Groups total accrued commission per referral user per month.
  //   referral_user_principal — the UserId of the referral user
  //   referral_user_display_name — display name at query time
  //   profile_key             — the profile this commission belongs to
  //   month                   — ISO month string e.g. "2024-03"
  //   total_commission        — sum of referral_commission_amount for qualifying customers
  //   customer_count          — number of customers with sales in that month for this referral user
  public type ReferralCommissionEntry = {
    referral_user_principal : UserId;
    referral_user_display_name : Text;
    profile_key : ProfileKey;
    month : Text;
    total_commission : Float;
    customer_count : Nat;
  };
};
