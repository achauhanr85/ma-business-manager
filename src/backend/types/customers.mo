import Common "common";

module {
  public type Customer = {
    id : Common.CustomerId;
    profile_key : Common.ProfileKey;
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    created_at : Common.Timestamp;
    total_sales : Nat;
    last_purchase_at : Common.Timestamp;
    lifetime_revenue : Float;
  };

  public type CustomerInput = {
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
  };

  public type CustomerPublic = {
    id : Common.CustomerId;
    profile_key : Common.ProfileKey;
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    created_at : Common.Timestamp;
    total_sales : Nat;
    last_purchase_at : Common.Timestamp;
    lifetime_revenue : Float;
  };

  // Result for fuzzy duplicate detection
  public type DuplicateCheckResult = {
    has_similar : Bool;
    similar_customers : [CustomerPublic];
  };
};
