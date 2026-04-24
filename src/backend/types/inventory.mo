import Common "common";

module {
  // ── InventoryBatch ────────────────────────────────────────────────────────────
  // quantity_remaining is var for FIFO deduction during sales.
  // Dry-run: Stock-PO Loop
  //   On PO receive: new InventoryBatch created with quantity_remaining = po_item.quantity
  //   FIFO deduction: oldest batch (lowest date_received) consumed first on each sale
  //   Atomic rollback: if any batch update fails, entire sale message rolls back
  public type InventoryBatch = {
    id : Common.BatchId;
    product_id : Common.ProductId;
    var quantity_remaining : Nat;
    unit_cost : Float;
    date_received : Common.Timestamp;
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    owner : Common.UserId;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Public projection — no var fields (shared type constraint)
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

  // ── InventoryMovement ─────────────────────────────────────────────────────────
  public type InventoryMovement = {
    id : Common.MovementId;
    profile_key : Common.ProfileKey;
    product_id : Common.ProductId;
    from_warehouse : Common.WarehouseName;
    to_warehouse : Common.WarehouseName;
    quantity : Nat;
    moved_at : Common.Timestamp;
    moved_by : Common.UserId;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns
  public type InventoryMovementInput = {
    product_id : Common.ProductId;
    from_warehouse : Common.WarehouseName;
    to_warehouse : Common.WarehouseName;
    quantity : Nat;
  };
};
