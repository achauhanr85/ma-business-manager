import Common "common";

module {
  public type Profile = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
    owner : Common.UserId;
    logo_url : Text;
    theme_color : Text;
    created_at : Common.Timestamp;
    is_archived : Bool;
  };

  public type ProfileInput = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
    logo_url : Text;
    theme_color : Text;
  };

  public type ProfilePublic = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
    owner : Common.UserId;
    logo_url : Text;
    theme_color : Text;
    created_at : Common.Timestamp;
    is_archived : Bool;
  };
};
