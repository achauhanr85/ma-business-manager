import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Common "../types/common";
import ProfileTypes "../types/profile";

module {
  public type Store = Map.Map<Common.UserId, ProfileTypes.Profile>;

  public func getProfile(store : Store, caller : Common.UserId) : ?ProfileTypes.ProfileInput {
    switch (store.get(caller)) {
      case (?p) {
        ?{
          business_name = p.business_name;
          phone_number = p.phone_number;
          business_address = p.business_address;
          fssai_number = p.fssai_number;
          email = p.email;
        };
      };
      case null null;
    };
  };

  public func updateProfile(store : Store, caller : Common.UserId, input : ProfileTypes.ProfileInput) : Bool {
    // Validate fssai_number is exactly 14 digits
    let fssai = input.fssai_number;
    if (fssai.size() != 14) return false;
    let allDigits = fssai.toIter().all(func(c : Char) : Bool {
      c >= '0' and c <= '9'
    });
    if (not allDigits) return false;

    let profile : ProfileTypes.Profile = {
      business_name = input.business_name;
      phone_number = input.phone_number;
      business_address = input.business_address;
      fssai_number = input.fssai_number;
      email = input.email;
      owner = caller;
    };
    store.add(caller, profile);
    true;
  };
};
