import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";
import ProfileLib "../lib/profile";
import CatalogLib "../lib/catalog";
import CustomersLib "../lib/customers";
import InventoryLib "../lib/inventory";
import SalesLib "../lib/sales";
import PurchasesLib "../lib/purchases";

mixin (
  profileStore : ProfileLib.Store,
  userStore : ProfileLib.UserStore,
  categoryStore : CatalogLib.CategoryStore,
  productStore : CatalogLib.ProductStore,
  customerStore : CustomersLib.CustomerStore,
  batchStore : InventoryLib.BatchStore,
  movementStore : InventoryLib.MovementStore,
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
  poStore : PurchasesLib.POStore,
  poItemStore : PurchasesLib.POItemStore,
) {
  /// Returns the caller's own UserProfile (for onboarding detection).
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
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getProfileStatus(profileStore, profile_key)
  };

  /// Returns all profiles with governance details — Super Admin only.
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

  /// Returns all UserProfiles across all profiles — Super Admin only
  public shared query ({ caller }) func getAllUsersForAdmin() : async [UserTypes.UserProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getAllUsersForAdmin(userStore)
  };

  /// Returns all UserProfiles for a specific profile — Super Admin only
  public shared query ({ caller }) func getUsersByProfile(profile_key : Common.ProfileKey) : async [UserTypes.UserProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getUsersByProfile(userStore, profile_key)
  };

  /// Assigns a new role to a user within a profile — Super Admin only
  public shared ({ caller }) func assignUserRole(targetUserId : Common.UserId, newRole : Common.UserRole, profile_key : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.assignUserRole(userStore, caller, targetUserId, newRole, profile_key)
  };

  /// Creates a new profile; caller becomes the #admin owner
  public shared ({ caller }) func createProfile(input : ProfileTypes.ProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.createProfile(profileStore, userStore, caller, input)
  };

  /// Joins an existing profile by profile_key as #staff
  public shared ({ caller }) func joinProfile(profile_key : Common.ProfileKey, display_name : Text, warehouse_name : Common.WarehouseName) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.joinProfile(profileStore, userStore, caller, profile_key, display_name, warehouse_name)
  };

  /// Updates profile branding/info; #admin updates own profile, #superAdmin may update any profile
  public shared ({ caller }) func updateProfile(input : ProfileTypes.ProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateProfile(profileStore, userStore, caller, input)
  };

  /// Enable or disable a profile — Super Admin only.
  public shared ({ caller }) func enableProfile(profile_key : Common.ProfileKey, enabled : Bool) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.enableProfile(profileStore, userStore, caller, profile_key, enabled)
  };

  /// Set the active governance window for a profile — Super Admin only.
  public shared ({ caller }) func setProfileWindow(profile_key : Common.ProfileKey, start_date : ?Common.Timestamp, end_date : ?Common.Timestamp) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.setProfileWindow(profileStore, userStore, caller, profile_key, start_date, end_date)
  };

  /// Delete a profile and all associated data — Super Admin only.
  public shared ({ caller }) func deleteProfile(profile_key : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.deleteProfile(
      profileStore, userStore,
      categoryStore, productStore, customerStore,
      batchStore, movementStore,
      saleStore, saleItemStore,
      poStore, poItemStore,
      caller, profile_key,
    )
  };

  /// Update the unique profile key — Super Admin only.
  public shared ({ caller }) func updateProfileKey(oldKey : Common.ProfileKey, newKey : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateProfileKey(profileStore, userStore, caller, oldKey, newKey)
  };

  /// Updates caller's own display_name / warehouse_name
  public shared ({ caller }) func updateUserProfile(input : UserTypes.UserProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateUserProfile(userStore, caller, input)
  };
};
