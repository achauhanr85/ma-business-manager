import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Cycles "mo:core/Cycles";
import Common "../types/common";
import DashboardTypes "../types/dashboard";
import ProfileTypes "../types/profile";
import SalesTypes "../types/sales";
import SalesLib "../lib/sales";
import InventoryLib "../lib/inventory";
import DashboardLib "../lib/dashboard";
import ProfileLib "../lib/profile";
import CustomersLib "../lib/customers";

mixin (
  saleStore : SalesLib.SaleStore,
  batchStore : InventoryLib.BatchStore,
  customerStore : CustomersLib.CustomerStore,
  profileStore : ProfileLib.Store,
  userStore : ProfileLib.UserStore,
) {
  public shared query ({ caller }) func getDashboardStats() : async DashboardTypes.DashboardStats {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getDashboardStats(saleStore, batchStore, customerStore, userStore, caller)
  };

  public shared query ({ caller }) func getMonthlySalesTrend() : async [DashboardTypes.MonthlySalesTrend] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getMonthlySalesTrend(saleStore, userStore, caller)
  };

  /// Super Admin only — aggregate stats + governance details across all profiles
  public shared query ({ caller }) func getSuperAdminStats() : async DashboardTypes.SuperAdminStats {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DashboardLib.getSuperAdminStats(profileStore, userStore, saleStore, caller)
  };

  /// Returns canister cycles balance plus a per-profile info note.
  /// Super Admin only.
  public shared ({ caller }) func getCanisterCyclesInfo() : async {
    total_cycles : Nat;
    per_profile_info : [{ profile_key : Text; business_name : Text; cycles_note : Text }];
  } {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    let totalCycles = Cycles.balance();
    let perProfileInfo = profileStore.entries()
      .map(func((_k, p) : (Common.ProfileKey, ProfileTypes.Profile)) : { profile_key : Text; business_name : Text; cycles_note : Text } {
        {
          profile_key = p.profile_key;
          business_name = p.business_name;
          cycles_note = "Shared canister - see total";
        }
      })
      .toArray();
    { total_cycles = totalCycles; per_profile_info = perProfileInfo }
  };

  /// Update the payment status of a sale — callable from the Sales list page.
  /// Only Admin, SuperAdmin, or the sale's original seller may update payment status.
  /// Payment status cannot be changed once set to #Paid.
  public shared ({ caller }) func updatePaymentStatus(
    saleId : Common.SaleId,
    paymentStatus : Common.PaymentStatus,
    amountPaid : ?Float,
    paymentDueDate : ?Text,
  ) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    let sale = switch (saleStore.get(saleId)) {
      case (?s) s;
      case null return false;
    };
    // Must belong to caller's profile
    if (sale.profile_key != up.profile_key) return false;
    // Lock if already paid
    switch (sale.payment_status) {
      case (?(#Paid)) return false; // Cannot change a paid order
      case _ {};
    };
    // Only Admin, SuperAdmin, or the original seller may change payment status
    let canUpdate = up.role == #admin or up.role == #superAdmin or sale.sold_by == caller;
    if (not canUpdate) return false;

    let paid = switch (amountPaid) { case (?a) a; case null 0.0 };
    let balanceDue = sale.total_revenue - paid;
    let now = Time.now();
    saleStore.add(saleId, {
      sale with
      payment_status = ?paymentStatus;
      amount_paid = amountPaid;
      balance_due = ?balanceDue;
      payment_due_date = paymentDueDate;
      last_updated_by = caller;
      last_update_date = now;
    });
    true
  };
};
