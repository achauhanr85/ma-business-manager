import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Common "../types/common";
import InventoryTypes "../types/inventory";

module {
  public type BatchStore = Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>;

  // Returns all inventory levels (aggregated by product) for caller
  public func getInventoryLevels(store : BatchStore, caller : Common.UserId) : [InventoryTypes.InventoryLevel] {
    // Group batches by product_id
    let productMap = Map.empty<Common.ProductId, List.List<InventoryTypes.InventoryBatchPublic>>();
    for ((_, batch) in store.entries()) {
      if (Principal.equal(batch.owner, caller) and batch.quantity_remaining > 0) {
        let pub : InventoryTypes.InventoryBatchPublic = {
          id = batch.id;
          product_id = batch.product_id;
          quantity_remaining = batch.quantity_remaining;
          unit_cost = batch.unit_cost;
          date_received = batch.date_received;
        };
        switch (productMap.get(batch.product_id)) {
          case (?lst) { lst.add(pub) };
          case null {
            let lst = List.empty<InventoryTypes.InventoryBatchPublic>();
            lst.add(pub);
            productMap.add(batch.product_id, lst);
          };
        };
      };
    };
    let result = List.empty<InventoryTypes.InventoryLevel>();
    for ((pid, batches) in productMap.entries()) {
      let total = batches.foldLeft(0 : Nat, func(acc : Nat, b : InventoryTypes.InventoryBatchPublic) : Nat { acc + b.quantity_remaining });
      result.add({
        product_id = pid;
        total_qty = total;
        batches = batches.sort(func(a, b) { Int.compare(a.date_received, b.date_received) }).toArray();
      });
    };
    result.toArray();
  };

  // Returns all batches for a given product for caller, sorted oldest first (FIFO)
  public func getInventoryBatches(store : BatchStore, caller : Common.UserId, product_id : Common.ProductId) : [InventoryTypes.InventoryBatchPublic] {
    let result = List.empty<InventoryTypes.InventoryBatchPublic>();
    for ((_, batch) in store.entries()) {
      if (Principal.equal(batch.owner, caller) and batch.product_id == product_id and batch.quantity_remaining > 0) {
        result.add({
          id = batch.id;
          product_id = batch.product_id;
          quantity_remaining = batch.quantity_remaining;
          unit_cost = batch.unit_cost;
          date_received = batch.date_received;
        });
      };
    };
    result.sort(func(a, b) { Int.compare(a.date_received, b.date_received) }).toArray();
  };

  /// FIFO deduction: deducts `quantity` from the oldest batches first.
  /// Returns the weighted average unit_cost consumed, or null if insufficient stock.
  public func deductFIFO(store : BatchStore, caller : Common.UserId, product_id : Common.ProductId, quantity : Nat) : ?Float {
    // Gather caller's batches for this product, sorted oldest-first
    let batches = List.empty<InventoryTypes.InventoryBatch>();
    for ((_, batch) in store.entries()) {
      if (Principal.equal(batch.owner, caller) and batch.product_id == product_id and batch.quantity_remaining > 0) {
        batches.add(batch);
      };
    };
    // Sort by date_received ascending (oldest first)
    batches.sortInPlace(func(a, b) { Int.compare(a.date_received, b.date_received) });

    // Check total stock
    let totalStock = batches.foldLeft(0, func(acc : Nat, b : InventoryTypes.InventoryBatch) : Nat { acc + b.quantity_remaining });
    if (totalStock < quantity) return null;

    // Deduct FIFO and track weighted cost
    var remaining = quantity;
    var totalCost : Float = 0.0;

    batches.forEach(func(batch) {
      if (remaining > 0) {
        let deduct = if (batch.quantity_remaining <= remaining) {
          batch.quantity_remaining
        } else {
          remaining
        };
        totalCost := totalCost + (batch.unit_cost * deduct.toFloat());
        remaining := remaining - deduct;
        if (batch.quantity_remaining <= deduct) {
          // Batch fully consumed — remove it
          store.remove(batch.id);
        } else {
          // Partially consume batch
          batch.quantity_remaining := batch.quantity_remaining - deduct;
        };
      };
    });

    let avgCost = totalCost / quantity.toFloat();
    ?avgCost;
  };

  public func addBatch(store : BatchStore, caller : Common.UserId, nextId : Nat, product_id : Common.ProductId, quantity : Nat, unit_cost : Float, date_received : Int) : Common.BatchId {
    let id = nextId;
    let batch : InventoryTypes.InventoryBatch = {
      id;
      product_id;
      var quantity_remaining = quantity;
      unit_cost;
      date_received;
      owner = caller;
    };
    store.add(id, batch);
    id;
  };
};
