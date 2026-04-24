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

  public shared query ({ caller }) func getInventoryLevels() : async [InventoryTypes.InventoryLevel] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getInventoryLevels(batchStore, userStore, caller)
  };

  public shared query ({ caller }) func getInventoryBatches(product_id : Common.ProductId) : async [InventoryTypes.InventoryBatchPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getInventoryBatches(batchStore, userStore, caller, product_id)
  };

  /// Sub-Admin: move stock from one warehouse to another
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
};
