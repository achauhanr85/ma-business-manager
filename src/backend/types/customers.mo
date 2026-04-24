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
  };

  // Result for fuzzy duplicate detection
  public type DuplicateCheckResult = {
    has_similar : Bool;
    similar_customers : [CustomerPublic];
  };
};
