import Runtime "mo:core/Runtime";
import Common "../types/common";
import PurchaseTypes "../types/purchases";
import InventoryLib "../lib/inventory";
import PurchasesLib "../lib/purchases";
import ProfileLib "../lib/profile";

mixin (
  poStore : PurchasesLib.POStore,
  poItemStore : PurchasesLib.POItemStore,
  batchStore : InventoryLib.BatchStore,
  userStore : ProfileLib.UserStore,
) {
  var nextPOId : Nat = 1;
  var nextPOBatchId : Nat = 1;

  public shared ({ caller }) func createPurchaseOrder(input : PurchaseTypes.PurchaseOrderInput) : async Common.PurchaseOrderId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let id = PurchasesLib.createPurchaseOrder(
      poStore, poItemStore, batchStore, userStore,
      caller, nextPOId, nextPOBatchId, input,
    );
    nextPOId += 1;
    nextPOBatchId += input.items.size();
    id
  };

  public shared query ({ caller }) func getPurchaseOrders() : async [PurchaseTypes.PurchaseOrder] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.getPurchaseOrders(poStore, userStore, caller)
  };

  public shared query ({ caller }) func getPurchaseOrderItems(po_id : Common.PurchaseOrderId) : async [PurchaseTypes.PurchaseOrderItem] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.getPurchaseOrderItems(poStore, poItemStore, caller, po_id)
  };

  public shared ({ caller }) func markPurchaseOrderReceived(po_id : Common.PurchaseOrderId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.markReceived(poStore, userStore, caller, po_id)
  };
};
