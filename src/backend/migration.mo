/// Explicit migration module for canister upgrade.
///
/// Wave 2 changes requiring migration:
///   1. InventoryBatch — adds `return_order_id : ?SaleId` and `staged_status : ?StagedBatchStatus`
///   2. Sale           — adds `payment_history : [PaymentEntry]`
///
/// Old types are defined inline (copied from the previous stable signature).
/// New types are imported from the current types modules.
///
/// Migration strategy:
///   - For each InventoryBatch in batchStore: add the two new fields, both defaulting to null
///   - For each Sale in saleStore:           add payment_history, defaulting to []
///   - All other stores are stable-compatible (only new fields added); no transformation needed.

import Map "mo:core/Map";

import InvTypes "types/inventory";
import SalesTypes "types/sales";
import Common "types/common";

module {

  // ── Old type definitions (inline — do NOT import from .old/) ─────────────────

  type OldLoanedItemStatus = { #active; #archived };

  type OldInventoryBatch = {
    id : Common.BatchId;
    product_id : Common.ProductId;
    var quantity_remaining : Nat;
    unit_cost : Float;
    date_received : Common.Timestamp;
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    owner : Common.UserId;
    is_loaned : Bool;
    loaned_source : ?Text;
    loaned_status : ?OldLoanedItemStatus;
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
    // NOTE: return_order_id and staged_status are ABSENT in the old type
  };

  type OldPaymentMode = { #Cash; #Card; #Check; #BankTransfer; #Other };
  type OldPaymentStatus = { #Paid; #Unpaid; #Partial };
  type OldDiscountType = { #Percentage; #Fixed };
  type OldOrderType = { #standard; #return_ };

  type OldSale = {
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
    original_subtotal : ?Float;
    discount_type : ?OldDiscountType;
    discount_applied : ?Float;
    payment_mode : ?OldPaymentMode;
    payment_status : ?OldPaymentStatus;
    amount_paid : ?Float;
    balance_due : ?Float;
    payment_due_date : ?Text;
    sale_note : ?Text;
    // NOTE: payment_history is ABSENT in the old type
    order_type : ?OldOrderType;
    return_of_sale_id : ?Common.SaleId;
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── Old actor stable state ────────────────────────────────────────────────────

  public type OldActor = {
    batchStore : Map.Map<Common.BatchId, OldInventoryBatch>;
    saleStore  : Map.Map<Common.SaleId, OldSale>;
  };

  // ── New actor stable state ────────────────────────────────────────────────────

  public type NewActor = {
    batchStore : Map.Map<Common.BatchId, InvTypes.InventoryBatch>;
    saleStore  : Map.Map<Common.SaleId, SalesTypes.Sale>;
  };

  // ── Migration function ────────────────────────────────────────────────────────

  public func run(old : OldActor) : NewActor {

    // 1. Migrate batchStore — add return_order_id and staged_status (both null)
    // Must copy all fields explicitly because InventoryBatch has a `var` field (quantity_remaining),
    // which prevents record spread `{ b with ... }` (M0179).
    let newBatchStore = old.batchStore.map<Common.BatchId, OldInventoryBatch, InvTypes.InventoryBatch>(
      func(_id, b) {
        {
          id                = b.id;
          product_id        = b.product_id;
          var quantity_remaining = b.quantity_remaining;
          unit_cost         = b.unit_cost;
          date_received     = b.date_received;
          profile_key       = b.profile_key;
          warehouse_name    = b.warehouse_name;
          owner             = b.owner;
          is_loaned         = b.is_loaned;
          loaned_source     = b.loaned_source;
          loaned_status     = (b.loaned_status : ?InvTypes.LoanedItemStatus);
          return_order_id   = null : ?Common.SaleId;
          staged_status     = null : ?InvTypes.StagedBatchStatus;
          created_by        = b.created_by;
          last_updated_by   = b.last_updated_by;
          creation_date     = b.creation_date;
          last_update_date  = b.last_update_date;
        }
      }
    );

    // 2. Migrate saleStore — add payment_history = []
    let newSaleStore = old.saleStore.map<Common.SaleId, OldSale, SalesTypes.Sale>(
      func(_id, s) {
        {
          s with
          discount_type   = (s.discount_type   : ?Common.DiscountType);
          payment_mode    = (s.payment_mode     : ?Common.PaymentMode);
          payment_status  = (s.payment_status   : ?Common.PaymentStatus);
          order_type      = (s.order_type       : ?SalesTypes.OrderType);
          payment_history = [] : [SalesTypes.PaymentEntry];
        }
      }
    );

    {
      batchStore = newBatchStore;
      saleStore  = newSaleStore;
    }
  };
};
