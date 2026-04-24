import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Common "../types/common";
import DashboardTypes "../types/dashboard";
import SalesTypes "../types/sales";
import InventoryTypes "../types/inventory";

module {
  let NS_PER_DAY : Int = 86_400_000_000_000; // 24 * 60 * 60 * 1_000_000_000

  let MONTH_DAYS : [Nat] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let MONTH_NAMES : [Text] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Convert nanosecond timestamp to (year, month) in UTC (approximate, no leap second handling)
  func timestampToYM(ts : Int) : (Int, Int) {
    let days = ts / NS_PER_DAY;
    var remaining : Nat = Int.abs(days);
    var year : Int = 1970;
    label yearLoop loop {
      let daysInYear : Nat = if ((year - 1968) % 4 == 0 and ((year - 1900) % 100 != 0 or (year - 1600) % 400 == 0)) 366 else 365;
      if (remaining < daysInYear) break yearLoop;
      remaining := remaining - daysInYear;
      year := year + 1;
    };
    let isLeap = (year - 1968) % 4 == 0 and ((year - 1900) % 100 != 0 or (year - 1600) % 400 == 0);
    var month : Int = 1;
    label monthLoop for (mi in Nat.range(0, 12)) {
      let daysInMonth : Nat = if (mi == 1 and isLeap) 29 else MONTH_DAYS[mi];
      if (remaining < daysInMonth) break monthLoop;
      remaining := remaining - daysInMonth;
      month := mi.toInt() + 2;
    };
    (year, month);
  };

  public func getDashboardStats(
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    caller : Common.UserId,
  ) : DashboardTypes.DashboardStats {
    let now = Time.now();
    let (currentYear, currentMonth) = timestampToYM(now);

    var monthlyVP : Float = 0.0;
    var monthlyProfit : Float = 0.0;
    let allSales = List.empty<SalesTypes.Sale>();

    for ((_, sale) in saleStore.entries()) {
      if (Principal.equal(sale.owner, caller)) {
        allSales.add(sale);
        let (saleYear, saleMonth) = timestampToYM(sale.timestamp);
        if (saleYear == currentYear and saleMonth == currentMonth) {
          monthlyVP := monthlyVP + sale.total_volume_points;
          monthlyProfit := monthlyProfit + sale.total_profit;
        };
      };
    };

    var inventoryValue : Float = 0.0;
    for ((_, batch) in batchStore.entries()) {
      if (Principal.equal(batch.owner, caller)) {
        inventoryValue := inventoryValue + (batch.unit_cost * batch.quantity_remaining.toFloat());
      };
    };

    let sortedSales = allSales.sort(func(a, b) { Int.compare(b.timestamp, a.timestamp) });
    let recentCount : Int = if (sortedSales.size() < 5) sortedSales.size().toInt() else 5;
    let recentSales = sortedSales.sliceToArray(0, recentCount);

    {
      monthly_volume_points = monthlyVP;
      monthly_profit = monthlyProfit;
      total_inventory_value = inventoryValue;
      recent_sales = recentSales;
    };
  };

  public func getMonthlySalesTrend(
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    caller : Common.UserId,
  ) : [DashboardTypes.MonthlySalesTrend] {
    let now = Time.now();
    let (currentYear, currentMonth) = timestampToYM(now);

    // Build 12 month-year buckets going backwards from current month
    let bucketYears = List.empty<Int>();
    let bucketMonths = List.empty<Int>();
    var y = currentYear;
    var m = currentMonth;
    var i = 0;
    while (i < 12) {
      bucketYears.add(y);
      bucketMonths.add(m);
      m := m - 1;
      if (m == 0) { m := 12; y := y - 1 };
      i := i + 1;
    };
    // Reverse so oldest bucket is first (index 0)
    let byArr = bucketYears.reverse().toArray();
    let bmArr = bucketMonths.reverse().toArray();

    let revenues = List.repeat(0.0, 12);
    let vps = List.repeat(0.0, 12);

    for ((_, sale) in saleStore.entries()) {
      if (Principal.equal(sale.owner, caller)) {
        let (sy, sm) = timestampToYM(sale.timestamp);
        for (idx in Nat.range(0, 12)) {
          if (sy == byArr[idx] and sm == bmArr[idx]) {
            revenues.put(idx, revenues.at(idx) + sale.total_revenue);
            vps.put(idx, vps.at(idx) + sale.total_volume_points);
          };
        };
      };
    };

    let result = List.empty<DashboardTypes.MonthlySalesTrend>();
    for (idx in Nat.range(0, 12)) {
      let monthIdx = Int.abs(bmArr[idx] - 1);
      let yearSuffix = (byArr[idx] % 100).toText();
      result.add({
        month_label = MONTH_NAMES[monthIdx] # " " # yearSuffix;
        total_revenue = revenues.at(idx);
        total_volume_points = vps.at(idx);
      });
    };
    result.toArray();
  };
};
