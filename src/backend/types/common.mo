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

  // Three-tier role hierarchy
  public type UserRole = { #superAdmin; #admin; #subAdmin };

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
};
