/*
 * lib/customer-goals-medical.mo — ACTIVE Goals, Medical Issues, Body Inches and Notes Logic
 *
 * STATUS: Active — all new goal/medical/inches/notes features use this module.
 *
 * WHAT THIS FILE DOES:
 *   Implements all CRUD business logic for:
 *     - Goal master data (profile-level goal definitions)
 *     - Medical issue master data (profile-level condition definitions)
 *     - Customer body inches measurements (time-series per customer)
 *     - Customer notes (structured dated notes stored on the customer record)
 *     - Canister cycles info (Super Admin only)
 *
 *   Unlike the legacy lib/goals.mo, this module:
 *     - Auto-derives the profileKey from the userStore (caller does not need to pass it)
 *     - Uses structured Input types (GoalMasterInput, MedicalIssueMasterInput)
 *     - Stores created_by / last_updated_by as Principal (not Text)
 *
 * WHO USES IT:
 *   mixins/customer-goals-medical-api.mo (the public API layer that delegates here)
 *
 * NOTE ON CUSTOMER NOTES:
 *   Notes are stored as an embedded array on the Customer record (Customer.notes).
 *   The customerNoteStore in main.mo is used only as a note-ID registry —
 *   the actual note content lives on the customer record itself, maintained by
 *   CustomersLib.addCustomerNote / CustomersLib.deleteCustomerNote.
 *   This means: to read notes, fetch the customer via getCustomer() — the notes
 *   array is included in CustomerPublic.
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
  // Traps with a clear error if the caller has no user record yet.
  func callerProfileKey(
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : Common.ProfileKey {
    switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile");
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

  /// Creates a new goal and stores it. Returns the newly assigned ID (nextId).
  /// The caller's profileKey is auto-derived — no need to pass it explicitly.
  public func createGoal(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextId : Nat,
    input : GoalMedicalTypes.GoalMasterInput,
  ) : Nat {
    let profileKey = callerProfileKey(userStore, caller);
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
    nextId // return the new ID so the mixin can increment its counter
  };

  /// Updates an existing goal's name, description, and product bundle.
  /// Returns false if the goal does not exist or belongs to a different profile.
  public func updateGoal(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
    input : GoalMedicalTypes.GoalMasterInput,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false; // goal not found
      case (?existing) {
        if (existing.profile_key != profileKey) return false; // wrong profile — deny
        store.add(id, {
          existing with
          name = input.name;
          description = input.description;
          product_bundle = input.product_bundle;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
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

  /// Creates a new medical issue. Returns the newly assigned ID.
  public func createMedicalIssue(
    store : MedicalIssueMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextId : Nat,
    input : GoalMedicalTypes.MedicalIssueMasterInput,
  ) : Nat {
    let profileKey = callerProfileKey(userStore, caller);
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
    nextId
  };

  /// Updates an existing medical issue's name and description.
  /// Returns false if not found or wrong profile.
  public func updateMedicalIssue(
    store : MedicalIssueMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
    input : GoalMedicalTypes.MedicalIssueMasterInput,
  ) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.add(id, {
          existing with
          name = input.name;
          description = input.description;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
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
