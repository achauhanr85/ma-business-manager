import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";
import ProfileLib "../lib/profile";

mixin (
  profileStore : ProfileLib.Store,
  userStore : ProfileLib.UserStore,
) {
  /// Returns the caller's own UserProfile (for onboarding detection)
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

  /// Updates caller's own display_name / warehouse_name
  public shared ({ caller }) func updateUserProfile(input : UserTypes.UserProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateUserProfile(userStore, caller, input)
  };
};
