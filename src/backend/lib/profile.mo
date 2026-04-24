import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";

module {
  public type Store = Map.Map<Common.ProfileKey, ProfileTypes.Profile>;
  public type UserStore = Map.Map<Common.UserId, UserTypes.UserProfile>;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  /// Project Profile → ProfilePublic (strips who-columns from public surface)
  func toPublic(p : ProfileTypes.Profile) : ProfileTypes.ProfilePublic {
    {
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
      is_enabled = p.is_enabled;
      start_date = p.start_date;
      end_date = p.end_date;
    };
  };

  // ── Governance helper ─────────────────────────────────────────────────────────

  /// Check whether a profile's active window is currently open.
  ///
  /// Dry-run — Active Window logic:
  ///   1. start_date is null OR now >= start_date  → window not yet started check passes
  ///   2. end_date   is null OR now <= end_date    → window not yet expired check passes
  ///   Both checks must pass for is_within_window = true.
  ///   Example: end_date = yesterday → now > end_date → returns false.
  public func isProfileActive(profile : ProfileTypes.Profile) : Bool {
    if (not profile.is_enabled) return false;
    let now = Time.now();
    let windowOpen = switch (profile.start_date) {
      case (?sd) now >= sd;
      case null  true;
    };
    let windowNotExpired = switch (profile.end_date) {
      case (?ed) now <= ed;
      case null  true;
    };
    windowOpen and windowNotExpired
  };

  /// Returns #ok if the profile exists and passes governance checks,
  /// otherwise returns the specific error for the caller to propagate.
  ///
  /// Dry-run — Governance Gatekeeper:
  ///   Called before createSale, createPurchaseOrder, markPurchaseOrderReceived.
  ///   Step 1: profile not found → trap (data integrity error, not a governance error)
  ///   Step 2: is_enabled == false → #err(#ProfileDisabled)  [equivalent to HTTP 403]
  ///   Step 3: outside active window → #err(#OutsideActiveWindow) [HTTP 403]
  ///   Step 4: all checks pass → #ok
  ///   If a profile's end_date was yesterday, Step 3 triggers and blocks the request.
  ///   The frontend should surface "Contact Super Admin to reactivate your account."
  public func checkProfileAccess(store : Store, userStore : UserStore, caller : Common.UserId) : { #ok; #err : ProfileTypes.ProfileAccessError } {
    let profileKey = switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile");
    };
    let profile = switch (store.get(profileKey)) {
      case (?p) p;
      case null Runtime.trap("Profile not found: " # profileKey);
    };
    if (not profile.is_enabled) return #err(#ProfileDisabled);
    let now = Time.now();
    let windowOpen = switch (profile.start_date) {
      case (?sd) now >= sd;
      case null  true;
    };
    let windowNotExpired = switch (profile.end_date) {
      case (?ed) now <= ed;
      case null  true;
    };
    if (not windowOpen or not windowNotExpired) return #err(#OutsideActiveWindow);
    #ok
  };

  // ── Read operations ───────────────────────────────────────────────────────────

  /// Look up a profile by profile_key
  public func getProfileByKey(store : Store, profile_key : Common.ProfileKey) : ?ProfileTypes.ProfilePublic {
    switch (store.get(profile_key)) {
      case (?p) ?toPublic(p);
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

  /// Returns governance status for a given profile_key (Super Admin view)
  public func getProfileStatus(store : Store, profile_key : Common.ProfileKey) : ?ProfileTypes.ProfileStatus {
    switch (store.get(profile_key)) {
      case (?p) {
        let now = Time.now();
        let windowOpen = switch (p.start_date) {
          case (?sd) now >= sd;
          case null  true;
        };
        let windowNotExpired = switch (p.end_date) {
          case (?ed) now <= ed;
          case null  true;
        };
        ?{
          is_enabled = p.is_enabled;
          is_within_window = windowOpen and windowNotExpired;
          start_date = p.start_date;
          end_date = p.end_date;
        }
      };
      case null null;
    }
  };

  /// Returns all profiles with full governance details — Super Admin only
  ///
  /// Dry-run — Super Admin routing:
  ///   The frontend login redirect checks getUserProfile first. If role == #superAdmin,
  ///   the app navigates to /super-admin BEFORE restoring any saved profile session.
  ///   This ensures the super admin role takes priority over any regular profile state.
  public func getAllProfilesForAdmin(store : Store) : [ProfileTypes.ProfilePublic] {
    store.entries()
      .map(func((_k, p) : (Common.ProfileKey, ProfileTypes.Profile)) : ProfileTypes.ProfilePublic {
        toPublic(p)
      })
      .toArray()
  };

  // ── Write operations ──────────────────────────────────────────────────────────

  /// Create a new profile; traps if the profile_key already exists; caller becomes #admin
  public func createProfile(store : Store, userStore : UserStore, caller : Common.UserId, input : ProfileTypes.ProfileInput) : Bool {
    switch (store.get(input.profile_key)) {
      case (?_) false; // profile_key already taken
      case null {
        let now = Time.now();
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
          created_at = now;
          is_archived = false;
          // Profiles start enabled with no window restrictions
          is_enabled = true;
          start_date = null;
          end_date = null;
          // Who-columns
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
        };
        store.add(input.profile_key, profile);
        let up : UserTypes.UserProfile = {
          principal = caller;
          profile_key = input.profile_key;
          role = #admin;
          warehouse_name = "Main";
          display_name = input.business_name;
          joined_at = now;
          // Who-columns
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
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
        let now = Time.now();
        let up : UserTypes.UserProfile = {
          principal = caller;
          profile_key;
          role = #subAdmin;
          warehouse_name;
          display_name;
          joined_at = now;
          // Who-columns
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
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
              existing with
              business_name = input.business_name;
              phone_number = input.phone_number;
              business_address = input.business_address;
              fssai_number = input.fssai_number;
              email = input.email;
              logo_url = input.logo_url;
              theme_color = input.theme_color;
              last_updated_by = caller;
              last_update_date = Time.now();
            };
            store.add(existing.profile_key, updated);
            true
          };
        }
      };
    }
  };

  /// Enable or disable a profile — Super Admin only.
  ///
  /// Dry-run — who-column population:
  ///   last_updated_by and last_update_date are overwritten with caller + Time.now()
  ///   on every state-changing call. created_by and creation_date are preserved via
  ///   record spread (the `existing with ...` pattern copies all other fields unchanged).
  public func enableProfile(store : Store, userStore : UserStore, caller : Common.UserId, profile_key : Common.ProfileKey, enabled : Bool) : Bool {
    // Verify caller is superAdmin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    switch (store.get(profile_key)) {
      case null false;
      case (?existing) {
        let updated : ProfileTypes.Profile = {
          existing with
          is_enabled = enabled;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        store.add(profile_key, updated);
        true
      };
    }
  };

  /// Set the active governance window for a profile — Super Admin only.
  /// Pass null for start_date/end_date to remove the restriction.
  public func setProfileWindow(store : Store, userStore : UserStore, caller : Common.UserId, profile_key : Common.ProfileKey, start_date : ?Common.Timestamp, end_date : ?Common.Timestamp) : Bool {
    // Verify caller is superAdmin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    switch (store.get(profile_key)) {
      case null false;
      case (?existing) {
        let updated : ProfileTypes.Profile = {
          existing with
          start_date;
          end_date;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        store.add(profile_key, updated);
        true
      };
    }
  };

  /// Returns the UserProfile for the caller (onboarding status).
  ///
  /// Dry-run — who-column validation:
  ///   The public projection strips who-columns so they are never exposed to clients.
  ///   On the internal UserProfile record:
  ///     created_by / creation_date are set once at creation time (createProfile / joinProfile).
  ///     last_updated_by / last_update_date are updated on every write (updateUserProfile).
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
        // Dry-run — who-column population on update:
        //   created_by and creation_date preserved from existing record (immutable after first write).
        //   last_updated_by set to caller, last_update_date set to now.
        let updated : UserTypes.UserProfile = {
          existing with
          warehouse_name = input.warehouse_name;
          display_name = input.display_name;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        userStore.add(caller, updated);
        true
      };
    }
  };
};
