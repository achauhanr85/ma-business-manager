import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import ProfileLib "../lib/profile";

mixin (profileStore : ProfileLib.Store) {
  public shared query ({ caller }) func getProfile() : async ?ProfileTypes.ProfileInput {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getProfile(profileStore, caller);
  };

  public shared ({ caller }) func updateProfile(input : ProfileTypes.ProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateProfile(profileStore, caller, input);
  };
};
