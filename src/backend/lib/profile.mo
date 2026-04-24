import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";

module {
  public type Store = Map.Map<Common.ProfileKey, ProfileTypes.Profile>;
  public type UserStore = Map.Map<Common.UserId, UserTypes.UserProfile>;

  /// Look up a profile by profile_key
  public func getProfileByKey(store : Store, profile_key : Common.ProfileKey) : ?ProfileTypes.ProfilePublic {
    switch (store.get(profile_key)) {
      case (?p) ?{
        profile_key = p.profile_key;
        business_name = p.business_name;
        phone_number = p.phone_number;
        business_address = p.business_address;
        fssai_number = p.fssai_number;
        email = p.email;
        owner = p.owner;
        logo_url = p.logo_url;
        theme_color = p.theme_color;
        created_at = p.created_at;
        is_archived = p.is_archived;
      };
      case null null;
    }
  };

  /// Look up the caller's own profile (via their UserProfile's profile_key)
  public func getProfileForCaller(store : Store, userStore : UserStore, caller : Common.UserId) : ?ProfileTypes.ProfilePublic {
    switch (userStore.get(caller)) {
      case (?up) getProfileByKey(store, up.profile_key);
      case null null;
    }
  };

  /// Create a new profile; traps if the profile_key already exists; caller becomes #admin
  public func createProfile(store : Store, userStore : UserStore, caller : Common.UserId, input : ProfileTypes.ProfileInput) : Bool {
    switch (store.get(input.profile_key)) {
      case (?_) false; // profile_key already taken
      case null {
        let profile : ProfileTypes.Profile = {
          profile_key = input.profile_key;
          business_name = input.business_name;
          phone_number = input.phone_number;
          business_address = input.business_address;
          fssai_number = input.fssai_number;
          email = input.email;
          owner = caller;
          logo_url = input.logo_url;
          theme_color = input.theme_color;
          created_at = Time.now();
          is_archived = false;
        };
        store.add(input.profile_key, profile);
        let up : UserTypes.UserProfile = {
          principal = caller;
          profile_key = input.profile_key;
          role = #admin;
          warehouse_name = "Main";
          display_name = input.business_name;
          joined_at = Time.now();
        };
        userStore.add(caller, up);
        true
      };
    }
  };

  /// Join an existing profile by profile_key; assigns #subAdmin role
  public func joinProfile(store : Store, userStore : UserStore, caller : Common.UserId, profile_key : Common.ProfileKey, display_name : Text, warehouse_name : Common.WarehouseName) : Bool {
    switch (store.get(profile_key)) {
      case null false; // profile_key does not exist
      case (?_) {
        let up : UserTypes.UserProfile = {
          principal = caller;
          profile_key;
          role = #subAdmin;
          warehouse_name;
          display_name;
          joined_at = Time.now();
        };
        userStore.add(caller, up);
        true
      };
    }
  };

  /// Update profile details; only owner (#admin) may update
  public func updateProfile(store : Store, userStore : UserStore, caller : Common.UserId, input : ProfileTypes.ProfileInput) : Bool {
    switch (userStore.get(caller)) {
      case null false;
      case (?up) {
        if (up.role != #admin and up.role != #superAdmin) return false;
        switch (store.get(up.profile_key)) {
          case null false;
          case (?existing) {
            let updated : ProfileTypes.Profile = {
              profile_key = existing.profile_key;
              business_name = input.business_name;
              phone_number = input.phone_number;
              business_address = input.business_address;
              fssai_number = input.fssai_number;
              email = input.email;
              owner = existing.owner;
              logo_url = input.logo_url;
              theme_color = input.theme_color;
              created_at = existing.created_at;
              is_archived = existing.is_archived;
            };
            store.add(existing.profile_key, updated);
            true
          };
        }
      };
    }
  };

  /// Returns the UserProfile for the caller (onboarding status)
  public func getUserProfile(userStore : UserStore, caller : Common.UserId) : ?UserTypes.UserProfilePublic {
    switch (userStore.get(caller)) {
      case (?up) ?{
        principal = up.principal;
        profile_key = up.profile_key;
        role = up.role;
        warehouse_name = up.warehouse_name;
        display_name = up.display_name;
        joined_at = up.joined_at;
      };
      case null null;
    }
  };

  /// Update caller's display_name; warehouse_name update allowed for all roles
  public func updateUserProfile(userStore : UserStore, caller : Common.UserId, input : UserTypes.UserProfileInput) : Bool {
    switch (userStore.get(caller)) {
      case null false;
      case (?existing) {
        let updated : UserTypes.UserProfile = {
          principal = existing.principal;
          profile_key = existing.profile_key;
          role = existing.role;
          warehouse_name = input.warehouse_name;
          display_name = input.display_name;
          joined_at = existing.joined_at;
        };
        userStore.add(caller, updated);
        true
      };
    }
  };
};
