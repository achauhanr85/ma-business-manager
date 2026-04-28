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

  /// Name of the virtual warehouse for Friend/Loaner Inventory.
  /// Items in this warehouse are excluded from COGS and main inventory valuation.
  public let LOANER_WAREHOUSE_NAME : Text = "Friend/Loaner Inventory";

  /// Name of the virtual warehouse for Stage Inventory.
  /// Returned items land here and await Admin review before going back to main stock.
  public let STAGE_WAREHOUSE_NAME : Text = "Stage Inventory";

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
      is_loaned = b.is_loaned;
      loaned_source = b.loaned_source;
      loaned_status = b.loaned_status;
      staged_status = b.staged_status;
      return_order_id = b.return_order_id;
    }
  };

  /// Returns all inventory levels (aggregated by product).
  /// #admin and #superAdmin see ALL warehouses in their profile.
  /// #staff sees only their assigned warehouse.
  /// Loaned batches are included with is_loaned=true but excluded from COGS totals.
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
          // Only non-loaned batches count toward COGS total
          let total = batches.foldLeft(0, func(acc : Nat, b : InventoryTypes.InventoryBatchPublic) : Nat {
            if (b.is_loaned) acc else acc + b.quantity_remaining
          });
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
      is_loaned = false;
      loaned_source = null;
      loaned_status = null;
      staged_status = null;
      return_order_id = null;
      // Who-columns: created_by = caller (person receiving the PO), creation_date = date_received
      created_by = caller;
      last_updated_by = caller;
      creation_date = date_received;
      last_update_date = date_received;
    };
    store.add(nextId, batch);
    nextId
  };

  /// Receive items into the Friend/Loaner Inventory virtual warehouse.
  /// Sets is_loaned=true and loaned_status=#active.
  /// These batches are excluded from COGS and main inventory valuation.
  /// Only #admin or #staff may call this.
  public func addLoanerBatch(
    store : BatchStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextId : Nat,
    product_id : Common.ProductId,
    quantity : Nat,
    unit_cost : Float,
    loaned_source : Text,
  ) : ?Common.BatchId {
    let (profileKey, _warehouseName, role) = callerProfileKey(userStore, caller);
    if (role != #admin and role != #staff and role != #superAdmin) return null;
    let now = Time.now();
    let batch : InventoryTypes.InventoryBatch = {
      id = nextId;
      product_id;
      var quantity_remaining = quantity;
      unit_cost;
      date_received = now;
      profile_key = profileKey;
      warehouse_name = LOANER_WAREHOUSE_NAME;
      owner = caller;
      is_loaned = true;
      loaned_source = ?loaned_source;
      loaned_status = ?#active;
      staged_status = null;
      return_order_id = null;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, batch);
    ?nextId
  };

  /// Move items from Friend/Loaner Inventory to a staff warehouse.
  /// The loaned tag (is_loaned=true) persists through the move.
  /// Only #admin or #staff may call this.
  public func moveLoanerToStaff(
    store : BatchStore,
    movementStore : MovementStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextMovementId : Nat,
    nextBatchId : Nat,
    product_id : Common.ProductId,
    quantity : Nat,
    to_warehouse : Common.WarehouseName,
  ) : ?(Common.MovementId, Common.BatchId) {
    let (profileKey, _warehouseName, role) = callerProfileKey(userStore, caller);
    if (role != #admin and role != #staff and role != #superAdmin) return null;

    // Find matching loaned batches in the loaner warehouse (oldest first)
    let loanedBatches = store.entries()
      .filter(func((_id, b)) {
        b.profile_key == profileKey
          and b.warehouse_name == LOANER_WAREHOUSE_NAME
          and b.product_id == product_id
          and b.is_loaned
          and b.quantity_remaining > 0
      })
      .map(func((_id, b) : (Common.BatchId, InventoryTypes.InventoryBatch)) : InventoryTypes.InventoryBatch { b })
      .toArray();
    let sorted = loanedBatches.sort(func(a, b) { Int.compare(a.date_received, b.date_received) });

    let totalAvail = sorted.foldLeft(0, func(acc : Nat, b : InventoryTypes.InventoryBatch) : Nat { acc + b.quantity_remaining });
    if (totalAvail < quantity) return null;

    // Deduct from loaner batches FIFO and compute weighted avg cost
    var remaining = quantity;
    var totalCost : Float = 0.0;
    var loanedSource : ?Text = null;
    for (batch in sorted.values()) {
      if (remaining > 0) {
        let deduct = if (batch.quantity_remaining <= remaining) batch.quantity_remaining else remaining;
        totalCost += deduct.toFloat() * batch.unit_cost;
        remaining -= deduct;
        batch.quantity_remaining -= deduct;
        if (loanedSource == null) loanedSource := batch.loaned_source;
      };
    };
    let avgCost = totalCost / quantity.toFloat();

    // Create new batch in target warehouse preserving is_loaned=true
    let now = Time.now();
    let newBatch : InventoryTypes.InventoryBatch = {
      id = nextBatchId;
      product_id;
      var quantity_remaining = quantity;
      unit_cost = avgCost;
      date_received = now;
      profile_key = profileKey;
      warehouse_name = to_warehouse;
      owner = caller;
      is_loaned = true;
      loaned_source = loanedSource;
      loaned_status = ?#active;
      staged_status = null;
      return_order_id = null;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextBatchId, newBatch);

    // Record movement with is_loaned_move=true
    let movement : InventoryTypes.InventoryMovement = {
      id = nextMovementId;
      profile_key = profileKey;
      product_id;
      from_warehouse = LOANER_WAREHOUSE_NAME;
      to_warehouse;
      quantity;
      moved_at = now;
      moved_by = caller;
      is_loaned_move = true;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    movementStore.add(nextMovementId, movement);
    ?(nextMovementId, nextBatchId)
  };

  /// Return a loaned item batch back to the source (friend/owner).
  /// Decrements the staff inventory batch and sets loaned_status=#archived.
  /// Only #admin may call this.
  public func returnToSource(
    store : BatchStore,
    movementStore : MovementStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextMovementId : Nat,
    batch_id : Common.BatchId,
    quantity : Nat,
  ) : ?Common.MovementId {
    let (profileKey, _warehouseName, role) = callerProfileKey(userStore, caller);
    if (role != #admin and role != #superAdmin) return null;

    switch (store.get(batch_id)) {
      case null null;
      case (?batch) {
        if (batch.profile_key != profileKey) return null;
        if (not batch.is_loaned) return null;
        if (batch.quantity_remaining < quantity) return null;

        let now = Time.now();
        let newQty : Nat = if (batch.quantity_remaining >= quantity) batch.quantity_remaining - quantity else 0;
        let newStatus : ?InventoryTypes.LoanedItemStatus = if (newQty == 0) ?#archived else ?#active;
        let updated : InventoryTypes.InventoryBatch = {
          id = batch.id;
          product_id = batch.product_id;
          var quantity_remaining = newQty;
          unit_cost = batch.unit_cost;
          date_received = batch.date_received;
          profile_key = batch.profile_key;
          warehouse_name = batch.warehouse_name;
          owner = batch.owner;
          is_loaned = batch.is_loaned;
          loaned_source = batch.loaned_source;
          loaned_status = newStatus;
          staged_status = batch.staged_status;
          return_order_id = batch.return_order_id;
          created_by = batch.created_by;
          last_updated_by = caller;
          creation_date = batch.creation_date;
          last_update_date = now;
        };
        store.add(batch_id, updated);

        // Record the return movement
        let movement : InventoryTypes.InventoryMovement = {
          id = nextMovementId;
          profile_key = profileKey;
          product_id = batch.product_id;
          from_warehouse = batch.warehouse_name;
          to_warehouse = LOANER_WAREHOUSE_NAME # " (Returned)";
          quantity;
          moved_at = now;
          moved_by = caller;
          is_loaned_move = true;
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
        };
        movementStore.add(nextMovementId, movement);
        ?nextMovementId
      };
    }
  };

  /// Archive a loaned batch — Admin can mark it as returned to the friend.
  /// Sets loaned_status=#archived and quantity_remaining=0.
  /// Only #admin may call this.
  public func archiveLoanedBatch(
    store : BatchStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    batch_id : Common.BatchId,
  ) : Bool {
    let (profileKey, _warehouseName, role) = callerProfileKey(userStore, caller);
    if (role != #admin and role != #superAdmin) return false;
    switch (store.get(batch_id)) {
      case null false;
      case (?batch) {
        if (batch.profile_key != profileKey) return false;
        if (not batch.is_loaned) return false;
        let now = Time.now();
        let archived : InventoryTypes.InventoryBatch = {
          id = batch.id;
          product_id = batch.product_id;
          var quantity_remaining = 0;
          unit_cost = batch.unit_cost;
          date_received = batch.date_received;
          profile_key = batch.profile_key;
          warehouse_name = batch.warehouse_name;
          owner = batch.owner;
          is_loaned = batch.is_loaned;
          loaned_source = batch.loaned_source;
          loaned_status = ?#archived;
          staged_status = batch.staged_status;
          return_order_id = batch.return_order_id;
          created_by = batch.created_by;
          last_updated_by = caller;
          creation_date = batch.creation_date;
          last_update_date = now;
        };
        store.add(batch_id, archived);
        true
      };
    }
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
        let isLoanedMove = switch (input.is_loaned_move) { case (?v) v; case null false };
        let movement : InventoryTypes.InventoryMovement = {
          id = nextMovementId;
          profile_key = profileKey;
          product_id = input.product_id;
          from_warehouse = input.from_warehouse;
          to_warehouse = input.to_warehouse;
          quantity = input.quantity;
          moved_at = mvNow;
          moved_by = caller;
          is_loaned_move = isLoanedMove;
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

  /// Move usable returned items into Stage Inventory virtual warehouse.
  /// Called from createReturnOrder for each is_usable=true return item.
  /// Accessible to both Admin and Staff (no role restriction).
  public func moveToStageInventory(
    store : BatchStore,
    caller : Common.UserId,
    profileKey : Common.ProfileKey,
    productId : Common.ProductId,
    qty : Nat,
    unitCost : Float,
    nextBatchId : Nat,
    returnOrderId : Common.SaleId,
  ) : Common.BatchId {
    let now = Time.now();
    let batch : InventoryTypes.InventoryBatch = {
      id = nextBatchId;
      product_id = productId;
      var quantity_remaining = qty;
      unit_cost = unitCost;
      date_received = now;
      profile_key = profileKey;
      warehouse_name = STAGE_WAREHOUSE_NAME;
      owner = caller;
      is_loaned = false;
      loaned_source = null;
      loaned_status = null;
      staged_status = ?#pending;
      return_order_id = ?returnOrderId;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextBatchId, batch);
    nextBatchId
  };

  /// Admin reviews a staged item batch.
  /// #accept → moves batch from Stage Inventory to the main warehouse (warehouse_name = "Main").
  /// #reject → marks batch as rejected and sets quantity_remaining = 0.
  /// Only #admin or #superAdmin may call this.
  public func reviewStagedItem(
    store : BatchStore,
    movementStore : MovementStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextMovementId : Nat,
    batchId : Common.BatchId,
    action : { #accept; #reject },
    _reviewedBy : Text,
  ) : Bool {
    let (profileKey, _wh, role) = callerProfileKey(userStore, caller);
    if (role != #admin and role != #superAdmin) return false;
    switch (store.get(batchId)) {
      case null false;
      case (?batch) {
        if (batch.profile_key != profileKey) return false;
        if (batch.warehouse_name != STAGE_WAREHOUSE_NAME) return false;
        let now = Time.now();
        switch (action) {
          case (#accept) {
            // Move to "Main" warehouse
            let accepted : InventoryTypes.InventoryBatch = {
              id = batch.id;
              product_id = batch.product_id;
              var quantity_remaining = batch.quantity_remaining;
              unit_cost = batch.unit_cost;
              date_received = batch.date_received;
              profile_key = batch.profile_key;
              warehouse_name = "Main";
              owner = batch.owner;
              is_loaned = false;
              loaned_source = null;
              loaned_status = null;
              staged_status = ?#accepted;
              return_order_id = batch.return_order_id;
              created_by = batch.created_by;
              last_updated_by = caller;
              creation_date = batch.creation_date;
              last_update_date = now;
            };
            store.add(batchId, accepted);
            // Record movement from Stage → Main
            let movement : InventoryTypes.InventoryMovement = {
              id = nextMovementId;
              profile_key = profileKey;
              product_id = batch.product_id;
              from_warehouse = STAGE_WAREHOUSE_NAME;
              to_warehouse = "Main";
              quantity = batch.quantity_remaining;
              moved_at = now;
              moved_by = caller;
              is_loaned_move = false;
              created_by = caller;
              last_updated_by = caller;
              creation_date = now;
              last_update_date = now;
            };
            movementStore.add(nextMovementId, movement);
            true
          };
          case (#reject) {
            let rejected : InventoryTypes.InventoryBatch = {
              id = batch.id;
              product_id = batch.product_id;
              var quantity_remaining = 0;
              unit_cost = batch.unit_cost;
              date_received = batch.date_received;
              profile_key = batch.profile_key;
              warehouse_name = STAGE_WAREHOUSE_NAME;
              owner = batch.owner;
              is_loaned = false;
              loaned_source = null;
              loaned_status = null;
              staged_status = ?#rejected;
              return_order_id = batch.return_order_id;
              created_by = batch.created_by;
              last_updated_by = caller;
              creation_date = batch.creation_date;
              last_update_date = now;
            };
            store.add(batchId, rejected);
            true
          };
        }
      };
    }
  };

  /// Returns all Stage Inventory batches for the caller's profile.
  /// Accessible to both Admin and Staff.
  public func getStagedInventory(
    store : BatchStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : [InventoryTypes.InventoryBatchPublic] {
    let (profileKey, _, _) = callerProfileKey(userStore, caller);
    store.entries()
      .filter(func((_id, b)) {
        b.profile_key == profileKey and b.warehouse_name == STAGE_WAREHOUSE_NAME
      })
      .map(func((_id, b) : (Common.BatchId, InventoryTypes.InventoryBatch)) : InventoryTypes.InventoryBatchPublic { toPublic(b) })
      .toArray()
  };
};
