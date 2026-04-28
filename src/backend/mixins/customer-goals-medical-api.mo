import Runtime "mo:core/Runtime";
import Common "../types/common";
import CustomerTypes "../types/customers";
import GoalMedicalTypes "../types/goals-medical";
import GoalMedicalLib "../lib/customer-goals-medical";
import CustomersLib "../lib/customers";
import ProfileLib "../lib/profile";

mixin (
  goalMasterStore : GoalMedicalLib.GoalMasterStore,
  medicalIssueStore : GoalMedicalLib.MedicalIssueMasterStore,
  bodyInchesStore : GoalMedicalLib.BodyInchesStore,
  customerNoteStore : GoalMedicalLib.CustomerNoteStore,
  customerStore : CustomersLib.CustomerStore,
  profileStore : ProfileLib.Store,
  userStore : ProfileLib.UserStore,
) {
  var nextGoalId : Nat = 1;
  var nextMedicalIssueId : Nat = 1;
  var nextBodyInchesId : Nat = 1;

  // ── Goals ─────────────────────────────────────────────────────────────────────

  public shared query ({ caller }) func listGoals() : async [GoalMedicalTypes.GoalMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalMedicalLib.listGoals(goalMasterStore, userStore, caller)
  };

  public shared query ({ caller }) func getGoal(id : Nat) : async ?GoalMedicalTypes.GoalMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalMedicalLib.getGoal(goalMasterStore, userStore, caller, id)
  };

  public shared ({ caller }) func createGoal(input : GoalMedicalTypes.GoalMasterInput) : async Nat {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    let id = GoalMedicalLib.createGoal(goalMasterStore, userStore, caller, nextGoalId, input);
    nextGoalId += 1;
    id
  };

  public shared ({ caller }) func updateGoal(id : Nat, input : GoalMedicalTypes.GoalMasterInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalMedicalLib.updateGoal(goalMasterStore, userStore, caller, id, input)
  };

  public shared ({ caller }) func deleteGoal(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalMedicalLib.deleteGoal(goalMasterStore, userStore, caller, id)
  };

  // ── Medical Issues ────────────────────────────────────────────────────────────

  public shared query ({ caller }) func listMedicalIssues() : async [GoalMedicalTypes.MedicalIssueMasterPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalMedicalLib.listMedicalIssues(medicalIssueStore, userStore, caller)
  };

  public shared query ({ caller }) func getMedicalIssue(id : Nat) : async ?GoalMedicalTypes.MedicalIssueMasterPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalMedicalLib.getMedicalIssue(medicalIssueStore, userStore, caller, id)
  };

  public shared ({ caller }) func createMedicalIssue(input : GoalMedicalTypes.MedicalIssueMasterInput) : async Nat {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    let id = GoalMedicalLib.createMedicalIssue(medicalIssueStore, userStore, caller, nextMedicalIssueId, input);
    nextMedicalIssueId += 1;
    id
  };

  public shared ({ caller }) func updateMedicalIssue(id : Nat, input : GoalMedicalTypes.MedicalIssueMasterInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalMedicalLib.updateMedicalIssue(medicalIssueStore, userStore, caller, id, input)
  };

  public shared ({ caller }) func deleteMedicalIssue(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    GoalMedicalLib.deleteMedicalIssue(medicalIssueStore, userStore, caller, id)
  };

  // ── Body Inches ───────────────────────────────────────────────────────────────

  public shared ({ caller }) func createBodyInchesEntry(customerId : Common.CustomerId, input : CustomerTypes.BodyInchesInput) : async CustomerTypes.BodyInchesPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let entry = GoalMedicalLib.createBodyInchesEntry(bodyInchesStore, userStore, caller, customerId, nextBodyInchesId, input);
    nextBodyInchesId += 1;
    entry
  };

  public shared query ({ caller }) func listBodyInchesHistory(customerId : Common.CustomerId) : async [CustomerTypes.BodyInchesPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalMedicalLib.listBodyInchesHistory(bodyInchesStore, userStore, caller, customerId)
  };

  public shared ({ caller }) func deleteBodyInchesEntry(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    GoalMedicalLib.deleteBodyInchesEntry(bodyInchesStore, userStore, caller, id)
  };

  // ── Customer Notes ────────────────────────────────────────────────────────────

  /// Add a structured note to a customer's embedded notes array.
  /// Appends the note and returns it (with auto-assigned id and creation metadata).
  public shared ({ caller }) func addCustomerNote(customerId : Common.CustomerId, input : CustomerTypes.CustomerNoteInput) : async ?CustomerTypes.CustomerNote {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    // Use CustomersLib — appends to customer.notes and returns updated customer
    let updatedCustomerOpt = CustomersLib.addCustomerNote(customerStore, userStore, caller, customerId, input.text, input.note_date);
    switch (updatedCustomerOpt) {
      case null null;
      case (?c) {
        // Return the last note in the updated array (the newly added one)
        let notes = c.notes;
        if (notes.size() == 0) return null;
        ?notes[notes.size() - 1]
      };
    }
  };

  /// Returns notes from the customer's embedded notes array (newest first).
  public shared query ({ caller }) func listCustomerNotes(customerId : Common.CustomerId) : async [CustomerTypes.CustomerNote] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    switch (customerStore.get(customerId)) {
      case null [];
      case (?c) {
        if (c.profile_key != up.profile_key) return [];
        // Sort by note_date descending (newest first)
        let notes = c.notes;
        notes.sort(func(a, b) {
          if (a.note_date > b.note_date) #less
          else if (a.note_date < b.note_date) #greater
          else #equal
        })
      };
    }
  };

  public shared ({ caller }) func deleteCustomerNote(noteId : Nat, customerId : Common.CustomerId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.deleteCustomerNote(customerStore, userStore, caller, customerId, noteId)
  };

  // ── Cycles Info ───────────────────────────────────────────────────────────────

  /// Super Admin only — returns canister cycles info and per-profile estimates.
  public shared ({ caller }) func getCyclesInfo() : async GoalMedicalTypes.CyclesInfo {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #superAdmin) Runtime.trap("Super Admin access required");
    GoalMedicalLib.getCyclesInfo(userStore, profileStore, caller)
  };
};
