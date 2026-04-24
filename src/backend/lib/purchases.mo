import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import PurchaseTypes "../types/purchases";
import InventoryTypes "../types/inventory";
import UserTypes "../types/users";
import InventoryLib "inventory";

module {
  public type POStore = Map.Map<Common.PurchaseOrderId, PurchaseTypes.PurchaseOrder>;
  public type POItemStore = Map.Map<Common.PurchaseOrderId, [PurchaseTypes.PurchaseOrderItem]>;

  public func createPurchaseOrder(
    poStore : POStore,
    poItemStore : POItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextPOId : Nat,
    nextBatchId : Nat,
    input : PurchaseTypes.PurchaseOrderInput,
  ) : Common.PurchaseOrderId {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    let now = Time.now();
    let po : PurchaseTypes.PurchaseOrder = {
      id = nextPOId;
      vendor = input.vendor;
      timestamp = now;
      status = #Pending;
      profile_key = up.profile_key;
      warehouse_name = input.warehouse_name;
      owner = caller;
    };
    poStore.add(nextPOId, po);

    // Build PO items and immediately add inventory batches
    var items : [PurchaseTypes.PurchaseOrderItem] = [];
    var batchIdCounter = nextBatchId;
    for (itemInput in input.items.values()) {
      let poItem : PurchaseTypes.PurchaseOrderItem = {
        po_id = nextPOId;
        product_id = itemInput.product_id;
        quantity = itemInput.quantity;
        unit_cost = itemInput.unit_cost;
      };
      items := items.concat([poItem]);
      // Add inventory batch for each item
      let _ = InventoryLib.addBatch(batchStore, caller, up.profile_key, input.warehouse_name, batchIdCounter, itemInput.product_id, itemInput.quantity, itemInput.unit_cost, now);
      batchIdCounter += 1;
    };
    poItemStore.add(nextPOId, items);
    nextPOId
  };

  public func getPurchaseOrders(store : POStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : [PurchaseTypes.PurchaseOrder] {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    store.entries()
      .filter(func((_id, po)) { po.profile_key == up.profile_key })
      .map<(Common.PurchaseOrderId, PurchaseTypes.PurchaseOrder), PurchaseTypes.PurchaseOrder>(func((_id, po)) { po })
      .toArray()
  };

  public func getPurchaseOrderItems(poStore : POStore, itemStore : POItemStore, caller : Common.UserId, po_id : Common.PurchaseOrderId) : [PurchaseTypes.PurchaseOrderItem] {
    switch (poStore.get(po_id)) {
      case null [];
      case (?po) {
        if (po.owner != caller) return [];
        switch (itemStore.get(po_id)) {
          case (?items) items;
          case null [];
        }
      };
    }
  };

  public func markReceived(
    poStore : POStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    po_id : Common.PurchaseOrderId,
  ) : Bool {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null return false;
    };
    switch (poStore.get(po_id)) {
      case null false;
      case (?po) {
        if (po.profile_key != up.profile_key) return false;
        poStore.add(po_id, {
          id = po.id;
          vendor = po.vendor;
          timestamp = po.timestamp;
          status = #Received;
          profile_key = po.profile_key;
          warehouse_name = po.warehouse_name;
          owner = po.owner;
        });
        true
      };
    }
  };
};
