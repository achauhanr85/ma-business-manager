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
  // notes: append-only log of free-text interaction notes shown in History tab.
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

    // Interaction notes (chronological, append-only)
    notes : [Text];

    // Personal info
    date_of_birth : ?Text;               // Optional ISO date YYYY-MM-DD
    gender : ?Text;                      // "Male" | "Female" | "Other"

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns, no computed aggregates
  // note: optional free-text to append to the customer's notes log on create/update
  public type CustomerInput = {
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    discount_applicable : ?Common.DiscountType;
    discount_value : ?Float;
    note : ?Text;
    date_of_birth : ?Text;               // Optional ISO date YYYY-MM-DD
    gender : ?Text;                      // "Male" | "Female" | "Other"
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
    notes : [Text];
    date_of_birth : ?Text;               // Optional ISO date YYYY-MM-DD
    gender : ?Text;                      // "Male" | "Female" | "Other"
  };

  // Result for fuzzy duplicate detection
  public type DuplicateCheckResult = {
    has_similar : Bool;
    similar_customers : [CustomerPublic];
  };

  // ── BodyCompositionEntry ──────────────────────────────────────────────────────
  // Tracks a customer's body composition measurement at a point in time.
  // All measurement fields are optional — only fields measured are stored.
  public type BodyCompositionEntry = {
    id : Text;                           // UUID
    customer_id : Text;
    profile_key : Common.ProfileKey;
    date : Text;                         // ISO date YYYY-MM-DD
    weight : ?Float;                     // kg
    body_fat : ?Float;                   // percentage
    visceral_fat : ?Float;               // index
    bmr : ?Float;                        // kcal
    bmi : ?Float;
    body_age : ?Nat;                     // years
    trunk_fat : ?Float;                  // percentage
    muscle_mass : ?Float;                // kg
    created_by : Text;
    creation_date : Common.Timestamp;
  };

  // Input — no id, customer_id, profile_key, or creation fields
  public type BodyCompositionInput = {
    date : Text;                         // ISO date YYYY-MM-DD
    weight : ?Float;
    body_fat : ?Float;
    visceral_fat : ?Float;
    bmr : ?Float;
    bmi : ?Float;
    body_age : ?Nat;
    trunk_fat : ?Float;
    muscle_mass : ?Float;
  };
};
