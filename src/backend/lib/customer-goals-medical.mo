/*
 * lib/customer-goals-medical.mo — ACTIVE Goals, Medical Issues, Body Inches and Notes Logic
 *
 * ─────────────────────────────────────────────────────────────────────
 * WHAT THIS FILE DOES:
 *   Implements all CRUD business logic for:
 *     - Goal master data (profile-level goal definitions)
 *     - Medical issue master data (profile-level condition definitions)
 *     - Customer ↔ Goal assignments (link/unlink goal IDs to customers)
 *     - Customer ↔ Medical Issue assignments (link/unlink issue IDs to customers)
 *     - Customer body inches measurements (time-series per customer)
 *     - Customer notes (structured dated notes)
 *     - Canister cycles info (Super Admin only)
 *
 * KEY BEHAVIOURS:
 *   - Auto-derives the caller's profileKey from userStore (no need to pass it)
 *   - createGoal / updateGoal enforce unique name per profile (case-insensitive)
 *   - createMedicalIssue / updateMedicalIssue enforce unique name per profile (case-insensitive)
 *   - Duplicate names return #err("...") using Result<Nat, Text> / Result<Bool, Text>
 *   - Body inches sorted newest-first by entry_date
 *
 * FLOW — Goals Page:
 *   Frontend loads → listGoals() → [GoalMasterPublic]
 *   Admin clicks Add → createGoal(input) → #ok(newId) or #err("name exists")
 *   Admin clicks Edit → updateGoal(id, input) → #ok(true) or #err("name exists")
 *   Admin clicks Delete → deleteGoal(id) → Bool
 *
 * FLOW — Medical Issues Page:
 *   Frontend loads → listMedicalIssues() → [MedicalIssueMasterPublic]
 *   Admin clicks Add → createMedicalIssue(input) → #ok(newId) or #err("name exists")
 *   Admin clicks Edit → updateMedicalIssue(id, input) → #ok(true) or #err("name exists")
 *   Admin clicks Delete → deleteMedicalIssue(id) → Bool
 *
 * FLOW — Customer Detail (Goals/Medical tab):
 *   Load → getCustomerGoals(customerId) → [GoalMasterPublic]
 *   Assign → addGoalToCustomer(customerId, goalId) → Bool
 *   Unassign → removeGoalFromCustomer(customerId, goalId) → Bool
 *   (same pattern for medical issues)
 *
 * FLOW — Body Inches Tab:
 *   Load → listBodyInchesHistory(customerId) → sorted newest-first
 *   Add → createBodyInchesEntry(customerId, input) → BodyInchesPublic
 *   Delete → deleteBodyInchesEntry(id) → Bool
 *
 * WHO USES IT:
 *   mixins/customer-goals-medical-api.mo (public API layer that delegates here)
 *
 * ROLE ACCESS:
 *   listGoals / listMedicalIssues / getCustomerGoals / getCustomerMedicalIssues
 *     → any authenticated user in the profile
 *   createGoal / updateGoal / deleteGoal / createMedicalIssue / updateMedicalIssue / deleteMedicalIssue
 *     → Admin or Super Admin only (enforced in the mixin, not here)
 *   addGoalToCustomer / removeGoalFromCustomer / addMedicalIssueToCustomer / removeMedicalIssueFromCustomer
 *     → any authenticated user in the profile
 *   createBodyInchesEntry / deleteBodyInchesEntry / listBodyInchesHistory
 *     → any authenticated user in the profile
 *   getCyclesInfo → Super Admin only (enforced in the mixin)
 *
 * NOTE ON CUSTOMER NOTES:
 *   Notes are stored as an embedded array on the Customer record (Customer.notes).
 *   The customerNoteStore in main.mo is used only as a note-ID registry —
 *   the actual note content lives on the customer record itself, maintained by
 *   CustomersLib.addCustomerNote / CustomersLib.deleteCustomerNote.
 *   To read notes: fetch the customer via getCustomer() — the notes array is included.
 * ─────────────────────────────────────────────────────────────────────
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Cycles "mo:core/Cycles";
import Common "../types/common";
import CustomerTypes "../types/customers";
import GoalMedicalTypes "../types/goals-medical";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";

module {

  // ── Store type aliases ────────────────────────────────────────────────────
  // These are the ACTIVE stores declared in main.mo.
  // GoalMasterStore:         profile-level goal definitions (e.g. "Weight Loss")
  // MedicalIssueMasterStore: profile-level medical issue definitions (e.g. "Diabetes")
  // BodyInchesStore:         body inch measurements per customer over time
  // CustomerNoteStore:       note ID registry (notes themselves live on Customer record)
  public type GoalMasterStore = Map.Map<Nat, GoalMedicalTypes.GoalMaster>;
  public type MedicalIssueMasterStore = Map.Map<Nat, GoalMedicalTypes.MedicalIssueMaster>;
  public type BodyInchesStore = Map.Map<Nat, CustomerTypes.BodyInchesEntry>;
  public type CustomerNoteStore = Map.Map<Nat, CustomerTypes.CustomerNote>;

  // ── Private helper: look up profile key from userStore ────────────────────
  // Every function in this module calls this first to find out which profile the
  // caller belongs to. This eliminates the need for callers to pass a profileKey.
  // Traps with a clear error if:
  //   - The caller has no user record yet (brand new user, not yet registered)
  //   - The caller IS Super Admin but has no active impersonation profile set
  //     (Super Admin must call setSuperAdminActiveProfile() first, otherwise their
  //      profile_key is "" and no goals/medical issues would be found)
  func callerProfileKey(
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : Common.ProfileKey {
    switch (userStore.get(caller)) {
      case null Runtime.trap("Caller has no profile");
      case (?up) {
        // Guard: Super Admin (or any user) with an empty profile_key means
        // they haven't selected/joined a profile yet. Trap clearly so the
        // frontend can show "Select a business profile" rather than returning
        // empty results silently.
        if (up.profile_key == "") {
          Runtime.trap("No active profile selected. Super Admin must select a profile to manage goals and medical issues.");
        };
        up.profile_key
      };
    }
  };

  // ── Goal Master CRUD ──────────────────────────────────────────────────────

  /// Returns all goal definitions for the caller's profile.
  /// Includes timestamps so the UI can display "Created on" and "Last updated".
  public func listGoals(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : [GoalMedicalTypes.GoalMasterPublic] {
    let profileKey = callerProfileKey(userStore, caller);
    store.entries()
      .filter(func((_id, g) : (Nat, GoalMedicalTypes.GoalMaster)) : Bool { g.profile_key == profileKey })
      .map(func((_id, g) : (Nat, GoalMedicalTypes.GoalMaster)) : GoalMedicalTypes.GoalMasterPublic {
        {
          id = g.id;
          name = g.name;
          description = g.description;
          product_bundle = g.product_bundle;
          creation_date = g.creation_date;
          last_update_date = g.last_update_date;
        }
      })
      .toArray()
  };

  /// Returns a single goal by ID, or null if not found / belongs to a different profile.
  public func getGoal(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
  ) : ?GoalMedicalTypes.GoalMasterPublic {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null null;
      case (?g) {
        if (g.profile_key != profileKey) return null; // belongs to different profile — deny
        ?{
          id = g.id;
          name = g.name;
          description = g.description;
          product_bundle = g.product_bundle;
          creation_date = g.creation_date;
          last_update_date = g.last_update_date;
        }
      };
    }
  };

  /// Creates a new goal and stores it.
  ///
  /// INPUTS:
  ///   store        — the GoalMasterStore where goals are saved
  ///   userStore    — used to auto-derive the caller's profileKey
  ///   caller       — the authenticated user's principal
  ///   nextId       — the ID to assign to the new goal (provided by the mixin counter)
  ///   input        — name, description, and product_bundle from the frontend form
  ///
  /// RETURNS:
  ///   #ok(newId)  — goal was created successfully; caller should increment nextId
  ///   #err(msg)   — a goal with the same name (case-insensitive) already exists
  ///                 in this profile; no record is written
  ///
  /// DUPLICATE CHECK:
  ///   Scans all existing GoalMaster records for the same profile_key.
  ///   Comparison is case-insensitive (both sides lowercased via Text.toLower).
  ///   This prevents "Weight Loss" and "weight loss" from coexisting.
  public func createGoal(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextId : Nat,
    input : GoalMedicalTypes.GoalMasterInput,
  ) : { #ok : Nat; #err : Text } {
    let profileKey = callerProfileKey(userStore, caller);
    // ── Duplicate name check ──────────────────────────────────────────────
    // Look for any existing goal in the same profile with the same name
    // (case-insensitive so "Weight Loss" and "WEIGHT LOSS" are the same).
    let inputNameLower = input.name.toLower();
    let duplicate = store.entries().find(func((_id, g) : (Nat, GoalMedicalTypes.GoalMaster)) : Bool {
      g.profile_key == profileKey and g.name.toLower() == inputNameLower
    });
    switch (duplicate) {
      case (?(_, _)) {
        // A goal with this name already exists — return error without writing
        return #err("A goal with this name already exists in your profile");
      };
      case null {};
    };
    // ── Write the new goal ────────────────────────────────────────────────
    let now = Time.now();
    let goal : GoalMedicalTypes.GoalMaster = {
      id = nextId;
      profile_key = profileKey;
      name = input.name;
      description = input.description;
      product_bundle = input.product_bundle;
      created_by = caller;      // stored as Principal (not Text)
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, goal);
    #ok(nextId) // return the new ID so the mixin can increment its counter
  };

  /// Updates an existing goal's name, description, and product bundle.
  ///
  /// INPUTS:
  ///   store    — the GoalMasterStore
  ///   userStore — used to auto-derive the caller's profileKey
  ///   caller   — the authenticated user's principal
  ///   id       — the ID of the goal to update
  ///   input    — new name, description, and product_bundle from the frontend form
  ///
  /// RETURNS:
  ///   #ok(true)  — goal was updated successfully
  ///   #ok(false) — goal not found or belongs to a different profile (no change made)
  ///   #err(msg)  — a DIFFERENT goal in the same profile already has the same name
  ///                (case-insensitive); no record is written
  ///
  /// DUPLICATE CHECK:
  ///   Same as createGoal but excludes the record being updated (id != input.id).
  ///   This allows updating a goal's description without changing the name.
  public func updateGoal(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
    input : GoalMedicalTypes.GoalMasterInput,
  ) : { #ok : Bool; #err : Text } {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null #ok(false); // goal not found — return false (not an error)
      case (?existing) {
        if (existing.profile_key != profileKey) return #ok(false); // wrong profile — deny
        // ── Duplicate name check (exclude this record) ────────────────────
        // Check if any OTHER goal in the same profile has the same name.
        // We exclude the current record (g.id != id) so a no-name-change update succeeds.
        let inputNameLower = input.name.toLower();
        let duplicate = store.entries().find(func((gId, g) : (Nat, GoalMedicalTypes.GoalMaster)) : Bool {
          gId != id and g.profile_key == profileKey and g.name.toLower() == inputNameLower
        });
        switch (duplicate) {
          case (?(_, _)) {
            // Another goal has the same name — return error without writing
            return #err("A goal with this name already exists in your profile");
          };
          case null {};
        };
        // ── Apply the update ───────────────────────────────────────────────
        store.add(id, {
          existing with
          name = input.name;
          description = input.description;
          product_bundle = input.product_bundle;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        #ok(true)
      };
    }
  };

  /// Permanently removes a goal. Returns false if not found or wrong profile.
  public func deleteGoal(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };

  // ── Medical Issue Master CRUD ─────────────────────────────────────────────

  /// Returns all medical issue definitions for the caller's profile.
  public func listMedicalIssues(
    store : MedicalIssueMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : [GoalMedicalTypes.MedicalIssueMasterPublic] {
    let profileKey = callerProfileKey(userStore, caller);
    store.entries()
      .filter(func((_id, m) : (Nat, GoalMedicalTypes.MedicalIssueMaster)) : Bool { m.profile_key == profileKey })
      .map(func((_id, m) : (Nat, GoalMedicalTypes.MedicalIssueMaster)) : GoalMedicalTypes.MedicalIssueMasterPublic {
        {
          id = m.id;
          name = m.name;
          description = m.description;
          creation_date = m.creation_date;
          last_update_date = m.last_update_date;
        }
      })
      .toArray()
  };

  /// Returns a single medical issue by ID, or null if not found / wrong profile.
  public func getMedicalIssue(
    store : MedicalIssueMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
  ) : ?GoalMedicalTypes.MedicalIssueMasterPublic {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null null;
      case (?m) {
        if (m.profile_key != profileKey) return null;
        ?{
          id = m.id;
          name = m.name;
          description = m.description;
          creation_date = m.creation_date;
          last_update_date = m.last_update_date;
        }
      };
    }
  };

  /// Creates a new medical issue definition and stores it.
  ///
  /// INPUTS:
  ///   store    — the MedicalIssueMasterStore
  ///   userStore — used to auto-derive the caller's profileKey
  ///   caller   — the authenticated user's principal
  ///   nextId   — the ID to assign (provided by the mixin counter)
  ///   input    — name and description from the frontend form
  ///
  /// RETURNS:
  ///   #ok(newId) — issue was created; caller should increment nextId
  ///   #err(msg)  — a medical issue with the same name (case-insensitive) already
  ///                exists in this profile; no record is written
  ///
  /// DUPLICATE CHECK:
  ///   Scans all MedicalIssueMaster records for the same profile_key.
  ///   Comparison is case-insensitive (both sides lowercased).
  public func createMedicalIssue(
    store : MedicalIssueMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextId : Nat,
    input : GoalMedicalTypes.MedicalIssueMasterInput,
  ) : { #ok : Nat; #err : Text } {
    let profileKey = callerProfileKey(userStore, caller);
    // ── Duplicate name check ──────────────────────────────────────────────
    let inputNameLower = input.name.toLower();
    let duplicate = store.entries().find(func((_id, m) : (Nat, GoalMedicalTypes.MedicalIssueMaster)) : Bool {
      m.profile_key == profileKey and m.name.toLower() == inputNameLower
    });
    switch (duplicate) {
      case (?(_, _)) {
        return #err("A medical issue with this name already exists in your profile");
      };
      case null {};
    };
    // ── Write the new medical issue ───────────────────────────────────────
    let now = Time.now();
    let issue : GoalMedicalTypes.MedicalIssueMaster = {
      id = nextId;
      profile_key = profileKey;
      name = input.name;
      description = input.description;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, issue);
    #ok(nextId)
  };

  /// Updates an existing medical issue's name and description.
  ///
  /// INPUTS:
  ///   store    — the MedicalIssueMasterStore
  ///   userStore — used to auto-derive the caller's profileKey
  ///   caller   — the authenticated user's principal
  ///   id       — the ID of the issue to update
  ///   input    — new name and description from the frontend form
  ///
  /// RETURNS:
  ///   #ok(true)  — issue was updated successfully
  ///   #ok(false) — issue not found or belongs to a different profile (no change)
  ///   #err(msg)  — a DIFFERENT issue in the same profile already has the same name
  ///                (case-insensitive); no record is written
  ///
  /// DUPLICATE CHECK:
  ///   Same as createMedicalIssue but excludes the record being updated (id != existing.id).
  public func updateMedicalIssue(
    store : MedicalIssueMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
    input : GoalMedicalTypes.MedicalIssueMasterInput,
  ) : { #ok : Bool; #err : Text } {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null #ok(false);
      case (?existing) {
        if (existing.profile_key != profileKey) return #ok(false);
        // ── Duplicate name check (exclude this record) ────────────────────
        let inputNameLower = input.name.toLower();
        let duplicate = store.entries().find(func((mId, m) : (Nat, GoalMedicalTypes.MedicalIssueMaster)) : Bool {
          mId != id and m.profile_key == profileKey and m.name.toLower() == inputNameLower
        });
        switch (duplicate) {
          case (?(_, _)) {
            return #err("A medical issue with this name already exists in your profile");
          };
          case null {};
        };
        // ── Apply the update ───────────────────────────────────────────────
        store.add(id, {
          existing with
          name = input.name;
          description = input.description;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        #ok(true)
      };
    }
  };

  /// Permanently removes a medical issue. Returns false if not found or wrong profile.
  public func deleteMedicalIssue(
    store : MedicalIssueMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };

  // ── Customer ↔ Goal Assignments ──────────────────────────────────────────
  // These functions link/unlink goal master IDs to/from a customer's
  // primary_goal_ids array. The data lives on the Customer record itself.
  //
  // Flow:
  //   1. Admin creates GoalMaster entries (e.g. "Weight Loss", "Muscle Gain")
  //   2. On the customer detail page, staff assigns goals from that master list
  //   3. addGoalToCustomer() appends the goalId to customer.primary_goal_ids
  //   4. removeGoalFromCustomer() filters it out
  //   5. getCustomerGoals() returns the full GoalMasterPublic objects for the
  //      assigned IDs (not just the IDs) so the UI can display names/descriptions

  /// Assigns a goal from the profile's master list to a customer.
  /// Returns false if the customer is not found, belongs to another profile,
  /// or if the goalId is already assigned (idempotent — no duplicates).
  public func addGoalToCustomer(
    goalStore : GoalMasterStore,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    goalId : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    // Verify the goal exists and belongs to the caller's profile
    switch (goalStore.get(goalId)) {
      case null return false; // goal does not exist
      case (?g) {
        if (g.profile_key != profileKey) return false; // goal belongs to different profile
      };
    };
    // Look up customer and verify it belongs to the same profile
    switch (customerStore.get(customerId)) {
      case null false; // customer not found
      case (?c) {
        if (c.profile_key != profileKey) return false; // wrong profile
        // Check if goalId is already in the list (avoid duplicates)
        let alreadyAssigned = c.primary_goal_ids.find(func(id : Nat) : Bool { id == goalId }) != null;
        if (alreadyAssigned) return true; // idempotent — already there
        // Append the goalId to the customer's primary_goal_ids array
        customerStore.add(customerId, {
          c with
          primary_goal_ids = c.primary_goal_ids.concat([goalId]);
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Removes a goal assignment from a customer's primary_goal_ids array.
  /// Returns false if the customer is not found or belongs to another profile.
  /// Returns true even if the goalId was not assigned (idempotent).
  public func removeGoalFromCustomer(
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    goalId : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (customerStore.get(customerId)) {
      case null false;
      case (?c) {
        if (c.profile_key != profileKey) return false;
        // Filter out the goalId — idempotent if not present
        let updatedGoalIds = c.primary_goal_ids.filter(func(id : Nat) : Bool { id != goalId });
        customerStore.add(customerId, {
          c with
          primary_goal_ids = updatedGoalIds;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Returns the full GoalMasterPublic objects for all goals assigned to a customer.
  /// Resolves the IDs stored in customer.primary_goal_ids against the goalMasterStore.
  /// Goals that no longer exist in the master (e.g. deleted) are silently skipped.
  public func getCustomerGoals(
    goalStore : GoalMasterStore,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
  ) : [GoalMedicalTypes.GoalMasterPublic] {
    let profileKey = callerProfileKey(userStore, caller);
    // Look up the customer to get its primary_goal_ids
    let goalIds = switch (customerStore.get(customerId)) {
      case null return []; // customer not found
      case (?c) {
        if (c.profile_key != profileKey) return []; // wrong profile
        c.primary_goal_ids
      };
    };
    // Resolve each ID to its GoalMasterPublic shape; skip missing entries
    goalIds.filterMap<Nat, GoalMedicalTypes.GoalMasterPublic>(func(id : Nat) : ?GoalMedicalTypes.GoalMasterPublic {
      switch (goalStore.get(id)) {
        case null null; // goal was deleted — skip silently
        case (?g) ?{
          id = g.id;
          name = g.name;
          description = g.description;
          product_bundle = g.product_bundle;
          creation_date = g.creation_date;
          last_update_date = g.last_update_date;
        };
      }
    })
  };

  // ── Customer ↔ Medical Issue Assignments ──────────────────────────────────
  // Same pattern as Goal assignments above, but for the medical_issue_ids array.

  /// Assigns a medical issue from the profile's master list to a customer.
  /// Returns false if the customer or medical issue is not found, or belongs
  /// to another profile. Idempotent — no duplicates inserted.
  public func addMedicalIssueToCustomer(
    issueStore : MedicalIssueMasterStore,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    issueId : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    // Verify the medical issue exists and belongs to the caller's profile
    switch (issueStore.get(issueId)) {
      case null return false;
      case (?m) {
        if (m.profile_key != profileKey) return false;
      };
    };
    switch (customerStore.get(customerId)) {
      case null false;
      case (?c) {
        if (c.profile_key != profileKey) return false;
        // Check if issueId is already assigned (avoid duplicates)
        let alreadyAssigned = c.medical_issue_ids.find(func(id : Nat) : Bool { id == issueId }) != null;
        if (alreadyAssigned) return true;
        customerStore.add(customerId, {
          c with
          medical_issue_ids = c.medical_issue_ids.concat([issueId]);
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Removes a medical issue assignment from a customer's medical_issue_ids array.
  /// Returns false if the customer is not found or belongs to another profile.
  /// Idempotent — returns true even if the issueId was not assigned.
  public func removeMedicalIssueFromCustomer(
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    issueId : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (customerStore.get(customerId)) {
      case null false;
      case (?c) {
        if (c.profile_key != profileKey) return false;
        let updatedIssueIds = c.medical_issue_ids.filter(func(id : Nat) : Bool { id != issueId });
        customerStore.add(customerId, {
          c with
          medical_issue_ids = updatedIssueIds;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Returns the full MedicalIssueMasterPublic objects for all medical issues assigned
  /// to a customer. Resolves IDs stored in customer.medical_issue_ids against the
  /// medicalIssueMasterStore. Issues that no longer exist are silently skipped.
  public func getCustomerMedicalIssues(
    issueStore : MedicalIssueMasterStore,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
  ) : [GoalMedicalTypes.MedicalIssueMasterPublic] {
    let profileKey = callerProfileKey(userStore, caller);
    let issueIds = switch (customerStore.get(customerId)) {
      case null return [];
      case (?c) {
        if (c.profile_key != profileKey) return [];
        c.medical_issue_ids
      };
    };
    issueIds.filterMap<Nat, GoalMedicalTypes.MedicalIssueMasterPublic>(func(id : Nat) : ?GoalMedicalTypes.MedicalIssueMasterPublic {
      switch (issueStore.get(id)) {
        case null null; // issue was deleted — skip silently
        case (?m) ?{
          id = m.id;
          name = m.name;
          description = m.description;
          creation_date = m.creation_date;
          last_update_date = m.last_update_date;
        };
      }
    })
  };

  // ── Body Inches CRUD ──────────────────────────────────────────────────────

  /// Creates a new body inches measurement entry for a customer.
  /// Returns the stored entry (including generated id and creation metadata).
  /// The measurements are optional — pass null for any field not measured.
  public func createBodyInchesEntry(
    store : BodyInchesStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    nextId : Nat,
    input : CustomerTypes.BodyInchesInput,
  ) : CustomerTypes.BodyInchesPublic {
    let profileKey = callerProfileKey(userStore, caller);
    let now = Time.now();
    let entry : CustomerTypes.BodyInchesEntry = {
      id = nextId;
      customer_id = customerId;
      profile_key = profileKey;
      entry_date = input.entry_date;       // date of measurement (from frontend)
      chest = input.chest;                 // chest circumference in inches (optional)
      biceps = input.biceps;               // bicep circumference (optional)
      waist = input.waist;                 // waist circumference (optional)
      hips = input.hips;                   // hip circumference (optional)
      thighs = input.thighs;               // thigh circumference (optional)
      calves = input.calves;               // calf circumference (optional)
      created_by = caller.toText();
      creation_date = now;
    };
    store.add(nextId, entry);
    entry // return the stored entry (satisfies BodyInchesPublic alias)
  };

  /// Returns all body inches entries for a customer, sorted newest-first.
  /// Only returns entries belonging to the caller's profile (data isolation).
  public func listBodyInchesHistory(
    store : BodyInchesStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
  ) : [CustomerTypes.BodyInchesPublic] {
    let profileKey = callerProfileKey(userStore, caller);
    let entries = store.entries()
      .filter(func((_id, e) : (Nat, CustomerTypes.BodyInchesEntry)) : Bool {
        e.profile_key == profileKey and e.customer_id == customerId
      })
      .map(func((_id, e) : (Nat, CustomerTypes.BodyInchesEntry)) : CustomerTypes.BodyInchesEntry { e })
      .toArray();
    // Sort by entry_date descending so the most recent measurement appears first
    entries.sort(func(a, b) {
      if (a.entry_date > b.entry_date) #less
      else if (a.entry_date < b.entry_date) #greater
      else #equal
    })
  };

  /// Permanently removes a body inches entry by ID.
  /// Returns false if not found or entry belongs to a different profile.
  public func deleteBodyInchesEntry(
    store : BodyInchesStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };

  // ── Customer Notes ────────────────────────────────────────────────────────
  // IMPORTANT: Customer notes are NOT stored in customerNoteStore.
  // They are stored as an embedded array on the Customer record itself (Customer.notes).
  // The customerNoteStore is only used to generate unique note IDs via the nextNoteId
  // counter in the mixin. The actual note content lives in CustomersLib.addCustomerNote().
  //
  // To read notes: call getCustomer() — the CustomerPublic.notes array is included.
  // To add a note:   call addCustomerNote()  → delegates to CustomersLib.addCustomerNote()
  // To delete a note: call deleteCustomerNote() → delegates to CustomersLib.deleteCustomerNote()

  /// Adds a structured note to a customer's embedded notes array.
  /// Verifies the customer belongs to the caller's profile before writing.
  /// Returns the updated customer (or null if customer not found / wrong profile).
  ///
  /// NOTE: The actual storage happens in CustomersLib (customer record).
  ///       This function is kept here for module organisation — it delegates to CustomersLib.
  public func addCustomerNote(
    noteStore : CustomerNoteStore,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
    nextNoteId : Nat,
    input : CustomerTypes.CustomerNoteInput,
  ) : CustomerTypes.CustomerNote {
    let profileKey = callerProfileKey(userStore, caller);
    // Verify the customer exists and belongs to the caller's profile
    switch (customerStore.get(customerId)) {
      case null Runtime.trap("Customer not found");
      case (?c) {
        if (c.profile_key != profileKey) Runtime.trap("Customer not in caller's profile");
      };
    };
    let now = Time.now();
    // Build the note record and register it in the noteStore (for ID uniqueness)
    let note : CustomerTypes.CustomerNote = {
      id = nextNoteId;
      text = input.text;
      note_date = input.note_date;
      created_by = caller.toText();
      creation_date = now;
    };
    noteStore.add(nextNoteId, note);
    note
  };

  /// Lists all notes from the dedicated noteStore for a customer.
  /// NOTE: In the main data flow, notes live on the Customer record.
  /// This function performs an auth check and returns an empty array —
  /// the frontend must read notes via getCustomer() which includes CustomerPublic.notes.
  public func listCustomerNotes(
    _noteStore : CustomerNoteStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    _customerId : Common.CustomerId,
  ) : [CustomerTypes.CustomerNote] {
    // Auth check — traps if caller has no profile
    let _ = callerProfileKey(userStore, caller);
    // Notes live on the Customer record — read them via CustomersApi.getCustomer()
    // This function returns [] as a safe fallback for compatibility.
    []
  };

  /// Removes a note from the noteStore registry (does NOT remove from Customer.notes).
  /// The actual removal from the Customer's embedded notes array is handled by
  /// CustomersLib.deleteCustomerNote via the mixin's deleteCustomerNote function.
  public func deleteCustomerNote(
    noteStore : CustomerNoteStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    noteId : Nat,
  ) : Bool {
    let _ = callerProfileKey(userStore, caller); // auth check
    noteStore.remove(noteId);
    true
  };

  // ── Cycles Info (Super Admin only) ────────────────────────────────────────

  /// Returns the canister's current cycle balance and an estimated per-profile
  /// breakdown. Only the Super Admin can call this.
  ///
  /// Because all profiles share one canister, the per-profile estimate is just
  /// total_cycles / number_of_profiles — a fair-share approximation.
  public func getCyclesInfo(
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    profileStore : Map.Map<Common.ProfileKey, ProfileTypes.Profile>,
    caller : Common.UserId,
  ) : GoalMedicalTypes.CyclesInfo {
    // Verify caller is Super Admin
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #superAdmin) Runtime.trap("Super Admin access required");

    let totalCycles = Cycles.balance(); // read live cycle balance from the runtime

    // Count distinct non-empty profile keys from userStore (one per active profile)
    let profileKeys = Map.empty<Text, Bool>();
    for ((_uid, u) in userStore.entries()) {
      if (u.profile_key != "") {
        profileKeys.add(u.profile_key, true);
      };
    };
    let numProfiles = profileKeys.size();

    // Build per-profile entries with fair-share estimate
    let profileEntries = profileStore.entries()
      .map(func((_k, p)) {
        let estimated = if (numProfiles > 0) totalCycles / numProfiles else 0;
        {
          profile_key = p.profile_key;
          business_name = p.business_name;
          estimated_cycles = estimated;
        }
      })
      .toArray();

    { total_cycles = totalCycles; profiles_cycles = profileEntries }
  };
};
