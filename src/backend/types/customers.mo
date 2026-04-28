import Common "common";

module {
  // ── Customer ─────────────────────────────────────────────────────────────────
  // discount_applicable / discount_value define the customer's default discount.
  // When a sale is created for this customer the sales engine reads these fields
  // and applies the discount automatically to the subtotal.
  //
  // Dry-run: Discount/Order Edit Collision
  //   Customer has discount_applicable = #Percentage, discount_value = 10.0
  //   New sale item costs $100 → subtotal = $100
  //   Applied discount = 100 * (10/100) = $10
  //   Final sale price = $90.  balance_due updated on the Sale record accordingly.
  //
  // notes: append-only log of structured CustomerNote entries shown in History tab.
  //
  // Referral fields:
  //   referred_by               — display name or principal text of the Referral User
  //                               who referred this customer. Null if walk-in.
  //   referral_commission_amount — commission amount accrued for this customer's sales
  //                                to the referring Referral User. Null if not referred.
  //
  // primary_goal_ids  — IDs from GoalMaster referencing the customer's primary goals
  // medical_issue_ids — IDs from MedicalIssueMaster referencing the customer's conditions
  // lead_to_active_datetime — timestamp when customer status changed from #lead to #active

  // ── CustomerNote ─────────────────────────────────────────────────────────────
  // Structured note entry; replaces the old [Text] notes field.
  // Multiple notes are allowed per customer; each carries a date and author.
  public type CustomerNote = {
    id : Nat;
    text : Text;
    note_date : Common.Timestamp;
    created_by : Text;
    creation_date : Common.Timestamp;
  };

  public type CustomerNoteInput = {
    text : Text;
    note_date : Common.Timestamp;
  };

  public type Customer = {
    id : Common.CustomerId;
    profile_key : Common.ProfileKey;
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    created_at : Common.Timestamp;
    total_sales : Nat;
    last_purchase_at : Common.Timestamp;
    lifetime_revenue : Float;

    // Discount fields
    discount_applicable : ?Common.DiscountType;
    discount_value : ?Float;             // Percentage (0-100) or fixed amount

    // Structured notes (append-only, multi-note with date)
    notes : [CustomerNote];

    // Personal info
    date_of_birth : ?Text;               // Optional ISO date YYYY-MM-DD
    gender : ?Text;                      // "Male" | "Female" | "Other"
    height : ?Text;                      // e.g. "5'10" or "178 cm"
    age : ?Nat;                          // Computed from date_of_birth; stored as cache

    // Structured address fields (kept alongside legacy `address` for backward compat)
    address_line1 : ?Text;
    address_line2 : ?Text;
    state : ?Text;
    city : ?Text;
    country : ?Text;
    pin_code : ?Text;

    // Created-by override — allows Admin/Staff to assign a specific creator
    customer_created_by : ?Common.UserId;

    // Referral tracking
    referred_by : ?Text;
    referral_commission_amount : ?Float;

    // Customer lifecycle — Lead/Active/Inactive classification
    customer_type : { #lead; #active; #inactive };

    // Lead follow-up scheduling
    lead_follow_up_date : ?Int;
    lead_notes : ?Text;

    // Goal and medical issue links (IDs referencing master data)
    primary_goal_ids : [Nat];
    medical_issue_ids : [Nat];

    // Lifecycle state change datetime
    lead_to_active_datetime : ?Common.Timestamp;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns, no computed aggregates
  public type CustomerInput = {
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    discount_applicable : ?Common.DiscountType;
    discount_value : ?Float;
    note : ?Text;                        // Legacy single-note append (kept for backward compat)
    notes : ?[CustomerNoteInput];        // Optional structured notes to append
    date_of_birth : ?Text;
    gender : ?Text;
    height : ?Text;
    age : ?Nat;
    address_line1 : ?Text;
    address_line2 : ?Text;
    state : ?Text;
    city : ?Text;
    country : ?Text;
    pin_code : ?Text;
    body_composition : ?[BodyCompositionInput];

    customer_created_by : ?Common.UserId;

    // Referral fields (optional)
    referred_by : ?Text;
    referral_commission_amount : ?Float;

    // Customer lifecycle
    customer_type : ?{ #lead; #active; #inactive };
    lead_follow_up_date : ?Int;
    lead_notes : ?Text;

    // Goal and medical issue links
    primary_goal_ids : ?[Nat];
    medical_issue_ids : ?[Nat];

    // Lifecycle state change datetime
    lead_to_active_datetime : ?Common.Timestamp;
  };

  // Public projection
  public type CustomerPublic = {
    id : Common.CustomerId;
    profile_key : Common.ProfileKey;
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    created_at : Common.Timestamp;
    total_sales : Nat;
    last_purchase_at : Common.Timestamp;
    lifetime_revenue : Float;
    discount_applicable : ?Common.DiscountType;
    discount_value : ?Float;
    notes : [CustomerNote];
    date_of_birth : ?Text;
    gender : ?Text;
    height : ?Text;
    age : ?Nat;
    address_line1 : ?Text;
    address_line2 : ?Text;
    state : ?Text;
    city : ?Text;
    country : ?Text;
    pin_code : ?Text;

    customer_created_by : ?Common.UserId;

    // Referral fields
    referred_by : ?Text;
    referral_commission_amount : ?Float;

    // Customer lifecycle
    customer_type : { #lead; #active; #inactive };
    lead_follow_up_date : ?Int;
    lead_notes : ?Text;

    // Goal and medical issue links
    primary_goal_ids : [Nat];
    medical_issue_ids : [Nat];

    // Lifecycle state change datetime
    lead_to_active_datetime : ?Common.Timestamp;
  };

  // Result for fuzzy duplicate detection
  public type DuplicateCheckResult = {
    has_similar : Bool;
    similar_customers : [CustomerPublic];
  };

  // ── BodyCompositionEntry ──────────────────────────────────────────────────────
  public type BodyCompositionEntry = {
    id : Text;
    customer_id : Text;
    profile_key : Common.ProfileKey;
    date : Text;                         // ISO date YYYY-MM-DD
    weight : ?Float;
    body_fat : ?Float;
    visceral_fat : ?Float;
    bmr : ?Float;
    bmi : ?Float;
    body_age : ?Nat;
    trunk_fat : ?Float;
    muscle_mass : ?Float;                // kg — negative values allowed
    created_by : Text;
    creation_date : Common.Timestamp;
  };

  public type BodyCompositionInput = {
    date : Text;
    weight : ?Float;
    body_fat : ?Float;
    visceral_fat : ?Float;
    bmr : ?Float;
    bmi : ?Float;
    body_age : ?Nat;
    trunk_fat : ?Float;
    muscle_mass : ?Float;
  };

  // ── BodyInchesEntry ───────────────────────────────────────────────────────────
  // Tracks body-measurement inches at a point in time.
  // All measurement fields are optional — only captured fields are stored.
  public type BodyInchesEntry = {
    id : Nat;
    customer_id : Nat;
    profile_key : Common.ProfileKey;
    entry_date : Common.Timestamp;
    chest : ?Float;
    biceps : ?Float;
    waist : ?Float;
    hips : ?Float;
    thighs : ?Float;
    calves : ?Float;
    created_by : Text;
    creation_date : Common.Timestamp;
  };

  public type BodyInchesInput = {
    entry_date : Common.Timestamp;
    chest : ?Float;
    biceps : ?Float;
    waist : ?Float;
    hips : ?Float;
    thighs : ?Float;
    calves : ?Float;
  };

  // BodyInchesPublic mirrors BodyInchesEntry (all fields are already shared types)
  public type BodyInchesPublic = BodyInchesEntry;
};
