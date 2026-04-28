/*
 * lib/goals.mo — LEGACY Goal, Medical Issue and Body Inches Logic
 *
 * STATUS: *** DEPRECATED — DO NOT USE FOR NEW FEATURES ***
 *
 * WHAT THIS FILE DOES:
 *   Implements the OLD CRUD logic for goals, medical issues, and body inches.
 *   Unlike the active system (lib/customer-goals-medical.mo), this module requires
 *   the caller to explicitly pass a profileKey — the active system derives it
 *   automatically from the userStore lookup.
 *
 * WHO USES IT:
 *   mixins/goals-api.mo (LEGACY mixin, still included in main.mo)
 *
 * WHY IT IS DEPRECATED:
 *   The active system (lib/customer-goals-medical.mo + mixins/customer-goals-medical-api.mo)
 *   was built to fix the "Goals page has no buttons" and "no data loads" bugs.
 *   The active system:
 *     - Auto-derives profileKey from the userStore (no need for callers to pass it)
 *     - Uses structured Input types (GoalMasterInput) instead of individual parameters
 *     - Stores timestamps in the public response so the UI can show creation dates
 *     - Stores created_by as Principal (not Text)
 *
 * WHY WE KEEP THIS FILE:
 *   The legacy mixin (goals-api.mo) is still included in main.mo so its public
 *   function names (getGoalMasterData, createGoalMaster, etc.) remain callable.
 *   The frontend may still have references to these names. Removing them would
 *   require a frontend update.
 *
 * SAFE TO REMOVE WHEN:
 *   All frontend pages have been confirmed to call only the active API functions
 *   (listGoals, createGoal, updateGoal, deleteGoal, listMedicalIssues, etc.)
 *   and the legacy goal/medical stores in main.mo are confirmed empty.
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import GoalTypes "../types/goals";
import CustomerTypes "../types/customers";
import UserTypes "../types/users";

module {

  // ── Store type aliases ────────────────────────────────────────────────────
  // These three stores back the legacy data. They are declared in main.mo
  // (goalStore, medicalIssueStore, bodyInchesStore) and passed into GoalsApi.
  // The active system uses separate stores (goalMasterStore, etc.) via GoalMedicalLib.
  public type GoalStore = Map.Map<Nat, GoalTypes.GoalMaster>;
  public type MedicalIssueStore = Map.Map<Nat, GoalTypes.MedicalIssueMaster>;
  public type BodyInchesStore = Map.Map<Nat, CustomerTypes.BodyInchesEntry>;

  // ── Goal Master (legacy) ──────────────────────────────────────────────────

  /// Returns all goals for a given profile as public (stripped) records.
  /// NOTE: profileKey must be passed explicitly by the caller — unlike the active system.
  public func getGoalMasterData(store : GoalStore, profileKey : Common.ProfileKey) : [GoalTypes.GoalMasterPublic] {
    store.entries()
      .filter(func((_id, g) : (Nat, GoalTypes.GoalMaster)) : Bool { g.profile_key == profileKey })
      .map(func((_id, g) : (Nat, GoalTypes.GoalMaster)) : GoalTypes.GoalMasterPublic {
        { id = g.id; name = g.name; description = g.description; product_bundle = g.product_bundle }
      })
      .toArray()
  };

  /// Creates a new goal in the legacy store. Returns the public projection.
  /// NOTE: product_bundle starts empty — use updateGoalMaster to assign products.
  public func createGoalMaster(
    store : GoalStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, // unused but kept for API compat
    caller : Common.UserId,
    nextId : Nat,
    profileKey : Common.ProfileKey,
    name : Text,
    description : Text,
  ) : GoalTypes.GoalMasterPublic {
    let callerText = caller.toText();
    let now = Time.now();
    let goal : GoalTypes.GoalMaster = {
      id = nextId;
      profile_key = profileKey;
      name;
      description;
      product_bundle = []; // empty on creation; update separately
      created_by = callerText;
      last_updated_by = callerText;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, goal);
    { id = nextId; name; description; product_bundle = [] }
  };

  /// Updates name, description, and product_bundle for an existing goal.
  /// Returns false if the goal does not exist or belongs to a different profile.
  public func updateGoalMaster(
    store : GoalStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, // unused but kept for API compat
    caller : Common.UserId,
    id : Nat,
    name : Text,
    description : Text,
    productBundle : [Common.ProductId],
    profileKey : Common.ProfileKey,
  ) : Bool {
    switch (store.get(id)) {
      case null false; // goal not found
      case (?existing) {
        if (existing.profile_key != profileKey) return false; // wrong profile
        store.add(id, {
          existing with
          name;
          description;
          product_bundle = productBundle;
          last_updated_by = caller.toText();
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Permanently removes a goal. Returns false if not found or wrong profile.
  public func deleteGoalMaster(
    store : GoalStore,
    id : Nat,
    profileKey : Common.ProfileKey,
  ) : Bool {
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };

  // ── Medical Issue Master (legacy) ─────────────────────────────────────────

  /// Returns all medical issues for a given profile as public (stripped) records.
  public func getMedicalIssueMasterData(store : MedicalIssueStore, profileKey : Common.ProfileKey) : [GoalTypes.MedicalIssueMasterPublic] {
    store.entries()
      .filter(func((_id, m) : (Nat, GoalTypes.MedicalIssueMaster)) : Bool { m.profile_key == profileKey })
      .map(func((_id, m) : (Nat, GoalTypes.MedicalIssueMaster)) : GoalTypes.MedicalIssueMasterPublic {
        { id = m.id; name = m.name; description = m.description }
      })
      .toArray()
  };

  /// Creates a new medical issue in the legacy store.
  public func createMedicalIssueMaster(
    store : MedicalIssueStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, // unused but kept for API compat
    caller : Common.UserId,
    nextId : Nat,
    profileKey : Common.ProfileKey,
    name : Text,
    description : Text,
  ) : GoalTypes.MedicalIssueMasterPublic {
    let callerText = caller.toText();
    let now = Time.now();
    let issue : GoalTypes.MedicalIssueMaster = {
      id = nextId;
      profile_key = profileKey;
      name;
      description;
      created_by = callerText;
      last_updated_by = callerText;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, issue);
    { id = nextId; name; description }
  };

  /// Updates an existing medical issue. Returns false if not found or wrong profile.
  public func updateMedicalIssueMaster(
    store : MedicalIssueStore,
    caller : Common.UserId,
    id : Nat,
    name : Text,
    description : Text,
    profileKey : Common.ProfileKey,
  ) : Bool {
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.add(id, {
          existing with
          name;
          description;
          last_updated_by = caller.toText();
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Permanently removes a medical issue. Returns false if not found or wrong profile.
  public func deleteMedicalIssueMaster(
    store : MedicalIssueStore,
    id : Nat,
    profileKey : Common.ProfileKey,
  ) : Bool {
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };

  // ── Body Inches (legacy path) ─────────────────────────────────────────────
  // The active body inches system is in lib/customer-goals-medical.mo and uses
  // bodyInchesStore2 (a separate store). The functions below back the legacy
  // BodyInchesStore (bodyInchesStore) passed to GoalsApi.

  /// Returns body inches history for a customer in this profile, sorted newest first.
  public func getBodyInchesHistory(
    store : BodyInchesStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, // unused in legacy path
    _caller : Common.UserId,
    customerId : Nat,
    profileKey : Common.ProfileKey,
  ) : [CustomerTypes.BodyInchesEntry] {
    let entries = store.entries()
      .filter(func((_id, e) : (Nat, CustomerTypes.BodyInchesEntry)) : Bool {
        e.profile_key == profileKey and e.customer_id == customerId
      })
      .map(func((_id, e) : (Nat, CustomerTypes.BodyInchesEntry)) : CustomerTypes.BodyInchesEntry { e })
      .toArray();
    // Sort by entry_date descending (newest first)
    entries.sort(func(a, b) {
      if (a.entry_date > b.entry_date) #less
      else if (a.entry_date < b.entry_date) #greater
      else #equal
    })
  };

  /// Creates a new body inches entry in the legacy store.
  public func createBodyInchesEntry(
    store : BodyInchesStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, // unused in legacy path
    caller : Common.UserId,
    nextId : Nat,
    customerId : Nat,
    profileKey : Common.ProfileKey,
    entryDate : Common.Timestamp,
    chest : ?Float,
    biceps : ?Float,
    waist : ?Float,
    hips : ?Float,
    thighs : ?Float,
    calves : ?Float,
  ) : CustomerTypes.BodyInchesEntry {
    let now = Time.now();
    let entry : CustomerTypes.BodyInchesEntry = {
      id = nextId;
      customer_id = customerId;
      profile_key = profileKey;
      entry_date = entryDate;
      chest;
      biceps;
      waist;
      hips;
      thighs;
      calves;
      created_by = caller.toText();
      creation_date = now;
    };
    store.add(nextId, entry);
    entry
  };
};
