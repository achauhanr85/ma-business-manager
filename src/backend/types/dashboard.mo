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

  // ── ProfileStats — per-profile aggregates for Super Admin dashboard ───────────
  // storage_estimate_bytes: sum of estimated row sizes for all entities belonging
  //   to this profile_key, plus the size of uploaded assets (logo_url blob, etc.).
  //   Calculated server-side by iterating all collections and summing
  //   debug_show(record).size() as a proxy for serialised byte count.
  //
  // Governance fields mirrored here so the Super Admin dashboard can show
  // is_enabled, start_date, end_date without a separate Profile fetch.
  //
  // Dry-run: Governance Gatekeeper via Super Admin view
  //   If end_date < Time.now(), Super Admin sees the profile highlighted as Expired.
  //   Super Admin can toggle is_enabled or extend end_date to reactivate.
  public type ProfileStats = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    owner_principal : Common.UserId;
    user_count : Nat;
    storage_estimate_bytes : Nat;
    last_activity : Common.Timestamp;
    is_archived : Bool;

    // Governance fields
    is_enabled : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;
  };

  // ── SuperAdminProfileView — richer record shown on Super Admin profile list ───
  // Extends ProfileStats with who-column summary for audit visibility.
  public type SuperAdminProfileView = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    owner_principal : Common.UserId;
    user_count : Nat;
    storage_estimate_bytes : Nat;
    last_activity : Common.Timestamp;
    is_archived : Bool;

    // Governance
    is_enabled : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;

    // Who-columns summary
    created_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_updated_by : Common.UserId;
    last_update_date : Common.Timestamp;
  };

  public type SuperAdminStats = {
    profiles : [ProfileStats];
    total_profiles : Nat;
    total_users : Nat;
  };
};
