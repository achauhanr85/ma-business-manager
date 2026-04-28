import Runtime "mo:core/Runtime";
import Common "../types/common";
import DomainTypes "../types/core-bug-fixes-profile-sales-notifications";
import CustomerTypes "../types/customers";
import DomainLib "../lib/core-bug-fixes-profile-sales-notifications";
import ProfileLib "../lib/profile";
import CatalogLib "../lib/catalog";
import CustomersLib "../lib/customers";
import SalesLib "../lib/sales";

mixin (
  goalStore : DomainLib.GoalStore,
  medicalIssueStore : DomainLib.MedicalIssueStore,
  userStore : ProfileLib.UserStore,
  profileStore : ProfileLib.Store,
  customerStore : CustomersLib.CustomerStore,
  productStore : CatalogLib.ProductStore,
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
) {
  // ── Sequence counters ─────────────────────────────────────────────────────────
  var nextGoalId : Nat = 1;
  var nextMedicalIssueId : Nat = 1;
  var nextCustomerNoteId : Nat = 1;

  // ── Auth helper ───────────────────────────────────────────────────────────────

  func requireAdminOrSuperAdmin(caller : Common.UserId) {
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
      };
      case null Runtime.trap("Caller has no profile");
    };
  };

  func callerProfileKey(caller : Common.UserId) : Common.ProfileKey {
    switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile");
    }
  };

  // ── Goal Master API ───────────────────────────────────────────────────────────

  /// Returns all goals for the given profile.
  public shared query ({ caller }) func getGoalMasterData(profileKey : Common.ProfileKey) : async [DomainTypes.GoalMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DomainLib.getGoalMasterData(goalStore, profileKey)
  };

  /// Creates a new goal. Admin or Super Admin only.
  public shared ({ caller }) func createGoalMaster(profileKey : Common.ProfileKey, input : DomainTypes.GoalMasterInput) : async DomainTypes.GoalMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    requireAdminOrSuperAdmin(caller);
    let result = DomainLib.createGoalMaster(goalStore, nextGoalId, profileKey, input, caller);
    nextGoalId += 1;
    result
  };

  /// Updates an existing goal. Admin or Super Admin only.
  public shared ({ caller }) func updateGoalMaster(id : Nat, input : DomainTypes.GoalMasterInput) : async ?DomainTypes.GoalMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    requireAdminOrSuperAdmin(caller);
    DomainLib.updateGoalMaster(goalStore, id, input, caller)
  };

  /// Deletes a goal. Admin or Super Admin only.
  public shared ({ caller }) func deleteGoalMaster(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    requireAdminOrSuperAdmin(caller);
    DomainLib.deleteGoalMaster(goalStore, id, caller)
  };

  /// Sets the product bundle for a goal. Admin or Super Admin only.
  public shared ({ caller }) func updateGoalProductBundle(goalId : Nat, productIds : [Common.ProductId]) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    requireAdminOrSuperAdmin(caller);
    DomainLib.updateGoalProductBundle(goalStore, goalId, productIds, caller)
  };

  // ── Medical Issue Master API ──────────────────────────────────────────────────

  /// Returns all medical issues for the given profile.
  public shared query ({ caller }) func getMedicalIssueMasterData(profileKey : Common.ProfileKey) : async [DomainTypes.MedicalIssueMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DomainLib.getMedicalIssueMasterData(medicalIssueStore, profileKey)
  };

  /// Creates a new medical issue. Admin or Super Admin only.
  public shared ({ caller }) func createMedicalIssueMaster(profileKey : Common.ProfileKey, input : DomainTypes.MedicalIssueMasterInput) : async DomainTypes.MedicalIssueMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    requireAdminOrSuperAdmin(caller);
    let result = DomainLib.createMedicalIssueMaster(medicalIssueStore, nextMedicalIssueId, profileKey, input, caller);
    nextMedicalIssueId += 1;
    result
  };

  /// Updates an existing medical issue. Admin or Super Admin only.
  public shared ({ caller }) func updateMedicalIssueMaster(id : Nat, input : DomainTypes.MedicalIssueMasterInput) : async ?DomainTypes.MedicalIssueMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    requireAdminOrSuperAdmin(caller);
    DomainLib.updateMedicalIssueMaster(medicalIssueStore, id, input, caller)
  };

  /// Deletes a medical issue. Admin or Super Admin only.
  public shared ({ caller }) func deleteMedicalIssueMaster(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    requireAdminOrSuperAdmin(caller);
    DomainLib.deleteMedicalIssueMaster(medicalIssueStore, id, caller)
  };

  // ── Body Inches API ───────────────────────────────────────────────────────────

  /// Returns full body inches history for a customer, sorted latest first.
  public shared query ({ caller }) func getBodyInchesHistory(customerId : Common.CustomerId, profileKey : Common.ProfileKey) : async [CustomerTypes.BodyInchesPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DomainLib.getBodyInchesHistory(customerStore, customerId, profileKey)
  };

  /// Adds a new body inches entry for a customer.
  public shared ({ caller }) func createBodyInchesEntry(customerId : Common.CustomerId, profileKey : Common.ProfileKey, input : CustomerTypes.BodyInchesInput) : async CustomerTypes.BodyInchesPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = DomainLib.createBodyInchesEntry(customerStore, nextCustomerNoteId, customerId, profileKey, input, caller);
    nextCustomerNoteId += 1;
    result
  };

  // ── Customer Notes API ────────────────────────────────────────────────────────

  /// Appends a dated note to a customer's notes list.
  public shared ({ caller }) func addCustomerNote(customerId : Common.CustomerId, profileKey : Common.ProfileKey, input : CustomerTypes.CustomerNoteInput) : async ?CustomerTypes.CustomerPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let pk = callerProfileKey(caller);
    let _ = pk; // profile key verified via callerProfileKey
    DomainLib.addCustomerNote(customerStore, nextCustomerNoteId, customerId, profileKey, input, caller)
  };

  /// Deletes a specific note from a customer's notes list by noteId.
  public shared ({ caller }) func deleteCustomerNote(customerId : Common.CustomerId, noteId : Nat, profileKey : Common.ProfileKey) : async ?CustomerTypes.CustomerPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    DomainLib.deleteCustomerNote(customerStore, customerId, noteId, profileKey, caller)
  };

  // ── Canister Cycles API ───────────────────────────────────────────────────────

  /// Returns current canister cycles and per-profile breakdown.
  /// Super Admin only.
  public shared query ({ caller }) func getCanisterCyclesInfo() : async DomainTypes.CyclesInfo {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin access required");
      };
      case null Runtime.trap("Caller has no profile");
    };
    // Collect profile keys
    let profileKeys = profileStore.entries()
      .map(func((k, _p) : (Common.ProfileKey, _)) : Common.ProfileKey { k })
      .toArray();
    DomainLib.getCanisterCyclesInfo(profileKeys)
  };
};
