import Sales "sales";

module {
  public type DashboardStats = {
    monthly_volume_points : Float;
    monthly_profit : Float;
    total_inventory_value : Float;
    recent_sales : [Sales.Sale];
  };

  public type MonthlySalesTrend = {
    month_label : Text;
    total_revenue : Float;
    total_volume_points : Float;
  };
};
