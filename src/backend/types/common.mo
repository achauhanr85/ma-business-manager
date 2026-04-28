/*
 * types/common.mo — Shared Primitive Types
 *
 * WHAT THIS FILE DOES:
 *   Defines the small building-block types that are reused throughout the entire
 *   backend. Think of it as a dictionary of "named numbers" and "named text" so
 *   every file speaks the same language when referring to, say, a customer ID or
 *   a timestamp.
 *
 * WHO USES IT:
 *   Virtually every other .mo file imports this module. It has no dependencies
 *   of its own — it only uses Motoko's built-in types.
 *
 * STATUS: Active — do not remove or rename anything here without updating all
 *         importers.
 */

module {

  // ── Identity types ────────────────────────────────────────────────────────
  // UserId is the Internet Identity "principal" — a unique cryptographic identifier
  // for each logged-in user. It is NOT an email or username; it is a hardware-backed
  // identity that the user's browser generates and signs with.
  public type UserId = Principal;

  // Timestamp is the number of nanoseconds since the Unix epoch (Jan 1 1970).
  // Time.now() returns an Int in nanoseconds — use this type wherever a date/time is stored.
  public type Timestamp = Int;

  // ── Numeric IDs for each domain entity ───────────────────────────────────
  // Each domain uses a simple auto-incrementing Nat counter (see nextId variables
  // in the mixin files). These aliases make function signatures self-documenting.
  public type CategoryId = Nat;
  public type ProductId = Nat;
  public type BatchId = Nat;
  public type SaleId = Nat;
  public type PurchaseOrderId = Nat;
  public type CustomerId = Nat;
  public type MovementId = Nat;

  // ── Multi-tenancy key ─────────────────────────────────────────────────────
  // ProfileKey is a short text slug chosen by the Admin when creating a profile
  // (e.g. "myherbs2025"). Every data record stores its ProfileKey so that queries
  // can be filtered to return only that profile's data — strict data isolation.
  public type ProfileKey = Text;

  // ── Role hierarchy ────────────────────────────────────────────────────────
  // Five roles, ordered from most privileged to least:
  //   #superAdmin   — manages the entire canister; approves new profiles
  //   #admin        — manages one profile (creates staff, approves orders, etc.)
  //   #staff        — warehouse operations, sales, inventory; approval required
  //   #referralUser — can only create customers; approval required
  //   #regularUser  — read-only access to their own profile
  public type UserRole = { #superAdmin; #admin; #staff; #referralUser; #regularUser };

  // ── Warehouse identifiers ─────────────────────────────────────────────────
  // Warehouses are identified by a name string (e.g. "Main", "Branch", "Friend/Loaner").
  // WarehouseId is kept for future use but WarehouseName is the primary key in practice.
  public type WarehouseId = Nat;
  public type WarehouseName = Text;

  // ── Audit (who-column) types ──────────────────────────────────────────────
  // Every record in the system carries these four fields, which are auto-populated
  // on the backend. The frontend never sends them — the backend always overwrites
  // them with the actual caller principal and Time.now().
  //
  //   created_by      = caller principal the first time the record is written
  //   creation_date   = Time.now() at creation (immutable thereafter)
  //   last_updated_by = caller principal on the most recent update
  //   last_update_date= Time.now() on the most recent update
  public type WhoColumns = {
    created_by : UserId;
    last_updated_by : UserId;
    creation_date : Timestamp;
    last_update_date : Timestamp;
  };

  // ── Discount variants ─────────────────────────────────────────────────────
  // Used on Customer records and Sales to describe how a discount is calculated:
  //   #Percentage — e.g. 10% off the subtotal
  //   #Fixed      — e.g. ₹50 off the subtotal
  public type DiscountType = { #Percentage; #Fixed };

  // ── Payment types ─────────────────────────────────────────────────────────
  // PaymentMode: how the customer paid
  //   #Cash | #Card | #Check | #BankTransfer | #Other
  //
  // PaymentStatus: current payment state of an order
  //   #Paid    — fully settled; cannot be changed once set
  //   #Unpaid  — no payment recorded yet
  //   #Partial — some amount paid but balance remains
  public type PaymentMode = { #Cash; #Card; #Check; #BankTransfer; #Other };
  public type PaymentStatus = { #Paid; #Unpaid; #Partial };

  // ── Location master entry ─────────────────────────────────────────────────
  // Used for the Indian State/City/Country dropdown lists on the customer form.
  //   id          — unique string key (e.g. "IN", "GJ", "AHM")
  //   name        — human-readable display name (e.g. "Gujarat", "Ahmedabad")
  //   parent_id   — null for countries; state id for cities; country id for states
  //   entry_type  — "country" | "state" | "city"
  public type LocationMasterEntry = {
    id : Text;
    name : Text;
    parent_id : ?Text;
    entry_type : Text;
  };

  // ── NotificationType ──────────────────────────────────────────────────────
  // Variant-based tag for notification records. The notification_type field on
  // Notification records is a Text string matching these variant names.
  // Kept here as documentation of all possible notification types in the system.
  //
  //   #StaffPendingApproval        — new staff joined, Admin must approve/reject
  //   #PaymentOverdue              — a sale's payment has been unpaid for 30+ days
  //   #CustomerFollowUp            — customer has not ordered in 20+ days
  //   #LoanedItemSold              — a loaned/temporary stock item was sold; Admin notified
  //   #NewProfilePendingApproval   — new profile registered; Super Admin must approve
  //   #ReferralUserPendingApproval — new referral user joined; Admin must approve
  //   #LeadFollowUpDue             — a lead customer's scheduled follow-up date has passed
  public type NotificationType = {
    #StaffPendingApproval;
    #PaymentOverdue;
    #CustomerFollowUp;
    #LoanedItemSold;
    #NewProfilePendingApproval;
    #ReferralUserPendingApproval;
    #LeadFollowUpDue;
  };

  // ── ReferralCommissionEntry ───────────────────────────────────────────────
  // Returned by the dashboard's getReferralCommissionByMonth query.
  // Groups total accrued referral commission per referral user, per calendar month.
  //   referral_user_principal    — the UserId (principal) of the referral user
  //   referral_user_display_name — their display name at query time
  //   profile_key                — which profile this commission belongs to
  //   month                      — ISO month string, e.g. "2024-03"
  //   total_commission           — sum of referral_commission_amount for customers
  //                                referred by this user who had sales in that month
  //   customer_count             — number of qualifying customers
  public type ReferralCommissionEntry = {
    referral_user_principal : UserId;
    referral_user_display_name : Text;
    profile_key : ProfileKey;
    month : Text;
    total_commission : Float;
    customer_count : Nat;
  };
};
