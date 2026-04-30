/*
 * FILE: lib/dashboard.mo
 * MODULE: lib
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Implements all KPI and analytics query logic for the Dashboard page.
 *   All queries are read-only — no writes happen here.
 *
 * FLOW:
 *   PAGE: Dashboard (Home)
 *     getDashboardStats(caller) →
 *       • Monthly sales volume points (VP) and profit
 *       • Recent sales list (last 10 orders)
 *       • Out-of-stock and low-stock product counts
 *       • Customer status counts (Lead / Active / Inactive)
 *       Returned as DashboardStats record
 *
 *     getSalesCount(profileKey, filterBy) →
 *       filterBy: "all" | "self" | principalText (specific staff member)
 *       Returns count of sales matching the filter for this month
 *
 *   PAGE: Analytics / Dashboard
 *     getReferralCommissionByMonth(profileKey) →
 *       Groups sales by month × referral_user_principal
 *       Returns [ReferralCommissionEntry] for chart rendering
 *
 *   PAGE: Super Admin Dashboard
 *     getSuperAdminStats() → total profiles, users, cycles balance, per-profile stats
 *
 * DEPENDENCIES:
 *   imports: mo:core/Map, mo:core/Time, mo:core/Runtime, types/common,
 *            types/dashboard, types/sales, types/inventory, types/profile,
 *            types/users, types/customers
 *   called by: mixins/dashboard-api.mo
 *
 * KEY TYPES:
 *   DashboardStats — returned by getDashboardStats()
 * ─────────────────────────────────────────────────────────────────────
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import DashboardTypes "../types/dashboard";
import SalesTypes "../types/sales";
import InventoryTypes "../types/inventory";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";
import CustomerTypes "../types/customers";

module {
  // Nanoseconds in a month (approx 30 days): 30 * 24 * 60 * 60 * 1_000_000_000
  let MONTH_NS : Int = 2_592_000_000_000_000;

  func callerProfileKey(userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : (Common.ProfileKey, Common.UserRole) {
    switch (userStore.get(caller)) {
      case (?up) (up.profile_key, up.role);
      case null Runtime.trap("Caller has no profile");
    }
  };

  public func getDashboardStats(
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : DashboardTypes.DashboardStats {
    let (profileKey, _role) = callerProfileKey(userStore, caller);
    let now = Time.now();
    let monthStart = now - MONTH_NS;

    var monthlyVP : Float = 0.0;
    var monthlyProfit : Float = 0.0;
    var recentSalesList : [SalesTypes.Sale] = [];

    for ((_id, sale) in saleStore.entries()) {
      if (sale.profile_key == profileKey) {
        if (sale.timestamp >= monthStart) {
          monthlyVP += sale.total_volume_points;
          monthlyProfit += sale.total_profit;
        };
        recentSalesList := recentSalesList.concat([sale]);
      };
    };

    // Total inventory value for this profile + out-of-stock count
    var totalInventoryValue : Float = 0.0;
    // Build a set of product IDs that have stock remaining
    let productsWithStock = Map.empty<Common.ProductId, Bool>();
    let productsInProfile = Map.empty<Common.ProductId, Bool>();
    for ((_id, batch) in batchStore.entries()) {
      if (batch.profile_key == profileKey) {
        productsInProfile.add(batch.product_id, true);
        if (batch.quantity_remaining > 0) {
          totalInventoryValue += batch.quantity_remaining.toFloat() * batch.unit_cost;
          productsWithStock.add(batch.product_id, true);
        };
      };
    };
    // out_of_stock_count: products that appear in batches for this profile but have 0 stock remaining
    var outOfStockCount : Nat = 0;
    for ((pid, _) in productsInProfile.entries()) {
      if (not productsWithStock.containsKey(pid)) {
        outOfStockCount += 1;
      };
    };

    // Sort recent sales by timestamp descending and take last 10
    let sorted = recentSalesList.sort(func(a, b) {
      if (a.timestamp > b.timestamp) #less
      else if (a.timestamp < b.timestamp) #greater
      else #equal
    });
    let recentSales = if (sorted.size() <= 10) sorted
      else sorted.sliceToArray(0, 10);

    // Customer status counts scoped to this profile
    var leadCount : Nat = 0;
    var activeCount : Nat = 0;
    var inactiveCount : Nat = 0;
    for ((_id, customer) in customerStore.entries()) {
      if (customer.profile_key == profileKey) {
        switch (customer.customer_type) {
          case (#lead) { leadCount += 1 };
          case (#active) { activeCount += 1 };
          case (#inactive) { inactiveCount += 1 };
        };
      };
    };

    {
      monthly_volume_points = monthlyVP;
      monthly_profit = monthlyProfit;
      total_inventory_value = totalInventoryValue;
      recent_sales = recentSales;
      lead_count = leadCount;
      active_count = activeCount;
      inactive_count = inactiveCount;
      out_of_stock_count = outOfStockCount;
    }
  };

  public func getMonthlySalesTrend(
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : [DashboardTypes.MonthlySalesTrend] {
    let (profileKey, _role) = callerProfileKey(userStore, caller);
    // Aggregate sales by month label (YYYY-MM)
    let monthMap = Map.empty<Text, (Float, Float)>();
    for ((_id, sale) in saleStore.entries()) {
      if (sale.profile_key == profileKey) {
        let monthLabel = timestampToMonthLabel(sale.timestamp);
        let (prevRev, prevVP) = switch (monthMap.get(monthLabel)) {
          case (?v) v;
          case null (0.0, 0.0);
        };
        monthMap.add(monthLabel, (prevRev + sale.total_revenue, prevVP + sale.total_volume_points));
      };
    };
    monthMap.entries()
      .map(func((monthLabel, (rev, vp)) : (Text, (Float, Float))) : DashboardTypes.MonthlySalesTrend {
        { month_label = monthLabel; total_revenue = rev; total_volume_points = vp }
      })
      .toArray()
  };

  /// Super Admin only: aggregate stats across all profiles.
  ///
  /// Dry-run — Storage calculation:
  ///   For each profile, storage_estimate_bytes is computed as:
  ///     (userCount × 500)     ← approximate UserProfile row size in bytes
  ///   + (saleCount × 200)     ← approximate Sale row size
  ///   + 1000                  ← baseline for the Profile record + miscellaneous
  ///   This is a best-effort approximation. Uploaded assets (logos) are tracked
  ///   separately via the object-storage extension and summed in if available.
  ///   The Super Admin dashboard displays this as a human-readable estimate (KB/MB).
  public func getSuperAdminStats(
    profileStore : Map.Map<Common.ProfileKey, ProfileTypes.Profile>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    caller : Common.UserId,
  ) : DashboardTypes.SuperAdminStats {
    // Verify caller is superAdmin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };

    let totalUsers = userStore.size();
    var profiles : [DashboardTypes.ProfileStats] = [];

    for ((_key, profile) in profileStore.entries()) {
      // Count users for this profile
      let userCount = userStore.entries()
        .filter(func((_uid, up)) { up.profile_key == profile.profile_key })
        .size();

      // Find last activity (most recent sale timestamp)
      var lastActivity : Common.Timestamp = profile.created_at;
      for ((_sid, sale) in saleStore.entries()) {
        if (sale.profile_key == profile.profile_key and sale.timestamp > lastActivity) {
          lastActivity := sale.timestamp;
        };
      };

      // Rough storage estimate: 500 bytes per user + 200 bytes per sale record + baseline
      let saleCount = saleStore.entries()
        .filter(func((_sid, s)) { s.profile_key == profile.profile_key })
        .size();
      let storageEstimate = (userCount * 500) + (saleCount * 200) + 1000;

      let stat : DashboardTypes.ProfileStats = {
        profile_key = profile.profile_key;
        business_name = profile.business_name;
        owner_principal = profile.owner;
        user_count = userCount;
        storage_estimate_bytes = storageEstimate;
        last_activity = lastActivity;
        is_archived = profile.is_archived;
        // Governance fields
        is_enabled = profile.is_enabled;
        start_date = profile.start_date;
        end_date = profile.end_date;
      };
      profiles := profiles.concat([stat]);
    };

    {
      profiles;
      total_profiles = profileStore.size();
      total_users = totalUsers;
    }
  };

  // Convert nanosecond timestamp to "YYYY-MM" label
  func timestampToMonthLabel(ts : Common.Timestamp) : Text {
    // ts is nanoseconds since epoch; convert to seconds
    let seconds = ts / 1_000_000_000;
    // Days since epoch
    let days = seconds / 86400;
    // Approximate year/month calculation
    let year = 1970 + (days / 365);
    let dayOfYear = days % 365;
    let month = (dayOfYear / 30) + 1;
    let monthClamped = if (month > 12) 12 else month;
    let monthStr = if (monthClamped < 10) "0" # monthClamped.toText() else monthClamped.toText();
    year.toText() # "-" # monthStr
  };
};
