/*
 * mixins/goals-api.mo — LEGACY Goals and Medical Issues Public API
 *
 * STATUS: *** DEPRECATED — DO NOT ADD NEW FEATURES HERE ***
 *
 * WHAT THIS FILE DOES:
 *   Exposes the legacy goal and medical issue API functions as public canister methods.
 *   These functions pass profileKey explicitly (the caller must provide it) and return
 *   the legacy public types from types/goals.mo.
 *
 * WHO USES IT:
 *   main.mo includes this mixin (GoalsApi) alongside the active CustomerGoalsMedicalApi.
 *   Any frontend code that calls getGoalMasterData / createGoalMaster / etc. hits this.
 *
 * WHY IT IS DEPRECATED:
 *   The active mixin (mixins/customer-goals-medical-api.mo) provides the same
 *   functionality with better API design:
 *     - listGoals / createGoal / updateGoal / deleteGoal (no explicit profileKey)
 *     - listMedicalIssues / createMedicalIssue / etc.
 *   New frontend pages should call the active API names only.
 *
 * SAFE TO REMOVE WHEN:
 *   All frontend calls to getGoalMasterData / createGoalMaster /
 *   getMedicalIssueMasterData / createMedicalIssueMaster have been migrated
 *   to the active API, and confirmed no longer called.
 *
 * NOTE: Body inches functions from this legacy API (if any exist) are superseded by
 *       createBodyInchesEntry / listBodyInchesHistory in customer-goals-medical-api.mo.
 */

import Runtime "mo:core/Runtime";
import Map "mo:core/Map";
import Common "../types/common";
import GoalTypes "../types/goals";
import CustomerTypes "../types/customers";
import GoalsLib "../lib/goals";
import ProfileLib "../lib/profile";

mixin (
  goalStore : GoalsLib.GoalStore,         // LEGACY goal store (goalStore in main.mo)
  medicalIssueStore : GoalsLib.MedicalIssueStore, // LEGACY medical issue store
  bodyInchesStore : GoalsLib.BodyInchesStore,     // LEGACY body inches store
  userStore : ProfileLib.UserStore,
) {
  // Auto-incrementing ID counters for the legacy stores.
  // These start at 1 and are independent of the active system's counters.
  var nextLegacyGoalId : Nat = 1;
  var nextLegacyMedicalIssueId : Nat = 1;

  // ── Legacy Goals API ──────────────────────────────────────────────────────

  /// Returns all goals for a given profileKey.
  /// DEPRECATED: use listGoals() from customer-goals-medical-api instead.
  public shared query ({ caller }) func getGoalMasterData(profileKey : Common.ProfileKey) : async [GoalTypes.GoalMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalsLib.getGoalMasterData(goalStore, profileKey)
  };

  /// Creates a new goal in the LEGACY store. Only Admin / Super Admin can create.
  /// DEPRECATED: use createGoal() from customer-goals-medical-api instead.
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

  /// Updates a goal in the LEGACY store. Only Admin / Super Admin can update.
  /// DEPRECATED: use updateGoal() from customer-goals-medical-api instead.
  public shared ({ caller }) func updateGoalMaster(id : Nat, name : Text, description : Text, productBundle : [Common.ProductId]) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalsLib.updateGoalMaster(goalStore, userStore, caller, id, name, description, productBundle, up.profile_key)
  };

  /// Permanently removes a goal from the LEGACY store. Only Admin / Super Admin.
  /// DEPRECATED: use deleteGoal() from customer-goals-medical-api instead.
  public shared ({ caller }) func deleteGoalMaster(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalsLib.deleteGoalMaster(goalStore, id, up.profile_key)
  };

  // ── Legacy Medical Issues API ─────────────────────────────────────────────

  /// Returns all medical issues for a given profileKey.
  /// DEPRECATED: use listMedicalIssues() from customer-goals-medical-api instead.
  public shared query ({ caller }) func getMedicalIssueMasterData(profileKey : Common.ProfileKey) : async [GoalTypes.MedicalIssueMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalsLib.getMedicalIssueMasterData(medicalIssueStore, profileKey)
  };

  /// Creates a new medical issue in the LEGACY store. Only Admin / Super Admin.
  /// DEPRECATED: use createMedicalIssue() from customer-goals-medical-api instead.
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

  /// Updates a medical issue in the LEGACY store.
  /// DEPRECATED: use updateMedicalIssue() from customer-goals-medical-api instead.
  public shared ({ caller }) func updateMedicalIssueMaster(id : Nat, name : Text, description : Text) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalsLib.updateMedicalIssueMaster(medicalIssueStore, caller, id, name, description, up.profile_key)
  };

  /// Permanently removes a medical issue from the LEGACY store.
  /// DEPRECATED: use deleteMedicalIssue() from customer-goals-medical-api instead.
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
