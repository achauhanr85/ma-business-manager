import Runtime "mo:core/Runtime";
import Common "../types/common";
import InventoryTypes "../types/inventory";
import InventoryLib "../lib/inventory";
import ProfileLib "../lib/profile";

mixin (
  batchStore : InventoryLib.BatchStore,
  movementStore : InventoryLib.MovementStore,
  userStore : ProfileLib.UserStore,
) {
  var nextMovementId : Nat = 1;
  var nextBatchId : Nat = 1;

  /// #admin sees all warehouses; #staff sees only their assigned warehouse.
  /// Loaned batches are included with is_loaned=true but excluded from COGS totals.
  public shared query ({ caller }) func getInventoryLevels() : async [InventoryTypes.InventoryLevel] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getInventoryLevels(batchStore, userStore, caller)
  };

  /// #admin sees all warehouses; #staff sees only their assigned warehouse.
  public shared query ({ caller }) func getInventoryBatches(product_id : Common.ProductId) : async [InventoryTypes.InventoryBatchPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getInventoryBatches(batchStore, userStore, caller, product_id)
  };

  /// Move stock between warehouses.
  /// #admin: any source/destination within the profile.
  /// #staff: can only move from "Main" to their own assigned warehouse.
  public shared ({ caller }) func moveInventory(input : InventoryTypes.InventoryMovementInput) : async ?Common.MovementId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = InventoryLib.moveInventory(batchStore, movementStore, userStore, caller, nextMovementId, nextBatchId, input);
    switch (result) {
      case (?_) {
        nextMovementId += 1;
        nextBatchId += 1;
      };
      case null {};
    };
    result
  };

  public shared query ({ caller }) func getInventoryMovements() : async [InventoryTypes.InventoryMovement] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getInventoryMovements(movementStore, userStore, caller)
  };

  /// Receive items into Friend/Loaner Inventory virtual warehouse.
  /// Sets is_loaned=true; excluded from COGS.
  /// Only #admin or #staff may call this.
  public shared ({ caller }) func addLoanerBatch(
    product_id : Common.ProductId,
    quantity : Nat,
    unit_cost : Float,
    loaned_source : Text,
  ) : async ?Common.BatchId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = InventoryLib.addLoanerBatch(batchStore, userStore, caller, nextBatchId, product_id, quantity, unit_cost, loaned_source);
    switch (result) {
      case (?_) nextBatchId += 1;
      case null {};
    };
    result
  };

  /// Move loaned items from Friend/Loaner Inventory to a staff warehouse.
  /// Loaned tag (is_loaned=true) persists through the move.
  /// Only #admin or #staff may call this.
  public shared ({ caller }) func moveLoanerToStaff(
    product_id : Common.ProductId,
    quantity : Nat,
    to_warehouse : Common.WarehouseName,
  ) : async ?Common.MovementId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = InventoryLib.moveLoanerToStaff(batchStore, movementStore, userStore, caller, nextMovementId, nextBatchId, product_id, quantity, to_warehouse);
    switch (result) {
      case (?(movId, _batchId)) {
        nextMovementId += 1;
        nextBatchId += 1;
        ?movId
      };
      case null null;
    }
  };

  /// Return a loaned batch back to source (friend/owner).
  /// Decrements staff inventory and sets loaned_status=#archived.
  /// Only #admin may call this.
  public shared ({ caller }) func returnToSource(
    batch_id : Common.BatchId,
    quantity : Nat,
  ) : async ?Common.MovementId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = InventoryLib.returnToSource(batchStore, movementStore, userStore, caller, nextMovementId, batch_id, quantity);
    switch (result) {
      case (?_) nextMovementId += 1;
      case null {};
    };
    result
  };

  /// Archive a loaned batch — Admin confirms item returned to friend.
  /// Sets loaned_status=#archived and quantity_remaining=0.
  /// Only #admin may call this.
  public shared ({ caller }) func archiveLoanedBatch(batch_id : Common.BatchId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.archiveLoanedBatch(batchStore, userStore, caller, batch_id)
  };

  // ── Stage Inventory ───────────────────────────────────────────────────────────

  /// Admin reviews a staged (returned) item.
  /// #accept → moved to "Main" warehouse.
  /// #reject → marked rejected, quantity zeroed.
  /// Only #admin or #superAdmin may call this.
  public shared ({ caller }) func reviewStagedItem(
    batch_id : Common.BatchId,
    action : { #accept; #reject },
  ) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    let result = InventoryLib.reviewStagedItem(batchStore, movementStore, userStore, caller, nextMovementId, batch_id, action, up.display_name);
    if (result) nextMovementId += 1;
    result
  };

  /// Returns all Stage Inventory batches for the caller's profile.
  /// Accessible to both Admin and Staff.
  public shared query ({ caller }) func getStagedInventory() : async [InventoryTypes.InventoryBatchPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getStagedInventory(batchStore, userStore, caller)
  };
};
