import Runtime "mo:core/Runtime";
import Common "../types/common";
import DashboardTypes "../types/dashboard";
import SalesLib "../lib/sales";
import InventoryLib "../lib/inventory";
import DashboardLib "../lib/dashboard";

mixin (
  saleStore : SalesLib.SaleStore,
  batchStore : InventoryLib.BatchStore,
) {
  public shared query ({ caller }) func getDashboardStats() : async DashboardTypes.DashboardStats {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getDashboardStats(saleStore, batchStore, caller);
  };

  public shared query ({ caller }) func getMonthlySalesTrend() : async [DashboardTypes.MonthlySalesTrend] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getMonthlySalesTrend(saleStore, caller);
  };
};
