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
};
