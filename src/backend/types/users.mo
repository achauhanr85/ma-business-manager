import Common "common";

module {
  // ── UserProfile ───────────────────────────────────────────────────────────────
  public type UserProfile = {
    principal : Common.UserId;
    profile_key : Common.ProfileKey;
    role : Common.UserRole;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
    joined_at : Common.Timestamp;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns
  public type UserProfileInput = {
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
  };

  // Public projection
  public type UserProfilePublic = {
    principal : Common.UserId;
    profile_key : Common.ProfileKey;
    role : Common.UserRole;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
    joined_at : Common.Timestamp;
  };
};
