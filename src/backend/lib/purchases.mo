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

  /// Create a PO and record its items — does NOT create inventory batches.
  /// Batches are created only when the PO is marked as received.
  public func createPurchaseOrder(
    poStore : POStore,
    poItemStore : POItemStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextPOId : Nat,
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
      // Who-columns
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    poStore.add(nextPOId, po);

    // Record PO items (no batch creation here)
    var items : [PurchaseTypes.PurchaseOrderItem] = [];
    for (itemInput in input.items.values()) {
      let poItem : PurchaseTypes.PurchaseOrderItem = {
        po_id = nextPOId;
        product_id = itemInput.product_id;
        quantity = itemInput.quantity;
        unit_cost = itemInput.unit_cost;
        // Who-columns on item level
        created_by = caller;
        last_updated_by = caller;
        creation_date = now;
        last_update_date = now;
      };
      items := items.concat([poItem]);
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

  /// Returns PO line items.
  /// #admin, #staff, and #superAdmin can view all items for a PO in their profile.
  /// Regular users (if any) only see POs they own.
  public func getPurchaseOrderItems(
    poStore : POStore,
    itemStore : POItemStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    po_id : Common.PurchaseOrderId,
  ) : [PurchaseTypes.PurchaseOrderItem] {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null return [];
    };
    switch (poStore.get(po_id)) {
      case null [];
      case (?po) {
        // Must be same profile
        if (po.profile_key != up.profile_key) return [];
        // Admin-level roles see all items; others only see their own POs
        let canView = up.role == #admin or up.role == #staff or up.role == #superAdmin or po.owner == caller;
        if (not canView) return [];
        switch (itemStore.get(po_id)) {
          case (?items) items;
          case null [];
        }
      };
    }
  };

  /// Mark a PO as received and create inventory batches for each item.
  ///
  /// Returns (true, newNextBatchId) on success.
  /// Returns (false, unchanged nextBatchId) if PO not found, wrong profile, or already received.
  public func markReceived(
    poStore : POStore,
    poItemStore : POItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    po_id : Common.PurchaseOrderId,
    nextBatchId : Nat,
  ) : (Bool, Nat) {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null return (false, nextBatchId);
    };
    switch (poStore.get(po_id)) {
      case null (false, nextBatchId);
      case (?po) {
        if (po.profile_key != up.profile_key) return (false, nextBatchId);
        // Idempotency guard — prevent double-receive from incrementing stock twice
        switch (po.status) {
          case (#Received) {
            // Already received — return false without any mutations
            return (false, nextBatchId);
          };
          case (#Pending) {};
        };

        let now = Time.now();

        // Update PO status to #Received with who-columns
        poStore.add(po_id, {
          po with
          status = #Received;
          last_updated_by = caller;
          last_update_date = now;
        });

        // Fetch PO items
        let items = switch (poItemStore.get(po_id)) {
          case (?arr) arr;
          case null [];
        };

        var batchIdCounter = nextBatchId;
        for (item in items.values()) {
          // Capture ID before creation — prevents using a stale counter
          let thisBatchId = batchIdCounter;
          batchIdCounter += 1;
          let _ = InventoryLib.addBatch(
            batchStore, caller,
            po.profile_key, po.warehouse_name,
            thisBatchId, item.product_id,
            item.quantity, item.unit_cost, now,
          );
        };
        (true, batchIdCounter)
      };
    }
  };
};
