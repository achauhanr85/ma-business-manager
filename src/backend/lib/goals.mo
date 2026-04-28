import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import GoalTypes "../types/goals";
import CustomerTypes "../types/customers";
import UserTypes "../types/users";

module {
  public type GoalStore = Map.Map<Nat, GoalTypes.GoalMaster>;
  public type MedicalIssueStore = Map.Map<Nat, GoalTypes.MedicalIssueMaster>;
  public type BodyInchesStore = Map.Map<Nat, CustomerTypes.BodyInchesEntry>;

  // ── Goal Master ───────────────────────────────────────────────────────────────

  public func getGoalMasterData(store : GoalStore, profileKey : Common.ProfileKey) : [GoalTypes.GoalMasterPublic] {
    store.entries()
      .filter(func((_id, g) : (Nat, GoalTypes.GoalMaster)) : Bool { g.profile_key == profileKey })
      .map(func((_id, g) : (Nat, GoalTypes.GoalMaster)) : GoalTypes.GoalMasterPublic {
        { id = g.id; name = g.name; description = g.description; product_bundle = g.product_bundle }
      })
      .toArray()
  };

  public func createGoalMaster(
    store : GoalStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
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
      product_bundle = [];
      created_by = callerText;
      last_updated_by = callerText;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, goal);
    { id = nextId; name; description; product_bundle = [] }
  };

  public func updateGoalMaster(
    store : GoalStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
    name : Text,
    description : Text,
    productBundle : [Common.ProductId],
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
          product_bundle = productBundle;
          last_updated_by = caller.toText();
          last_update_date = Time.now();
        });
        true
      };
    }
  };

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

  // ── Medical Issue Master ──────────────────────────────────────────────────────

  public func getMedicalIssueMasterData(store : MedicalIssueStore, profileKey : Common.ProfileKey) : [GoalTypes.MedicalIssueMasterPublic] {
    store.entries()
      .filter(func((_id, m) : (Nat, GoalTypes.MedicalIssueMaster)) : Bool { m.profile_key == profileKey })
      .map(func((_id, m) : (Nat, GoalTypes.MedicalIssueMaster)) : GoalTypes.MedicalIssueMasterPublic {
        { id = m.id; name = m.name; description = m.description }
      })
      .toArray()
  };

  public func createMedicalIssueMaster(
    store : MedicalIssueStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
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

  // ── Body Inches ───────────────────────────────────────────────────────────────

  public func getBodyInchesHistory(
    store : BodyInchesStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
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

  public func createBodyInchesEntry(
    store : BodyInchesStore,
    _userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
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
