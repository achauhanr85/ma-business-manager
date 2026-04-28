import Debug "mo:core/Debug";
import Map "mo:core/Map";
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
    Debug.todo()
  };

  /// Creates a new goal in a profile. Returns the new GoalMasterPublic.
  public func createGoalMaster(
    store : GoalStore,
    nextId : Nat,
    profileKey : Common.ProfileKey,
    input : DomainTypes.GoalMasterInput,
    caller : Common.UserId,
  ) : DomainTypes.GoalMasterPublic {
    Debug.todo()
  };

  /// Updates an existing goal. Returns the updated GoalMasterPublic or null if not found.
  public func updateGoalMaster(
    store : GoalStore,
    id : Nat,
    input : DomainTypes.GoalMasterInput,
    caller : Common.UserId,
  ) : ?DomainTypes.GoalMasterPublic {
    Debug.todo()
  };

  /// Deletes a goal. Returns true if deleted, false if not found.
  public func deleteGoalMaster(
    store : GoalStore,
    id : Nat,
    caller : Common.UserId,
  ) : Bool {
    Debug.todo()
  };

  /// Associates a list of product IDs as a bundle for a given goal.
  public func updateGoalProductBundle(
    store : GoalStore,
    goalId : Nat,
    productIds : [Common.ProductId],
    caller : Common.UserId,
  ) : Bool {
    Debug.todo()
  };

  // ── Medical Issue Master ──────────────────────────────────────────────────────

  /// Returns all medical issues for a given profile.
  public func getMedicalIssueMasterData(
    store : MedicalIssueStore,
    profileKey : Common.ProfileKey,
  ) : [DomainTypes.MedicalIssueMasterPublic] {
    Debug.todo()
  };

  /// Creates a new medical issue in a profile.
  public func createMedicalIssueMaster(
    store : MedicalIssueStore,
    nextId : Nat,
    profileKey : Common.ProfileKey,
    input : DomainTypes.MedicalIssueMasterInput,
    caller : Common.UserId,
  ) : DomainTypes.MedicalIssueMasterPublic {
    Debug.todo()
  };

  /// Updates an existing medical issue.
  public func updateMedicalIssueMaster(
    store : MedicalIssueStore,
    id : Nat,
    input : DomainTypes.MedicalIssueMasterInput,
    caller : Common.UserId,
  ) : ?DomainTypes.MedicalIssueMasterPublic {
    Debug.todo()
  };

  /// Deletes a medical issue.
  public func deleteMedicalIssueMaster(
    store : MedicalIssueStore,
    id : Nat,
    caller : Common.UserId,
  ) : Bool {
    Debug.todo()
  };

  // ── Body Inches ───────────────────────────────────────────────────────────────
  // Uses CustomerTypes.BodyInchesEntry / BodyInchesPublic (already in customers.mo)

  /// Returns all body inches history entries for a customer, sorted latest first.
  public func getBodyInchesHistory(
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    customerId : Common.CustomerId,
    profileKey : Common.ProfileKey,
  ) : [CustomerTypes.BodyInchesPublic] {
    Debug.todo()
  };

  /// Creates a new body inches entry for a customer.
  public func createBodyInchesEntry(
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    nextId : Nat,
    customerId : Common.CustomerId,
    profileKey : Common.ProfileKey,
    input : CustomerTypes.BodyInchesInput,
    caller : Common.UserId,
  ) : CustomerTypes.BodyInchesPublic {
    Debug.todo()
  };

  // ── Customer Notes (multi-note with date) ─────────────────────────────────────
  // Uses CustomerTypes.CustomerNote / CustomerNoteInput (already in customers.mo)

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
    Debug.todo()
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
    Debug.todo()
  };

  // ── Canister Cycles ───────────────────────────────────────────────────────────

  /// Returns current canister cycle balance.
  /// Per-profile cycles are 0 since all profiles share a single canister.
  public func getCanisterCyclesInfo(
    profileKeys : [Common.ProfileKey],
  ) : DomainTypes.CyclesInfo {
    Debug.todo()
  };

  // ── Sales crash guard ─────────────────────────────────────────────────────────

  /// Null-guarded projection of a SaleItem's product snapshot.
  /// If the product is not found in productStore, returns the item unchanged —
  /// product_name_snapshot already carries the name at sale time; no crash occurs.
  public func guardedSaleWithItems(
    sale : SalesTypes.Sale,
    items : [SalesTypes.SaleItem],
    productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
  ) : SalesTypes.CustomerOrderDetail {
    Debug.todo()
  };
};
