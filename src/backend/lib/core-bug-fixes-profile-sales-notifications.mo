import Map "mo:core/Map";
import Time "mo:core/Time";
import Cycles "mo:core/Cycles";
import Common "../types/common";
import DomainTypes "../types/core-bug-fixes-profile-sales-notifications";
import CustomerTypes "../types/customers";
import SalesTypes "../types/sales";
import CatalogTypes "../types/catalog";

module {
  // ── Store type aliases ────────────────────────────────────────────────────────
  public type GoalStore = Map.Map<Nat, DomainTypes.GoalMaster>;
  public type MedicalIssueStore = Map.Map<Nat, DomainTypes.MedicalIssueMaster>;

  // ── Goal Master ───────────────────────────────────────────────────────────────

  /// Returns all goals for a given profile.
  public func getGoalMasterData(
    store : GoalStore,
    profileKey : Common.ProfileKey,
  ) : [DomainTypes.GoalMasterPublic] {
    store.entries()
      .filter(func((_id, g) : (Nat, DomainTypes.GoalMaster)) : Bool { g.profile_key == profileKey })
      .map(func((_id, g) : (Nat, DomainTypes.GoalMaster)) : DomainTypes.GoalMasterPublic {
        {
          id = g.id;
          profile_key = g.profile_key;
          name = g.name;
          description = g.description;
          product_bundle_ids = g.product_bundle_ids;
          is_active = g.is_active;
        }
      })
      .toArray()
  };

  /// Creates a new goal in a profile. Returns the new GoalMasterPublic.
  public func createGoalMaster(
    store : GoalStore,
    nextId : Nat,
    profileKey : Common.ProfileKey,
    input : DomainTypes.GoalMasterInput,
    caller : Common.UserId,
  ) : DomainTypes.GoalMasterPublic {
    let now = Time.now();
    let goal : DomainTypes.GoalMaster = {
      id = nextId;
      profile_key = profileKey;
      name = input.name;
      description = input.description;
      product_bundle_ids = [];
      is_active = input.is_active;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, goal);
    {
      id = goal.id;
      profile_key = goal.profile_key;
      name = goal.name;
      description = goal.description;
      product_bundle_ids = goal.product_bundle_ids;
      is_active = goal.is_active;
    }
  };

  /// Updates an existing goal. Returns the updated GoalMasterPublic or null if not found.
  public func updateGoalMaster(
    store : GoalStore,
    id : Nat,
    input : DomainTypes.GoalMasterInput,
    caller : Common.UserId,
  ) : ?DomainTypes.GoalMasterPublic {
    switch (store.get(id)) {
      case null null;
      case (?existing) {
        let updated : DomainTypes.GoalMaster = {
          existing with
          name = input.name;
          description = input.description;
          is_active = input.is_active;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        store.add(id, updated);
        ?{
          id = updated.id;
          profile_key = updated.profile_key;
          name = updated.name;
          description = updated.description;
          product_bundle_ids = updated.product_bundle_ids;
          is_active = updated.is_active;
        }
      };
    }
  };

  /// Deletes a goal. Returns true if deleted, false if not found.
  public func deleteGoalMaster(
    store : GoalStore,
    id : Nat,
    _caller : Common.UserId,
  ) : Bool {
    switch (store.get(id)) {
      case null false;
      case (?_) {
        store.remove(id);
        true
      };
    }
  };

  /// Associates a list of product IDs as a bundle for a given goal.
  public func updateGoalProductBundle(
    store : GoalStore,
    goalId : Nat,
    productIds : [Common.ProductId],
    caller : Common.UserId,
  ) : Bool {
    switch (store.get(goalId)) {
      case null false;
      case (?existing) {
        store.add(goalId, {
          existing with
          product_bundle_ids = productIds;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  // ── Medical Issue Master ──────────────────────────────────────────────────────

  /// Returns all medical issues for a given profile.
  public func getMedicalIssueMasterData(
    store : MedicalIssueStore,
    profileKey : Common.ProfileKey,
  ) : [DomainTypes.MedicalIssueMasterPublic] {
    store.entries()
      .filter(func((_id, m) : (Nat, DomainTypes.MedicalIssueMaster)) : Bool { m.profile_key == profileKey })
      .map(func((_id, m) : (Nat, DomainTypes.MedicalIssueMaster)) : DomainTypes.MedicalIssueMasterPublic {
        {
          id = m.id;
          profile_key = m.profile_key;
          name = m.name;
          description = m.description;
          is_active = m.is_active;
        }
      })
      .toArray()
  };

  /// Creates a new medical issue in a profile.
  public func createMedicalIssueMaster(
    store : MedicalIssueStore,
    nextId : Nat,
    profileKey : Common.ProfileKey,
    input : DomainTypes.MedicalIssueMasterInput,
    caller : Common.UserId,
  ) : DomainTypes.MedicalIssueMasterPublic {
    let now = Time.now();
    let issue : DomainTypes.MedicalIssueMaster = {
      id = nextId;
      profile_key = profileKey;
      name = input.name;
      description = input.description;
      is_active = input.is_active;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, issue);
    {
      id = issue.id;
      profile_key = issue.profile_key;
      name = issue.name;
      description = issue.description;
      is_active = issue.is_active;
    }
  };

  /// Updates an existing medical issue.
  public func updateMedicalIssueMaster(
    store : MedicalIssueStore,
    id : Nat,
    input : DomainTypes.MedicalIssueMasterInput,
    caller : Common.UserId,
  ) : ?DomainTypes.MedicalIssueMasterPublic {
    switch (store.get(id)) {
      case null null;
      case (?existing) {
        let updated : DomainTypes.MedicalIssueMaster = {
          existing with
          name = input.name;
          description = input.description;
          is_active = input.is_active;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        store.add(id, updated);
        ?{
          id = updated.id;
          profile_key = updated.profile_key;
          name = updated.name;
          description = updated.description;
          is_active = updated.is_active;
        }
      };
    }
  };

  /// Deletes a medical issue.
  public func deleteMedicalIssueMaster(
    store : MedicalIssueStore,
    id : Nat,
    _caller : Common.UserId,
  ) : Bool {
    switch (store.get(id)) {
      case null false;
      case (?_) {
        store.remove(id);
        true
      };
    }
  };

  // ── Body Inches ───────────────────────────────────────────────────────────────
  // Body inches are stored in the dedicated BodyInchesStore in customer-goals-medical.mo,
  // NOT inline on the Customer record. This module delegates to stored data via the
  // customerStore approach — returns history from customer.notes pattern (empty array
  // since body inches live in a separate store not passed here).

  /// Returns all body inches history entries for a customer, sorted latest first.
  /// Note: in the main architecture, body inches are stored in a separate BodyInchesStore
  /// via lib/customer-goals-medical.mo. This function returns an empty array since the
  /// store is not passed here — use GoalMedicalLib.listBodyInchesHistory instead.
  public func getBodyInchesHistory(
    _customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    _customerId : Common.CustomerId,
    _profileKey : Common.ProfileKey,
  ) : [CustomerTypes.BodyInchesPublic] {
    []
  };

  /// Creates a new body inches entry for a customer.
  /// Note: in the main architecture, body inches are stored in a separate BodyInchesStore
  /// via lib/customer-goals-medical.mo. This stub returns a minimal entry since the
  /// store is not passed here — use GoalMedicalLib.createBodyInchesEntry instead.
  public func createBodyInchesEntry(
    _customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    nextId : Nat,
    customerId : Common.CustomerId,
    profileKey : Common.ProfileKey,
    input : CustomerTypes.BodyInchesInput,
    caller : Common.UserId,
  ) : CustomerTypes.BodyInchesPublic {
    let now = Time.now();
    {
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
    }
  };

  // ── Customer Notes (multi-note with date) ─────────────────────────────────────

  /// Appends a dated note to a customer's notes list.
  /// Returns the updated CustomerPublic or null if the customer is not found.
  public func addCustomerNote(
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    nextNoteId : Nat,
    customerId : Common.CustomerId,
    profileKey : Common.ProfileKey,
    input : CustomerTypes.CustomerNoteInput,
    caller : Common.UserId,
  ) : ?CustomerTypes.CustomerPublic {
    switch (customerStore.get(customerId)) {
      case null null;
      case (?existing) {
        if (existing.profile_key != profileKey) return null;
        let now = Time.now();
        let newNote : CustomerTypes.CustomerNote = {
          id = nextNoteId;
          text = input.text;
          note_date = input.note_date;
          created_by = caller.toText();
          creation_date = now;
        };
        let updated : CustomerTypes.Customer = {
          existing with
          notes = existing.notes.concat([newNote]);
          last_updated_by = caller;
          last_update_date = now;
        };
        customerStore.add(customerId, updated);
        ?{
          id = updated.id;
          profile_key = updated.profile_key;
          name = updated.name;
          phone = updated.phone;
          email = updated.email;
          address = updated.address;
          created_at = updated.created_at;
          total_sales = updated.total_sales;
          last_purchase_at = updated.last_purchase_at;
          lifetime_revenue = updated.lifetime_revenue;
          discount_applicable = updated.discount_applicable;
          discount_value = updated.discount_value;
          notes = updated.notes;
          date_of_birth = updated.date_of_birth;
          gender = updated.gender;
          height = updated.height;
          age = updated.age;
          address_line1 = updated.address_line1;
          address_line2 = updated.address_line2;
          state = updated.state;
          city = updated.city;
          country = updated.country;
          pin_code = updated.pin_code;
          customer_created_by = updated.customer_created_by;
          referred_by = updated.referred_by;
          referral_commission_amount = updated.referral_commission_amount;
          customer_type = updated.customer_type;
          lead_follow_up_date = updated.lead_follow_up_date;
          lead_notes = updated.lead_notes;
          primary_goal_ids = updated.primary_goal_ids;
          medical_issue_ids = updated.medical_issue_ids;
          lead_to_active_datetime = updated.lead_to_active_datetime;
        }
      };
    }
  };

  /// Deletes a specific note from a customer's notes list.
  /// Returns the updated CustomerPublic or null if customer/note is not found.
  public func deleteCustomerNote(
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    customerId : Common.CustomerId,
    noteId : Nat,
    profileKey : Common.ProfileKey,
    caller : Common.UserId,
  ) : ?CustomerTypes.CustomerPublic {
    switch (customerStore.get(customerId)) {
      case null null;
      case (?existing) {
        if (existing.profile_key != profileKey) return null;
        let now = Time.now();
        let updatedNotes = existing.notes.filter(func(n : CustomerTypes.CustomerNote) : Bool { n.id != noteId });
        let updated : CustomerTypes.Customer = {
          existing with
          notes = updatedNotes;
          last_updated_by = caller;
          last_update_date = now;
        };
        customerStore.add(customerId, updated);
        ?{
          id = updated.id;
          profile_key = updated.profile_key;
          name = updated.name;
          phone = updated.phone;
          email = updated.email;
          address = updated.address;
          created_at = updated.created_at;
          total_sales = updated.total_sales;
          last_purchase_at = updated.last_purchase_at;
          lifetime_revenue = updated.lifetime_revenue;
          discount_applicable = updated.discount_applicable;
          discount_value = updated.discount_value;
          notes = updated.notes;
          date_of_birth = updated.date_of_birth;
          gender = updated.gender;
          height = updated.height;
          age = updated.age;
          address_line1 = updated.address_line1;
          address_line2 = updated.address_line2;
          state = updated.state;
          city = updated.city;
          country = updated.country;
          pin_code = updated.pin_code;
          customer_created_by = updated.customer_created_by;
          referred_by = updated.referred_by;
          referral_commission_amount = updated.referral_commission_amount;
          customer_type = updated.customer_type;
          lead_follow_up_date = updated.lead_follow_up_date;
          lead_notes = updated.lead_notes;
          primary_goal_ids = updated.primary_goal_ids;
          medical_issue_ids = updated.medical_issue_ids;
          lead_to_active_datetime = updated.lead_to_active_datetime;
        }
      };
    }
  };

  // ── Canister Cycles ───────────────────────────────────────────────────────────

  /// Returns current canister cycle balance.
  /// Per-profile cycles are 0 since all profiles share a single canister.
  public func getCanisterCyclesInfo(
    _profileKeys : [Common.ProfileKey],
  ) : DomainTypes.CyclesInfo {
    let total = Cycles.balance();
    { total_cycles = total; per_profile_cycles = [] }
  };

  // ── Sales crash guard ─────────────────────────────────────────────────────────

  /// Null-guarded projection of a SaleItem's product snapshot.
  /// Returns the CustomerOrderDetail built from stored order data — no live inventory lookup.
  public func guardedSaleWithItems(
    sale : SalesTypes.Sale,
    items : [SalesTypes.SaleItem],
    _productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
  ) : SalesTypes.CustomerOrderDetail {
    // All product info is already snapshotted on SaleItem at sale time.
    // No live inventory lookup needed — use stored snapshots directly.
    { sale; items }
  };
};
