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

    // Dry-run — Governance Gatekeeper (PO create):
    //   Same check as createSale. If the profile is disabled or outside the active window,
    //   the call returns null instead of a valid PurchaseOrderId.
    //   This prevents new purchase orders from being raised on restricted profiles.
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

  public shared query ({ caller }) func getPurchaseOrderItems(po_id : Common.PurchaseOrderId) : async [PurchaseTypes.PurchaseOrderItem] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    PurchasesLib.getPurchaseOrderItems(poStore, poItemStore, caller, po_id)
  };

  public shared ({ caller }) func markPurchaseOrderReceived(po_id : Common.PurchaseOrderId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");

    // Dry-run — Governance Gatekeeper (PO receive):
    //   Receiving stock also goes through the governance check. An expired or disabled
    //   profile cannot receive stock (incrementing inventory) after the window closes.
    //   This ensures inventory data integrity aligns with profile governance state.
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
