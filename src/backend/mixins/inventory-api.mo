import Runtime "mo:core/Runtime";
import Common "../types/common";
import InventoryTypes "../types/inventory";
import InventoryLib "../lib/inventory";

mixin (batchStore : InventoryLib.BatchStore) {
  public shared query ({ caller }) func getInventoryLevels() : async [InventoryTypes.InventoryLevel] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getInventoryLevels(batchStore, caller);
  };

  public shared query ({ caller }) func getInventoryBatches(product_id : Common.ProductId) : async [InventoryTypes.InventoryBatchPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    InventoryLib.getInventoryBatches(batchStore, caller, product_id);
  };
};
