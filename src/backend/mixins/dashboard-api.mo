import Runtime "mo:core/Runtime";
import Common "../types/common";
import DashboardTypes "../types/dashboard";
import SalesLib "../lib/sales";
import InventoryLib "../lib/inventory";
import DashboardLib "../lib/dashboard";
import ProfileLib "../lib/profile";

mixin (
  saleStore : SalesLib.SaleStore,
  batchStore : InventoryLib.BatchStore,
  profileStore : ProfileLib.Store,
  userStore : ProfileLib.UserStore,
) {
  public shared query ({ caller }) func getDashboardStats() : async DashboardTypes.DashboardStats {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getDashboardStats(saleStore, batchStore, userStore, caller)
  };

  public shared query ({ caller }) func getMonthlySalesTrend() : async [DashboardTypes.MonthlySalesTrend] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getMonthlySalesTrend(saleStore, userStore, caller)
  };

  /// Super Admin only
  public shared query ({ caller }) func getSuperAdminStats() : async DashboardTypes.SuperAdminStats {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getSuperAdminStats(profileStore, userStore, saleStore, caller)
  };
};
