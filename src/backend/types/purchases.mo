import Common "common";

module {
  public type POStatus = { #Pending; #Received };

  // ── PurchaseOrderItem ─────────────────────────────────────────────────────────
  // Dry-run: Stock-PO Loop
  //   When PO status → #Received, for each PurchaseOrderItem:
  //     inventory batch is created with quantity = item.quantity
  //     product's current_stock += item.quantity
  //   If DB write fails mid-loop → entire message rolls back (actor atomicity)
  //   Verify: stock count increased by exactly item.quantity per product
  public type PurchaseOrderItem = {
    po_id : Common.PurchaseOrderId;
    product_id : Common.ProductId;
    quantity : Nat;
    unit_cost : Float;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns
  public type PurchaseOrderItemInput = {
    product_id : Common.ProductId;
    quantity : Nat;
    unit_cost : Float;
  };

  // ── PurchaseOrder ─────────────────────────────────────────────────────────────
  public type PurchaseOrder = {
    id : Common.PurchaseOrderId;
    vendor : Text;
    timestamp : Common.Timestamp;
    status : POStatus;
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    owner : Common.UserId;

    // PO number — user-enterable or auto-generated with "PO-" prefix
    po_number : ?Text;                   // e.g. "PO-0001" or user-defined
    vendor_id : ?Text;                   // Reference to Vendor record id
    vendor_name : ?Text;                 // Snapshot of vendor name at PO creation

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns
  public type PurchaseOrderInput = {
    vendor : Text;
    warehouse_name : Common.WarehouseName;
    items : [PurchaseOrderItemInput];
    po_number : ?Text;                   // Optional user-entered PO number; auto-generated if null
    vendor_id : ?Text;                   // Optional reference to a Vendor record
    vendor_name : ?Text;                 // Optional snapshot of vendor name
  };
};
