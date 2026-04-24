import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Common "../types/common";
import PurchaseTypes "../types/purchases";
import InventoryTypes "../types/inventory";
import InventoryLib "inventory";

module {
  public type POStore = Map.Map<Common.PurchaseOrderId, PurchaseTypes.PurchaseOrder>;
  public type POItemStore = List.List<PurchaseTypes.PurchaseOrderItem>;

  public func createPurchaseOrder(
    poStore : POStore,
    poItemStore : POItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    caller : Common.UserId,
    nextPOId : Nat,
    nextBatchId : Nat,
    input : PurchaseTypes.PurchaseOrderInput,
  ) : Common.PurchaseOrderId {
    let poId = nextPOId;
    let now = Time.now();

    let po : PurchaseTypes.PurchaseOrder = {
      id = poId;
      vendor = input.vendor;
      timestamp = now;
      status = #Pending;
      owner = caller;
    };
    poStore.add(poId, po);

    // Create PO items and inventory batches
    var batchCounter = nextBatchId;
    for (item in input.items.vals()) {
      poItemStore.add({
        po_id = poId;
        product_id = item.product_id;
        quantity = item.quantity;
        unit_cost = item.unit_cost;
      });
      // Create inventory batch
      let _ = InventoryLib.addBatch(batchStore, caller, batchCounter, item.product_id, item.quantity, item.unit_cost, now);
      batchCounter := batchCounter + 1;
    };

    poId;
  };

  public func getPurchaseOrders(store : POStore, caller : Common.UserId) : [PurchaseTypes.PurchaseOrder] {
    let result = List.empty<PurchaseTypes.PurchaseOrder>();
    for ((_, po) in store.entries()) {
      if (Principal.equal(po.owner, caller)) {
        result.add(po);
      };
    };
    result.sort(func(a, b) { Int.compare(b.timestamp, a.timestamp) }).toArray();
  };

  public func getPurchaseOrderItems(poStore : POStore, itemStore : POItemStore, caller : Common.UserId, po_id : Common.PurchaseOrderId) : [PurchaseTypes.PurchaseOrderItem] {
    // Verify caller owns the PO
    switch (poStore.get(po_id)) {
      case (?po) {
        if (not Principal.equal(po.owner, caller)) return [];
        itemStore.filter(func(item) { item.po_id == po_id }).toArray();
      };
      case null [];
    };
  };

  public func markReceived(
    poStore : POStore,
    poItemStore : POItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    caller : Common.UserId,
    po_id : Common.PurchaseOrderId,
    nextBatchId : Nat,
    timestamp : Int,
  ) : Bool {
    switch (poStore.get(po_id)) {
      case (?po) {
        if (not Principal.equal(po.owner, caller)) return false;
        // Toggle to Received
        poStore.add(po_id, { po with status = #Received });
        true;
      };
      case null false;
    };
  };
};
