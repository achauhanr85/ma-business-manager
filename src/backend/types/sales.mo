import Common "common";

module {
  // ── PaymentEntry — individual payment record against a sale ──────────────────
  // Each time a payment is made (full or partial), a PaymentEntry is appended.
  // payment_status on the Sale record is DERIVED from these entries, never manually set.
  public type PaymentEntry = {
    id : Text;                           // Unique ID: saleId # "_pmt_" # index
    payment_date : Common.Timestamp;
    amount : Float;
    payment_method : Text;               // "Cash" | "Card" | "Check" | "BankTransfer" | "Other"
    recorded_by : Text;                  // Caller display name or principal text
  };

  // ── CartItem — client input for each line in a new sale ──────────────────────
  public type CartItem = {
    product_id : Common.ProductId;
    quantity : Nat;
    actual_sale_price : Float;
    product_instructions : ?Text;        // Snapshot of product instructions at cart time

    // Temporary/loaned stock flag — Staff can toggle this during sale entry
    // to indicate the item originated from Friend/Loaner Inventory.
    is_loaned_item : ?Bool;
  };

  // ── SaleItem — persisted snapshot at sale time ───────────────────────────────
  // Snapshots are immutable after creation; who-columns are populated server-side.
  public type SaleItem = {
    sale_id : Common.SaleId;
    product_id : Common.ProductId;
    product_name_snapshot : Text;
    unit_cost_snapshot : Float;
    mrp_snapshot : Float;
    volume_points_snapshot : Float;
    quantity : Nat;
    actual_sale_price : Float;
    product_instructions : ?Text;        // Snapshot of product instructions at time of sale

    // Loaned stock flag — true when this line item originated from Friend/Loaner Inventory.
    // Triggers an Admin notification that payout/replacement is owed to the source.
    is_loaned_item : Bool;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── Sale — persisted order header ────────────────────────────────────────────
  // Discount audit trail:
  //   original_subtotal  = sum of (actual_sale_price * quantity) before discount
  //   discount_type      = mirrors the customer's discount_applicable at sale time
  //   discount_applied   = computed deduction amount stored for historical audit
  //   total_revenue      = original_subtotal - discount_applied
  //
  // Payment tracking:
  //   payment_mode    = how the customer paid
  //   payment_status  = Paid / Unpaid / Partial
  //   amount_paid     = amount received so far
  //   balance_due     = total_revenue - amount_paid
  //
  // Order type:
  //   order_type      = #standard (default) or #return
  //   return_of_sale_id = for return orders, the ID of the original sale being returned
  //
  // Dry-run: Order Edit Collision
  //   Editing a Placed order with a $100 item added:
  //     original_subtotal increases by $100
  //     discount_applied  = new_subtotal * (discount_value/100)  [for #Percentage]
  //     total_revenue     = new_subtotal - discount_applied
  //     balance_due       = total_revenue - amount_paid (recomputed)
  //   Inventory is adjusted: new items decrement stock, removed items restore stock.
  public type Sale = {
    id : Common.SaleId;
    profile_key : Common.ProfileKey;
    timestamp : Common.Timestamp;
    total_revenue : Float;
    total_volume_points : Float;
    total_profit : Float;
    customer_id : Common.CustomerId;
    customer_name : Text;
    sold_by : Common.UserId;
    owner : Common.UserId;

    // Discount audit trail (stored at time of sale for immutable history)
    original_subtotal : ?Float;
    discount_type : ?Common.DiscountType;
    discount_applied : ?Float;           // Actual deduction amount in currency

    // Payment tracking
    payment_mode : ?Common.PaymentMode;
    payment_status : ?Common.PaymentStatus;
    amount_paid : ?Float;
    balance_due : ?Float;
    payment_due_date : ?Text;            // ISO date string for future payment due date

    // Per-sale note — printed on receipt
    sale_note : ?Text;

    // Payment history — append-only log; payment_status is DERIVED from this
    payment_history : [PaymentEntry];

    // Order type — #standard (default) or #return
    // For return orders, return_of_sale_id links back to the original sale.
    order_type : ?OrderType;
    return_of_sale_id : ?Common.SaleId;  // Populated for return orders only

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── OrderType — Standard sale or Return order ────────────────────────────────
  public type OrderType = { #standard; #return_ };

  // ── SaleInput — client input for creating a new sale ────────────────────────
  // Does NOT include who-columns or computed fields.
  public type SaleInput = {
    cart_items : [CartItem];
    customer_id : Common.CustomerId;
    payment_mode : ?Common.PaymentMode;
    payment_status : ?Common.PaymentStatus;
    amount_paid : ?Float;
    sale_note : ?Text;                   // Optional per-sale note printed on receipt
    payment_due_date : ?Text;            // ISO date string for future payment due date
    order_type : ?OrderType;             // Defaults to #standard if null
    return_of_sale_id : ?Common.SaleId; // Required when order_type = #return_
  };

  // ── UpdateSaleInput — client input for editing a Placed order ────────────────
  // Dry-run: Stock-PO Loop analog for order edits:
  //   For each removed item → inventory batch quantity_remaining += removed_qty
  //   For each new item     → FIFO deduction from inventory batches
  //   If DB fails mid-update → full rollback (Motoko actor state is atomic per message)
  public type UpdateSaleInput = {
    sale_id : Common.SaleId;
    items : [CartItem];                  // Full replacement item list
    payment_mode : ?Common.PaymentMode;
    payment_status : ?Common.PaymentStatus;
    amount_paid : ?Float;
    sale_note : ?Text;                   // Optional per-sale note
    payment_due_date : ?Text;            // ISO date string for future payment due date
  };

  // ── CustomerOrderDetail — full order with items for History tab ──────────────
  // Also returned by getLastSaleForCustomer for cart auto-fill and return validation.
  public type CustomerOrderDetail = {
    sale : Sale;
    items : [SaleItem];
  };

  // ── ReturnItem — each item being returned in a return order ──────────────────
  public type ReturnItem = {
    product_id : Common.ProductId;
    qty : Nat;
    unit_price : Float;
    is_usable : Bool;                    // true = goes to Stage Inventory; false = discard
  };

  // ── ReturnOrderResult — returned by createReturnOrder ────────────────────────
  public type ReturnOrderResult = {
    success : Bool;
    return_order_id : ?Common.SaleId;
    error : ?Text;
  };
};
