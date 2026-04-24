import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import DashboardTypes "../types/dashboard";
import SalesTypes "../types/sales";
import InventoryTypes "../types/inventory";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";

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

    // Total inventory value for this profile
    var totalInventoryValue : Float = 0.0;
    for ((_id, batch) in batchStore.entries()) {
      if (batch.profile_key == profileKey and batch.quantity_remaining > 0) {
        totalInventoryValue += batch.quantity_remaining.toFloat() * batch.unit_cost;
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

    {
      monthly_volume_points = monthlyVP;
      monthly_profit = monthlyProfit;
      total_inventory_value = totalInventoryValue;
      recent_sales = recentSales;
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

  /// Super Admin only: aggregate stats across all profiles
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

      // Rough storage estimate: 500 bytes per user + 200 bytes per record
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
