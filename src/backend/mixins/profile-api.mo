import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";
import ProfileLib "../lib/profile";

mixin (
  profileStore : ProfileLib.Store,
  userStore : ProfileLib.UserStore,
) {
  /// Returns the caller's own UserProfile (for onboarding detection).
  ///
  /// Dry-run — Super Admin routing:
  ///   If role == #superAdmin, the frontend MUST redirect to the Super Admin Dashboard
  ///   BEFORE checking any saved profile session. The #superAdmin role takes absolute
  ///   priority. This prevents a super admin from accidentally operating as a tenant user.
  ///
  /// If the caller's profile is disabled, the frontend should show a
  /// "Contact Super Admin to reactivate your account" message rather than the normal UI.
  public shared query ({ caller }) func getUserProfile() : async ?UserTypes.UserProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getUserProfile(userStore, caller)
  };

  /// Returns the caller's linked business profile details
  public shared query ({ caller }) func getProfile() : async ?ProfileTypes.ProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getProfileForCaller(profileStore, userStore, caller)
  };

  /// Look up any profile by its key (public info for join flow)
  public shared query ({ caller }) func getProfileByKey(profile_key : Common.ProfileKey) : async ?ProfileTypes.ProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getProfileByKey(profileStore, profile_key)
  };

  /// Returns the governance status for a given profile — Super Admin only
  public shared query ({ caller }) func getProfileStatus(profile_key : Common.ProfileKey) : async ?ProfileTypes.ProfileStatus {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    // Verify super admin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getProfileStatus(profileStore, profile_key)
  };

  /// Returns all profiles with governance details — Super Admin only.
  ///
  /// Dry-run — Storage calculation:
  ///   Space occupied per profile is estimated as:
  ///     (user_count × 500 bytes)        ← approximate UserProfile record size
  ///   + (sale_count × 200 bytes)        ← approximate Sale record size
  ///   + (po_count × 150 bytes)          ← approximate PurchaseOrder record size
  ///   + (batch_count × 120 bytes)       ← approximate InventoryBatch record size
  ///   + (customer_count × 300 bytes)    ← approximate Customer record size
  ///   + asset_bytes                     ← logo and uploaded file sizes from object-storage
  ///   The dashboard displays this as "~X KB" or "~X MB" depending on magnitude.
  ///   More precise sizing requires a dedicated storage canister query; this is a
  ///   best-effort approximation for the Super Admin monitoring view.
  public shared query ({ caller }) func getAllProfilesForAdmin() : async [ProfileTypes.ProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getAllProfilesForAdmin(profileStore)
  };

  /// Creates a new profile; caller becomes the #admin owner
  public shared ({ caller }) func createProfile(input : ProfileTypes.ProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.createProfile(profileStore, userStore, caller, input)
  };

  /// Joins an existing profile by profile_key as #subAdmin
  public shared ({ caller }) func joinProfile(profile_key : Common.ProfileKey, display_name : Text, warehouse_name : Common.WarehouseName) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.joinProfile(profileStore, userStore, caller, profile_key, display_name, warehouse_name)
  };

  /// Updates profile branding/info; only #admin may call
  public shared ({ caller }) func updateProfile(input : ProfileTypes.ProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateProfile(profileStore, userStore, caller, input)
  };

  /// Enable or disable a profile — Super Admin only.
  /// When disabled, profile members cannot create transactions and see a
  /// "Contact Administrator" message on login.
  public shared ({ caller }) func enableProfile(profile_key : Common.ProfileKey, enabled : Bool) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.enableProfile(profileStore, userStore, caller, profile_key, enabled)
  };

  /// Set the active governance window for a profile — Super Admin only.
  /// Pass null for start_date / end_date to remove the restriction entirely.
  public shared ({ caller }) func setProfileWindow(profile_key : Common.ProfileKey, start_date : ?Common.Timestamp, end_date : ?Common.Timestamp) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.setProfileWindow(profileStore, userStore, caller, profile_key, start_date, end_date)
  };

  /// Updates caller's own display_name / warehouse_name
  public shared ({ caller }) func updateUserProfile(input : UserTypes.UserProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateUserProfile(userStore, caller, input)
  };
};
