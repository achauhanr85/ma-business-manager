import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Common "../types/common";
import PurchaseTypes "../types/purchases";
import InventoryLib "../lib/inventory";
import PurchasesLib "../lib/purchases";

mixin (
  poStore : PurchasesLib.POStore,
  poItemStore : PurchasesLib.POItemStore,
  batchStore : InventoryLib.BatchStore,
) {
  var nextPOId : Nat = 1;
  var nextBatchId : Nat = 1;

  public shared ({ caller }) func createPurchaseOrder(input : PurchaseTypes.PurchaseOrderInput) : async Common.PurchaseOrderId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let poId = PurchasesLib.createPurchaseOrder(poStore, poItemStore, batchStore, caller, nextPOId, nextBatchId, input);
    nextBatchId += input.items.size();
    nextPOId += 1;
    poId;
  };

  public shared query ({ caller }) func getPurchaseOrders() : async [PurchaseTypes.PurchaseOrder] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.getPurchaseOrders(poStore, caller);
  };

  public shared query ({ caller }) func getPurchaseOrderItems(po_id : Common.PurchaseOrderId) : async [PurchaseTypes.PurchaseOrderItem] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.getPurchaseOrderItems(poStore, poItemStore, caller, po_id);
  };

  public shared ({ caller }) func markPurchaseOrderReceived(po_id : Common.PurchaseOrderId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.markReceived(poStore, poItemStore, batchStore, caller, po_id, nextBatchId, Time.now());
  };
};
