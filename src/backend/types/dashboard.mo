import Sales "sales";
import Common "common";

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

  // Per-profile stats aggregated for Super Admin view
  public type ProfileStats = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    owner_principal : Common.UserId;
    user_count : Nat;
    storage_estimate_bytes : Nat;
    last_activity : Common.Timestamp;
    is_archived : Bool;
  };

  public type SuperAdminStats = {
    profiles : [ProfileStats];
    total_profiles : Nat;
    total_users : Nat;
  };
};
