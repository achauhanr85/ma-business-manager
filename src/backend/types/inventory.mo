import Common "common";

module {
  // ── LoanedItemStatus ──────────────────────────────────────────────────────────
  // Tracks lifecycle of a loaned/temporary third-party inventory batch.
  //   #active  — item is in a warehouse, available for sale or return
  //   #archived — item has been returned to the source friend/owner
  public type LoanedItemStatus = { #active; #archived };

  // ── StagedBatchStatus ─────────────────────────────────────────────────────────
  // Tracks review state of items in Stage Inventory (returned items awaiting review).
  //   #pending  — awaiting Admin review
  //   #accepted — Admin approved; items moved to main warehouse
  //   #rejected — Admin rejected; items discarded/archived
  public type StagedBatchStatus = { #pending; #accepted; #rejected };

  // ── InventoryBatch ────────────────────────────────────────────────────────────
  // quantity_remaining is var for FIFO deduction during sales.
  // Dry-run: Stock-PO Loop
  //   On PO receive: new InventoryBatch created with quantity_remaining = po_item.quantity
  //   FIFO deduction: oldest batch (lowest date_received) consumed first on each sale
  //   Atomic rollback: if any batch update fails, entire sale message rolls back
  //
  // Loaner stock fields:
  //   is_loaned      — true for Friend/Loaner Inventory batches; excluded from COGS
  //   loaned_source  — free-text description of the friend/external source
  //   loaned_status  — #active while in use; #archived after returned to source
  public type InventoryBatch = {
    id : Common.BatchId;
    product_id : Common.ProductId;
    var quantity_remaining : Nat;
    unit_cost : Float;
    date_received : Common.Timestamp;
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    owner : Common.UserId;

    // Loaner/temporary third-party stock tracking
    is_loaned : Bool;                        // true = Friend/Loaner Inventory; excluded from COGS
    loaned_source : ?Text;                   // e.g. "Ravi's shop" — description of the source
    loaned_status : ?LoanedItemStatus;       // #active | #archived (null for non-loaned batches)

    // Stage Inventory tracking — set when a batch is created from a return order
    staged_status : ?StagedBatchStatus;      // null = regular batch; set for stage inventory items
    return_order_id : ?Common.SaleId;        // links back to the return order that created this batch

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

    // Loaner stock fields (mirrored from InventoryBatch)
    is_loaned : Bool;
    loaned_source : ?Text;
    loaned_status : ?LoanedItemStatus;

    // Stage Inventory fields (mirrored from InventoryBatch)
    staged_status : ?StagedBatchStatus;
    return_order_id : ?Common.SaleId;
  };

  public type InventoryLevel = {
    product_id : Common.ProductId;
    total_qty : Nat;
    batches : [InventoryBatchPublic];
  };

  // ── InventoryMovement ─────────────────────────────────────────────────────────
  // is_loaned_move — true when this movement involves loaned/temporary stock.
  // Tagging movements allows the reconciliation audit trail to distinguish
  // ordinary stock moves from loaner transfers (e.g. Virtual → Staff → Return).
  public type InventoryMovement = {
    id : Common.MovementId;
    profile_key : Common.ProfileKey;
    product_id : Common.ProductId;
    from_warehouse : Common.WarehouseName;
    to_warehouse : Common.WarehouseName;
    quantity : Nat;
    moved_at : Common.Timestamp;
    moved_by : Common.UserId;

    // Loaner move flag — set to true when moving loaned stock
    is_loaned_move : Bool;

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

    // Optional — set true when moving loaned/temporary stock
    is_loaned_move : ?Bool;
    loaned_source : ?Text;                   // required when receiving into Loaner Inventory
  };
};
