import Common "common";

module {
  public type InventoryBatch = {
    id : Common.BatchId;
    product_id : Common.ProductId;
    var quantity_remaining : Nat;
    unit_cost : Float;
    date_received : Common.Timestamp;
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    owner : Common.UserId;
  };

  public type InventoryBatchPublic = {
    id : Common.BatchId;
    product_id : Common.ProductId;
    quantity_remaining : Nat;
    unit_cost : Float;
    date_received : Common.Timestamp;
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
  };

  public type InventoryLevel = {
    product_id : Common.ProductId;
    total_qty : Nat;
    batches : [InventoryBatchPublic];
  };

  public type InventoryMovement = {
    id : Common.MovementId;
    profile_key : Common.ProfileKey;
    product_id : Common.ProductId;
    from_warehouse : Common.WarehouseName;
    to_warehouse : Common.WarehouseName;
    quantity : Nat;
    moved_at : Common.Timestamp;
    moved_by : Common.UserId;
  };

  public type InventoryMovementInput = {
    product_id : Common.ProductId;
    from_warehouse : Common.WarehouseName;
    to_warehouse : Common.WarehouseName;
    quantity : Nat;
  };
};
