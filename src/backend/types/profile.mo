import Common "common";

module {
  public type Profile = {
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
    owner : Common.UserId;
  };

  public type ProfileInput = {
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
  };
};
