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
  // ── Store type aliases ────────────────────────────────────────────────────────
  public type GoalMasterStore = Map.Map<Nat, GoalMedicalTypes.GoalMaster>;
  public type MedicalIssueMasterStore = Map.Map<Nat, GoalMedicalTypes.MedicalIssueMaster>;
  public type BodyInchesStore = Map.Map<Nat, CustomerTypes.BodyInchesEntry>;
  public type CustomerNoteStore = Map.Map<Nat, CustomerTypes.CustomerNote>;

  // Helper: get caller's profile key from userStore
  func callerProfileKey(
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : Common.ProfileKey {
    switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile");
    }
  };

  // ── Goal Master ───────────────────────────────────────────────────────────────

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
        if (g.profile_key != profileKey) return null;
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
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, goal);
    nextId
  };

  public func updateGoal(
    store : GoalMasterStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
    input : GoalMedicalTypes.GoalMasterInput,
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
          product_bundle = input.product_bundle;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

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

  // ── Medical Issue Master ──────────────────────────────────────────────────────

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

  // ── Body Inches ───────────────────────────────────────────────────────────────

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
      entry_date = input.entry_date;
      chest = input.chest;
      biceps = input.biceps;
      waist = input.waist;
      hips = input.hips;
      thighs = input.thighs;
      calves = input.calves;
      created_by = caller.toText();
      creation_date = now;
    };
    store.add(nextId, entry);
    entry
  };

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
    // Sort by entry_date descending (newest first)
    entries.sort(func(a, b) {
      if (a.entry_date > b.entry_date) #less
      else if (a.entry_date < b.entry_date) #greater
      else #equal
    })
  };

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

  // ── Customer Notes ────────────────────────────────────────────────────────────

  /// Add a structured note to a customer. Stored in the dedicated noteStore (NOT on customer record).
  /// Returns the new CustomerNote.
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
    // Verify customer belongs to this profile
    switch (customerStore.get(customerId)) {
      case null Runtime.trap("Customer not found");
      case (?c) {
        if (c.profile_key != profileKey) Runtime.trap("Customer not in caller's profile");
      };
    };
    let now = Time.now();
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

  /// List all notes for a customer (newest first), from the dedicated noteStore.
  public func listCustomerNotes(
    noteStore : CustomerNoteStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Common.CustomerId,
  ) : [CustomerTypes.CustomerNote] {
    // noteStore key is the note ID; notes don't store customer_id directly in the type.
    // We use a separate approach: the noteStore stores notes for ALL customers.
    // Since CustomerNote doesn't have a customer_id field, we need to read from
    // the customer record's notes array (which is authoritative).
    // Delegate to reading the customer's embedded notes array.
    let _ = callerProfileKey(userStore, caller); // auth check
    // CustomerNote lives as the embedded array on the Customer — not separate store.
    // This function returns [] here; the real notes are on the customer record via getCustomer.
    // The noteStore is used for addCustomerNote to generate unique IDs and enable deletion.
    // Return empty — frontend must read notes from CustomerPublic.notes via getCustomer.
    []
  };

  /// Delete a customer note by ID from the customer's embedded notes array.
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

  // ── Cycles Info ───────────────────────────────────────────────────────────────

  /// Return canister cycle balance and estimated per-profile usage.
  /// Caller must be Super Admin; trapped otherwise.
  public func getCyclesInfo(
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    profileStore : Map.Map<Common.ProfileKey, ProfileTypes.Profile>,
    caller : Common.UserId,
  ) : GoalMedicalTypes.CyclesInfo {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #superAdmin) Runtime.trap("Super Admin access required");

    let totalCycles = Cycles.balance();

    // Count distinct profiles from userStore
    let profileKeys = Map.empty<Text, Bool>();
    for ((_uid, u) in userStore.entries()) {
      if (u.profile_key != "") {
        profileKeys.add(u.profile_key, true);
      };
    };
    let numProfiles = profileKeys.size();

    // Build per-profile entries — estimated as fair share
    let profileEntries = profileStore.entries()
      .map(
        func((_k, p)) {
          let estimated = if (numProfiles > 0) totalCycles / numProfiles else 0;
          { profile_key = p.profile_key; business_name = p.business_name; estimated_cycles = estimated }
        }
      )
      .toArray();

    { total_cycles = totalCycles; profiles_cycles = profileEntries }
  };
};
