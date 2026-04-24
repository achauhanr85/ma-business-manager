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
  profileStore : ProfileLib.Store,
) {
  var nextPOId : Nat = 1;
  var nextPOBatchId : Nat = 1;

  public shared ({ caller }) func createPurchaseOrder(input : PurchaseTypes.PurchaseOrderInput) : async ?Common.PurchaseOrderId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");

    switch (ProfileLib.checkProfileAccess(profileStore, userStore, caller)) {
      case (#err(_)) { return null };
      case (#ok) {};
    };

    let id = PurchasesLib.createPurchaseOrder(
      poStore, poItemStore, userStore,
      caller, nextPOId, input,
    );
    nextPOId += 1;
    ?id
  };

  public shared query ({ caller }) func getPurchaseOrders() : async [PurchaseTypes.PurchaseOrder] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.getPurchaseOrders(poStore, userStore, caller)
  };

  /// Returns PO items for a given PO.
  /// #admin, #staff, and #superAdmin can view all items in their profile.
  public shared query ({ caller }) func getPurchaseOrderItems(po_id : Common.PurchaseOrderId) : async [PurchaseTypes.PurchaseOrderItem] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.getPurchaseOrderItems(poStore, poItemStore, userStore, caller, po_id)
  };

  public shared ({ caller }) func markPurchaseOrderReceived(po_id : Common.PurchaseOrderId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");

    switch (ProfileLib.checkProfileAccess(profileStore, userStore, caller)) {
      case (#err(_)) { return false };
      case (#ok) {};
    };

    let (ok, newBatchId) = PurchasesLib.markReceived(
      poStore, poItemStore, batchStore, userStore,
      caller, po_id, nextPOBatchId,
    );
    if (ok) { nextPOBatchId := newBatchId };
    ok
  };
};
