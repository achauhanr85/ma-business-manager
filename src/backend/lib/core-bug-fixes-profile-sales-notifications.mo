/*
 * lib/core-bug-fixes-profile-sales-notifications.mo — ARCHIVED Implementation
 *
 * STATUS: *** ARCHIVED — Functions here are NOT wired into main.mo ***
 *
 * WHAT THIS FILE DID:
 *   This module was created during a targeted bug-fix build to provide:
 *     1. An alternative Goal/MedicalIssue CRUD implementation (with is_active flag)
 *     2. Stub/reference body-inches functions (returning empty/minimal results)
 *     3. A customer-note add/delete implementation (now superseded by CustomersLib)
 *     4. A getCanisterCyclesInfo stub (superseded by GoalMedicalLib.getCyclesInfo)
 *     5. A guardedSaleWithItems helper (superseded by the live sales query guards in SalesLib)
 *
 * WHY IT IS ARCHIVED:
 *   None of these functions are imported or called from any active mixin or main.mo.
 *   The active implementations live in:
 *     - lib/customer-goals-medical.mo   (goals, medical, body inches, notes, cycles)
 *     - lib/customers.mo               (addCustomerNote, deleteCustomerNote)
 *     - lib/sales.mo                   (getSaleWithItems — null-safe internally)
 *
 * WHY WE KEEP THIS FILE:
 *   It is not imported anywhere currently but is retained to avoid regressions from
 *   accidental re-imports. The file compiles cleanly and does not affect runtime.
 *   The comment block at the top clearly marks it as archived.
 *
 * SAFE TO DELETE WHEN:
 *   This file has had zero imports for two consecutive builds and all team members
 *   have confirmed no frontend or backend module references it.
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Cycles "mo:core/Cycles";
import Common "../types/common";
// Imports types from the archived type file (same status — see types/core-bug-fixes...)
import DomainTypes "../types/core-bug-fixes-profile-sales-notifications";
import CustomerTypes "../types/customers";
import SalesTypes "../types/sales";
import CatalogTypes "../types/catalog";

module {

  // ── Store type aliases (archived) ─────────────────────────────────────────
  // These store types use the archived DomainTypes (with is_active flag).
  // They are NOT used by any active mixin or main.mo.
  public type GoalStore = Map.Map<Nat, DomainTypes.GoalMaster>;
  public type MedicalIssueStore = Map.Map<Nat, DomainTypes.MedicalIssueMaster>;

  // ── Archived: Goal Master ─────────────────────────────────────────────────

  /// ARCHIVED — Returns all goals for a profile.
  /// Active replacement: GoalMedicalLib.listGoals (lib/customer-goals-medical.mo)
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

  /// ARCHIVED — Creates a new goal.
  /// Active replacement: GoalMedicalLib.createGoal (lib/customer-goals-medical.mo)
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
      product_bundle_ids = [];    // starts empty — product bundle assigned separately
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

  /// ARCHIVED — Updates an existing goal.
  /// Active replacement: GoalMedicalLib.updateGoal
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

  /// ARCHIVED — Deletes a goal.
  /// Active replacement: GoalMedicalLib.deleteGoal
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

  /// ARCHIVED — Associates product IDs as a bundle for a goal.
  /// Active replacement: GoalMedicalLib.updateGoal with input.product_bundle
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

  // ── Archived: Medical Issue Master ────────────────────────────────────────

  /// ARCHIVED — Returns all medical issues for a profile.
  /// Active replacement: GoalMedicalLib.listMedicalIssues
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

  /// ARCHIVED — Creates a new medical issue.
  /// Active replacement: GoalMedicalLib.createMedicalIssue
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

  /// ARCHIVED — Updates an existing medical issue.
  /// Active replacement: GoalMedicalLib.updateMedicalIssue
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

  /// ARCHIVED — Deletes a medical issue.
  /// Active replacement: GoalMedicalLib.deleteMedicalIssue
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

  // ── Archived: Body Inches (stub) ──────────────────────────────────────────
  // These functions are stubs that do not have access to the BodyInchesStore.
  // The actual implementation lives in lib/customer-goals-medical.mo.

  /// ARCHIVED STUB — returns empty array (no BodyInchesStore available here).
  /// Active replacement: GoalMedicalLib.listBodyInchesHistory
  public func getBodyInchesHistory(
    _customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    _customerId : Common.CustomerId,
    _profileKey : Common.ProfileKey,
  ) : [CustomerTypes.BodyInchesPublic] {
    [] // stub — body inches live in a separate BodyInchesStore not passed here
  };

  /// ARCHIVED STUB — builds and returns a minimal entry but does NOT persist it.
  /// Active replacement: GoalMedicalLib.createBodyInchesEntry
  public func createBodyInchesEntry(
    _customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    nextId : Nat,
    customerId : Common.CustomerId,
    profileKey : Common.ProfileKey,
    input : CustomerTypes.BodyInchesInput,
    caller : Common.UserId,
  ) : CustomerTypes.BodyInchesPublic {
    let now = Time.now();
    // Minimal in-memory construction — NOT stored anywhere in this archived path
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

  // ── Archived: Customer Notes ──────────────────────────────────────────────
  // Active replacement: CustomersLib.addCustomerNote / CustomersLib.deleteCustomerNote

  /// ARCHIVED — Appends a dated note to a customer's notes list.
  /// Active replacement: CustomersLib.addCustomerNote (lib/customers.mo)
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

  /// ARCHIVED — Removes a note from a customer's notes list.
  /// Active replacement: CustomersLib.deleteCustomerNote (lib/customers.mo)
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

  // ── Archived: Canister Cycles ─────────────────────────────────────────────

  /// ARCHIVED — Returns current canister cycle balance (per-profile always 0).
  /// Active replacement: GoalMedicalLib.getCyclesInfo (lib/customer-goals-medical.mo)
  public func getCanisterCyclesInfo(
    _profileKeys : [Common.ProfileKey],
  ) : DomainTypes.CyclesInfo {
    let total = Cycles.balance();
    { total_cycles = total; per_profile_cycles = [] } // always empty (single canister)
  };

  // ── Archived: Sales crash guard ───────────────────────────────────────────

  /// ARCHIVED — Null-guarded sale projection. Returns the CustomerOrderDetail
  /// built from stored order data only — no live inventory lookup.
  /// Active replacement: SalesLib.getSaleWithItems (lib/sales.mo) is null-safe internally.
  public func guardedSaleWithItems(
    sale : SalesTypes.Sale,
    items : [SalesTypes.SaleItem],
    _productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
  ) : SalesTypes.CustomerOrderDetail {
    // Product info is already snapshotted on each SaleItem at sale time.
    // No live inventory lookup is needed — use stored snapshots.
    { sale; items }
  };
};
