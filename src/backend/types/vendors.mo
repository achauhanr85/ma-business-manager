import Common "common";

module {
  public type Vendor = {
    id : Text;
    profile_key : Text;
    name : Text;
    contact_name : ?Text;
    phone : ?Text;
    email : ?Text;
    address : ?Text;
    is_default : Bool;
    created_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_updated_by : Common.UserId;
    last_update_date : Common.Timestamp;
  };

  public type VendorInput = {
    name : Text;
    contact_name : ?Text;
    phone : ?Text;
    email : ?Text;
    address : ?Text;
    is_default : Bool;
  };
};
