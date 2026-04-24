import Common "common";

module {
  public type InventoryBatch = {
    id : Common.BatchId;
    product_id : Common.ProductId;
    var quantity_remaining : Nat;
    unit_cost : Float;
    date_received : Common.Timestamp;
    owner : Common.UserId;
  };

  public type InventoryBatchPublic = {
    id : Common.BatchId;
    product_id : Common.ProductId;
    quantity_remaining : Nat;
    unit_cost : Float;
    date_received : Common.Timestamp;
  };

  public type InventoryLevel = {
    product_id : Common.ProductId;
    total_qty : Nat;
    batches : [InventoryBatchPublic];
  };
};
