import Common "common";

module {
  public type UserProfile = {
    principal : Common.UserId;
    profile_key : Common.ProfileKey;
    role : Common.UserRole;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
    joined_at : Common.Timestamp;
  };

  public type UserProfileInput = {
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
  };

  public type UserProfilePublic = {
    principal : Common.UserId;
    profile_key : Common.ProfileKey;
    role : Common.UserRole;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
    joined_at : Common.Timestamp;
  };
};
