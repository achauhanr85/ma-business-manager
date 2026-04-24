import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";
import Common "../types/common";
import InventoryTypes "../types/inventory";
import UserTypes "../types/users";

module {
  public type BatchStore = Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>;
  public type MovementStore = Map.Map<Common.MovementId, InventoryTypes.InventoryMovement>;

  func callerProfileKey(userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : (Common.ProfileKey, Common.WarehouseName, Common.UserRole) {
    switch (userStore.get(caller)) {
      case (?up) (up.profile_key, up.warehouse_name, up.role);
      case null Runtime.trap("Caller has no profile");
    }
  };

  func toPublic(b : InventoryTypes.InventoryBatch) : InventoryTypes.InventoryBatchPublic {
    {
      id = b.id;
      product_id = b.product_id;
      quantity_remaining = b.quantity_remaining;
      unit_cost = b.unit_cost;
      date_received = b.date_received;
      profile_key = b.profile_key;
      warehouse_name = b.warehouse_name;
    }
  };

  /// Returns all inventory levels (aggregated by product).
  /// #admin and #superAdmin see ALL warehouses in their profile.
  /// #staff sees only their assigned warehouse.
  public func getInventoryLevels(store : BatchStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : [InventoryTypes.InventoryLevel] {
    let (profileKey, warehouseName, role) = callerProfileKey(userStore, caller);
    let isAdminLevel = role == #admin or role == #superAdmin;
    // Build a map of product_id -> [batches]
    let levelMap = Map.empty<Common.ProductId, [InventoryTypes.InventoryBatchPublic]>();
    for ((_id, batch) in store.entries()) {
      let warehouseMatch = isAdminLevel or batch.warehouse_name == warehouseName;
      if (batch.profile_key == profileKey and warehouseMatch and batch.quantity_remaining > 0) {
        let existing = switch (levelMap.get(batch.product_id)) {
          case (?arr) arr;
          case null [];
        };
        levelMap.add(batch.product_id, existing.concat([toPublic(batch)]));
      };
    };
    levelMap.entries()
      .map(func((_pid, batches) : (Common.ProductId, [InventoryTypes.InventoryBatchPublic])) : InventoryTypes.InventoryLevel {
          let total = batches.foldLeft(0, func(acc : Nat, b : InventoryTypes.InventoryBatchPublic) : Nat { acc + b.quantity_remaining });
          {
            product_id = _pid;
            total_qty = total;
            batches;
          }
        }
      )
      .toArray()
  };

  /// Returns all batches for a given product.
  /// #admin and #superAdmin see all warehouses; #staff sees only their assigned warehouse.
  public func getInventoryBatches(store : BatchStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, product_id : Common.ProductId) : [InventoryTypes.InventoryBatchPublic] {
    let (profileKey, warehouseName, role) = callerProfileKey(userStore, caller);
    let isAdminLevel = role == #admin or role == #superAdmin;
    store.entries()
      .filter(func((_id, b)) {
        let warehouseMatch = isAdminLevel or b.warehouse_name == warehouseName;
        b.profile_key == profileKey and warehouseMatch and b.product_id == product_id
      })
      .map(func((_id, b) : (Common.BatchId, InventoryTypes.InventoryBatch)) : InventoryTypes.InventoryBatchPublic { toPublic(b) })
      .toArray()
  };

  /// FIFO deduction scoped to caller's warehouse. Returns total unit_cost weighted average or null if insufficient stock.
  public func deductFIFO(store : BatchStore, _caller : Common.UserId, profile_key : Common.ProfileKey, warehouse_name : Common.WarehouseName, product_id : Common.ProductId, quantity : Nat) : ?Float {
    // Collect matching batches sorted by date_received ascending
    let batches = store.entries()
      .filter(func((_id, b)) {
        b.profile_key == profile_key and b.warehouse_name == warehouse_name
          and b.product_id == product_id and b.quantity_remaining > 0
      })
      .map(func((_id, b) : (Common.BatchId, InventoryTypes.InventoryBatch)) : InventoryTypes.InventoryBatch { b })
      .toArray();

    // Sort by date_received ascending (oldest first) — use simple sort
    let sorted = batches.sort(func(a, b) { Int.compare(a.date_received, b.date_received) });

    // Check total available
    let totalAvail = sorted.foldLeft(0, func(acc : Nat, b : InventoryTypes.InventoryBatch) : Nat { acc + b.quantity_remaining });
    if (totalAvail < quantity) return null;

    // Deduct FIFO and compute weighted average unit cost
    var remaining = quantity;
    var totalCost : Float = 0.0;
    for (batch in sorted.values()) {
      if (remaining == 0) {};
      if (remaining > 0) {
        let deduct = if (batch.quantity_remaining <= remaining) batch.quantity_remaining else remaining;
        totalCost += deduct.toFloat() * batch.unit_cost;
        remaining -= deduct;
        batch.quantity_remaining -= deduct;
      };
    };
    ?(totalCost / quantity.toFloat())
  };

  public func addBatch(store : BatchStore, caller : Common.UserId, profile_key : Common.ProfileKey, warehouse_name : Common.WarehouseName, nextId : Nat, product_id : Common.ProductId, quantity : Nat, unit_cost : Float, date_received : Common.Timestamp) : Common.BatchId {
    let batch : InventoryTypes.InventoryBatch = {
      id = nextId;
      product_id;
      var quantity_remaining = quantity;
      unit_cost;
      date_received;
      profile_key;
      warehouse_name;
      owner = caller;
      // Who-columns: created_by = caller (person receiving the PO), creation_date = date_received
      created_by = caller;
      last_updated_by = caller;
      creation_date = date_received;
      last_update_date = date_received;
    };
    store.add(nextId, batch);
    nextId
  };

  /// Move stock from one warehouse to another within the same profile.
  /// #admin may move between ANY two warehouses.
  /// #staff may only move FROM Main TO their own warehouse.
  public func moveInventory(
    store : BatchStore,
    movementStore : MovementStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextMovementId : Nat,
    nextBatchId : Nat,
    input : InventoryTypes.InventoryMovementInput,
  ) : ?Common.MovementId {
    let (profileKey, warehouseName, role) = callerProfileKey(userStore, caller);
    // Access control:
    // - #admin / #superAdmin: any warehouse-to-warehouse move within the profile
    // - #staff: can only move from "Main" to their own assigned warehouse
    if (role == #staff) {
      if (input.from_warehouse != "Main" or input.to_warehouse != warehouseName) {
        return null; // staff can only move Main → own warehouse
      };
    };
    // Deduct from source warehouse via FIFO
    switch (deductFIFO(store, caller, profileKey, input.from_warehouse, input.product_id, input.quantity)) {
      case null null; // insufficient stock
      case (?avgCost) {
        // Add new batch in destination warehouse
        let mvNow = Time.now();
        let _ = addBatch(store, caller, profileKey, input.to_warehouse, nextBatchId, input.product_id, input.quantity, avgCost, mvNow);
        let movement : InventoryTypes.InventoryMovement = {
          id = nextMovementId;
          profile_key = profileKey;
          product_id = input.product_id;
          from_warehouse = input.from_warehouse;
          to_warehouse = input.to_warehouse;
          quantity = input.quantity;
          moved_at = mvNow;
          moved_by = caller;
          // Who-columns
          created_by = caller;
          last_updated_by = caller;
          creation_date = mvNow;
          last_update_date = mvNow;
        };
        movementStore.add(nextMovementId, movement);
        ?nextMovementId
      };
    }
  };

  /// Returns all inventory movements for the caller's profile
  public func getInventoryMovements(movementStore : MovementStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : [InventoryTypes.InventoryMovement] {
    let (profileKey, _, _) = callerProfileKey(userStore, caller);
    movementStore.entries()
      .filter(func((_id, m)) { m.profile_key == profileKey })
      .map(func((_id, m) : (Common.MovementId, InventoryTypes.InventoryMovement)) : InventoryTypes.InventoryMovement { m })
      .toArray()
  };
};
