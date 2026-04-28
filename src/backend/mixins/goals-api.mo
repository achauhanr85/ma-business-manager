import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Common "../types/common";
import GoalTypes "../types/goals";
import CustomerTypes "../types/customers";
import GoalsLib "../lib/goals";
import ProfileLib "../lib/profile";

mixin (
  goalStore : GoalsLib.GoalStore,
  medicalIssueStore : GoalsLib.MedicalIssueStore,
  bodyInchesStore : GoalsLib.BodyInchesStore,
  userStore : ProfileLib.UserStore,
) {
  var nextLegacyGoalId : Nat = 1;
  var nextLegacyMedicalIssueId : Nat = 1;
  // ── Goals Master ──────────────────────────────────────────────────────────────

  public shared query ({ caller }) func getGoalMasterData(profileKey : Common.ProfileKey) : async [GoalTypes.GoalMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalsLib.getGoalMasterData(goalStore, profileKey)
  };

  public shared ({ caller }) func createGoalMaster(profileKey : Common.ProfileKey, name : Text, description : Text) : async GoalTypes.GoalMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    let result = GoalsLib.createGoalMaster(goalStore, userStore, caller, nextLegacyGoalId, profileKey, name, description);
    nextLegacyGoalId += 1;
    result
  };

  public shared ({ caller }) func updateGoalMaster(id : Nat, name : Text, description : Text, productBundle : [Common.ProductId]) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalsLib.updateGoalMaster(goalStore, userStore, caller, id, name, description, productBundle, up.profile_key)
  };

  public shared ({ caller }) func deleteGoalMaster(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalsLib.deleteGoalMaster(goalStore, id, up.profile_key)
  };

  // ── Medical Issues Master ─────────────────────────────────────────────────────

  public shared query ({ caller }) func getMedicalIssueMasterData(profileKey : Common.ProfileKey) : async [GoalTypes.MedicalIssueMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalsLib.getMedicalIssueMasterData(medicalIssueStore, profileKey)
  };

  public shared ({ caller }) func createMedicalIssueMaster(profileKey : Common.ProfileKey, name : Text, description : Text) : async GoalTypes.MedicalIssueMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    let result = GoalsLib.createMedicalIssueMaster(medicalIssueStore, userStore, caller, nextLegacyMedicalIssueId, profileKey, name, description);
    nextLegacyMedicalIssueId += 1;
    result
  };

  public shared ({ caller }) func updateMedicalIssueMaster(id : Nat, name : Text, description : Text) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalsLib.updateMedicalIssueMaster(medicalIssueStore, caller, id, name, description, up.profile_key)
  };

  public shared ({ caller }) func deleteMedicalIssueMaster(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalsLib.deleteMedicalIssueMaster(medicalIssueStore, id, up.profile_key)
  };
};
