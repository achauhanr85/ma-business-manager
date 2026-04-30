// main.mo — Composition Root
//
// FILE: main.mo
// MODULE: main
// ─────────────────────────────────────────────────────────────────────
// PURPOSE:
//   This is the entry point of the entire backend canister. It owns all
//   in-memory data stores and wires them into domain mixins. Zero business logic lives here.
//
// FLOW:
//   CANISTER START:
//     1. All Map stores are initialized (empty)
//     2. LocationMasterLib.seedIfEmpty() pre-populates Indian States/Cities/Countries
//     3. Background timer registered (6-hour recurring tick)
//
//   EVERY AUTHENTICATED REQUEST:
//     Frontend calls a public function → dispatched to the owning mixin
//     Mixin reads/writes the stores it received as parameters
//     No direct state access from main.mo after initialization
//
//   BACKGROUND TICK (every 6 hours):
//     1. Remind Super Admin of pending profile approvals
//     2. Run overdue-payment + 20-day follow-up checks per profile
//     3. Silent 3-month customer inactivity update
//     4. Lead follow-up due alerts to Admin
//
//   initSuperAdmin / claimSuperAdmin:
//     The FIRST caller of initSuperAdmin() becomes Super Admin (principal locked in).
//     Subsequent calls by the same principal refresh the SA user record.
//     Other principals cannot claim SA.
//
// DEPENDENCIES:
//   imports: mo:core/Map, mo:core/Runtime, mo:core/Time, mo:core/Timer
//            lib/* (all domain libs), mixins/* (all API mixins), types/common, types/users
//   calls: LocationMasterLib.seedIfEmpty, NotificationsLib.check*
//
// STORES (18 total):
//   profileStore, userStore           — profile/user management (ProfileApi)
//   categoryStore, productStore       — catalog (CatalogApi)
//   customerStore, bodyCompositionStore — customers (CustomersApi)
//   batchStore, movementStore         — inventory (InventoryApi)
//   saleStore, saleItemStore          — sales (SalesApi)
//   poStore, poItemStore              — purchase orders (PurchasesApi)
//   vendorStore                       — vendors (VendorsApi)
//   locationMasterStore               — location dropdowns (LocationMasterApi)
//   notificationsStore                — all notifications (NotificationsApi + ProfileApi)
//   goalStore, medicalIssueStore, bodyInchesStore — LEGACY goals (GoalsApi)
//   goalMasterStore, medicalIssueMasterStore, bodyInchesStore2, customerNoteStore — ACTIVE goals
//   customerNotesStore                — V2 notes (CustomerNotesApi)
//   leadStore                         — marketing leads (LeadsApi)
//
// ARCHITECTURE NOTE — multi-file split:
//   This file contains ZERO business logic. All logic lives in:
//     lib/*.mo    → pure domain logic (no async, no caller checks)
//     mixins/*.mo → public API layer (caller auth, ID counters, delegates to lib/)
//     types/*.mo  → data shape definitions
//
// DIAGNOSTICS:
//   Users can enable diagnostics in Preferences (diagnostics_level: 0-4).
//   The frontend writes logs to the diagnostics panel for every API call, navigation
//   event, and auth event — but ONLY when diagnostics is enabled.
//   Levels: 0=TRACE, 1=DEBUG, 2=INFO (default), 3=WARN, 4=ERROR
//
// ACTIVE GOAL/MEDICAL SYSTEM:
//   There are TWO goal/medical module pairs in this project:
//     lib/goals.mo + mixins/goals-api.mo                          → LEGACY (kept for backwards compat)
//     lib/customer-goals-medical.mo + mixins/customer-goals-medical-api.mo → ACTIVE
//   The frontend calls listGoals/createGoal/updateGoal/deleteGoal from the ACTIVE system.
//   The legacy system's public functions (getGoalMasterData, createGoalMaster, etc.)
//   are still exposed to avoid breaking any call that may reference them.
//   See lib/goals.mo and mixins/goals-api.mo for full deprecation notes.
// ─────────────────────────────────────────────────────────────────────

import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Timer "mo:core/Timer";

// ── Domain library imports (pure logic, no public functions) ──────────────────
import ProfileLib "lib/profile";
import CatalogLib "lib/catalog";
import InventoryLib "lib/inventory";
import SalesLib "lib/sales";
import PurchasesLib "lib/purchases";
import CustomersLib "lib/customers";
import VendorsLib "lib/vendors";
import LocationMasterLib "lib/location-master";
import NotificationsLib "lib/notifications";
// LEGACY goals system — kept for backwards compat, do not add new features here
import GoalsLib "lib/goals";
// ACTIVE goals/medical/body-inches/notes system — all new features go here
import CustomerGoalsMedicalLib "lib/customer-goals-medical";
// ACTIVE customer notes library — separate dedicated store for CustomerNoteV2 records
import CustomerNotesLib "lib/customer-notes";
import LeadsLib "lib/leads";

// ── Mixin imports (public API surface, one per domain) ────────────────────────
import ProfileApi "mixins/profile-api";
import CatalogApi "mixins/catalog-api";
import CustomersApi "mixins/customers-api";
import InventoryApi "mixins/inventory-api";
import SalesApi "mixins/sales-api";
import PurchasesApi "mixins/purchases-api";
import DashboardApi "mixins/dashboard-api";
import VendorsApi "mixins/vendors-api";
import LocationMasterApi "mixins/location-master-api";
import NotificationsApi "mixins/notifications-api";
// LEGACY goals API — still included so old function names remain callable
import GoalsApi "mixins/goals-api";
// ACTIVE goals/medical API — the frontend uses these function names
import CustomerGoalsMedicalApi "mixins/customer-goals-medical-api";
// ACTIVE customer notes API — separate store for independent note CRUD (V2 notes system)
import CustomerNotesApi "mixins/customer-notes-api";
import LeadsApi "mixins/leads-api";

// ── Migration import ──────────────────────────────────────────────────────────
// Handles the userStore schema change: adds diagnostics_level field to UserProfile
// with default value 2 (INFO) for all existing users on canister upgrade.
import Migration "migration";

// ── Shared type imports ───────────────────────────────────────────────────────
import Common "types/common";
import UserTypes "types/users";


(with migration = Migration.run)
actor {

  // ── Profile and User stores ───────────────────────────────────────────────
  // profileStore: one entry per business profile (keyed by profile_key string)
  // userStore:    one entry per logged-in user (keyed by their Internet Identity principal)
  let profileStore : ProfileLib.Store = Map.empty();
  let userStore : ProfileLib.UserStore = Map.empty();

  // ── Catalog stores ────────────────────────────────────────────────────────
  // categoryStore: product categories (e.g. "Protein", "Vitamins") per profile
  // productStore:  individual products with SKU, price, instructions, etc.
  let categoryStore : CatalogLib.CategoryStore = Map.empty();
  let productStore : CatalogLib.ProductStore = Map.empty();

  // ── Customer store ────────────────────────────────────────────────────────
  // customerStore:       customer records with notes, goals, body measurements
  // bodyCompositionStore: time-series body composition entries (weight, fat, BMI, etc.)
  let customerStore : CustomersLib.CustomerStore = Map.empty();
  let bodyCompositionStore : CustomersLib.BodyCompositionStore = Map.empty();

  // ── Inventory stores ──────────────────────────────────────────────────────
  // batchStore:    inventory batches — each batch is a quantity of a product at a cost price
  //                FIFO decrement deducts from the oldest batch first on every sale
  // movementStore: audit trail of every stock movement (receive, sell, transfer, stage)
  let batchStore : InventoryLib.BatchStore = Map.empty();
  let movementStore : InventoryLib.MovementStore = Map.empty();

  // ── Sales stores ──────────────────────────────────────────────────────────
  // saleStore:     one entry per sale/return order header
  // saleItemStore: line items for each sale (keyed by saleId, stored as an array)
  let saleStore : SalesLib.SaleStore = Map.empty();
  let saleItemStore : SalesLib.SaleItemStore = Map.empty();

  // ── Purchase Order stores ─────────────────────────────────────────────────
  // poStore:     one entry per purchase order header (PO-XXXX)
  // poItemStore: line items for each PO (keyed by poId, stored as an array)
  let poStore : PurchasesLib.POStore = Map.empty();
  let poItemStore : PurchasesLib.POItemStore = Map.empty();

  // ── Vendor store ──────────────────────────────────────────────────────────
  // vendorStore: supplier/vendor records — used when creating purchase orders
  let vendorStore : VendorsLib.Store = Map.empty();

  // ── Location Master store ─────────────────────────────────────────────────
  // locationMasterStore: Indian States / Cities / Countries lookup values
  //                      Pre-seeded on first use via LocationMasterLib.seedIfEmpty()
  let locationMasterStore : LocationMasterLib.Store = Map.empty();

  // ── Notifications store ───────────────────────────────────────────────────
  // notificationsStore: all notification records across all profiles + system
  //                     Super Admin notifications use profile_key="superadmin"
  //                     and target_role="superAdmin" — never filtered by profileKey
  let notificationsStore : NotificationsLib.Store = Map.empty();

  // ── LEGACY Goal / Medical Issue stores ───────────────────────────────────
  // These stores back the OLD goals-api.mo mixin (getGoalMasterData / createGoalMaster etc.)
  // They are kept so existing data is not lost and old API calls still work.
  // NEW data goes into goalMasterStore / medicalIssueMasterStore below.
  let goalStore : GoalsLib.GoalStore = Map.empty();
  let medicalIssueStore : GoalsLib.MedicalIssueStore = Map.empty();
  // bodyInchesStore is used by the legacy goals-api body-inches path (now superseded)
  let bodyInchesStore : GoalsLib.BodyInchesStore = Map.empty();

  // ── ACTIVE Goal / Medical Issue / Body Inches / Notes stores ──────────────
  // These stores back the NEW customer-goals-medical-api.mo mixin
  //   goalMasterStore:         profile-level goal definitions (e.g. "Weight Loss")
  //   medicalIssueMasterStore: profile-level medical issue definitions (e.g. "Diabetes")
  //   bodyInchesStore2:        time-series body inch measurements per customer
  //   customerNoteStore:       LEGACY note ID registry (actual notes lived on customer record)
  //                            This store is kept for backward compat but is no longer the
  //                            primary notes source. See customerNotesStore below.
  let goalMasterStore : CustomerGoalsMedicalLib.GoalMasterStore = Map.empty();
  let medicalIssueMasterStore : CustomerGoalsMedicalLib.MedicalIssueMasterStore = Map.empty();
  let bodyInchesStore2 : CustomerGoalsMedicalLib.BodyInchesStore = Map.empty();
  let customerNoteStore : CustomerGoalsMedicalLib.CustomerNoteStore = Map.empty();

  // ── ACTIVE Customer Notes store (separate, dedicated, V2 notes system) ────
  // customerNotesStore:  one entry per CustomerNoteV2 record, keyed by note ID.
  //                      This is the PRIMARY notes store going forward.
  //                      Notes here are fully independent of the Customer record —
  //                      they can be created, updated, and deleted without touching
  //                      the customer record. Backed by customer-notes-api.mo mixin.
  //
  // customerNoteIdCounter: auto-incrementing integer for unique note IDs.
  //                        Starts at 1. Managed by the CustomerNotesApi mixin's
  //                        nextCustomerNoteId var (incremented after each addNote).
  //
  // MIGRATION NOTE: Customer.notes (the legacy embedded array) remains in place for
  //   backward compatibility. New notes go here. Both may be present during transition.
  let customerNotesStore : CustomerNotesLib.CustomerNotesStore = Map.empty();

  // ── Leads store ───────────────────────────────────────────────────────────
  // leadStore: demo/contact requests submitted from the public marketing Index page
  //            Visible only to Super Admin; can be closed and assigned an onboarding link
  let leadStore : LeadsLib.LeadStore = Map.empty();

  // ── Super Admin principal ─────────────────────────────────────────────────
  // Holds the Internet Identity principal of the Super Admin.
  // Set once via initSuperAdmin() on first login. null means not yet bootstrapped.
  // All notification-write logic for system-level events uses this principal.
  var superAdminPrincipal : ?Common.UserId = null;

  // ── Seed location master data ─────────────────────────────────────────────
  // Populates the Indian State/City/Country lookup table if it is empty.
  // This runs synchronously at canister start — safe because it only writes if empty.
  LocationMasterLib.seedIfEmpty(locationMasterStore);

  // ── Background notification timer ─────────────────────────────────────────
  // Runs every 6 hours (21,600 seconds).
  // On each tick it:
  //   1. Reminds Super Admin of any profiles still pending approval
  //   2. For each profile: checks overdue payments and 20-day customer follow-up
  //   3. Silently marks customers as inactive if no sale in 90+ days (no notification)
  //   4. Fires lead-follow-up-due notifications to each profile's Admin
  //
  // NOTE: This timer runs automatically — Admin can also trigger checks manually
  //       via the runBackgroundChecks() function in notifications-api.mo.
  let _bgTimerId = Timer.recurringTimer<system>(#seconds(21600), func() : async () {
    // Step 1: Remind Super Admin of pending profile approvals
    let _ = NotificationsLib.checkPendingProfiles(notificationsStore, profileStore);

    // Step 2: Collect unique profile keys from all users (deduplicated)
    let profileKeys = Map.empty<Text, Bool>();
    for ((_p, up) in userStore.entries()) {
      if (up.profile_key != "") {
        profileKeys.add(up.profile_key, true);
      };
    };

    // Step 3: Run per-profile checks
    for ((pk, _) in profileKeys.entries()) {
      // Check overdue payments and 20-day customer follow-up for this profile
      let _ = NotificationsLib.runChecksForProfile(notificationsStore, saleStore, pk);

      // Silently mark inactive customers (no purchase in 90+ days) — no notification
      NotificationsLib.checkCustomerInactivity(customerStore, saleStore, pk);

      // Fire lead follow-up due notifications to the Admin of this profile
      // (finds the first user with role=#admin in this profile)
      let adminPrincipalOpt = userStore.entries()
        .find(func((_uid, up)) { up.profile_key == pk and up.role == #admin });
      switch (adminPrincipalOpt) {
        case (?(_, adminUp)) {
          let _ = NotificationsLib.checkLeadFollowUp(
            notificationsStore, customerStore, pk, adminUp.principal
          );
        };
        case null {}; // No admin in this profile — skip lead follow-up
      };
    };
  });

  // ── clearAllData ──────────────────────────────────────────────────────────
  /// Wipes ALL stored data — clears every Map store and resets the super admin principal.
  /// USE IN DEVELOPMENT/PREVIEW ONLY. This is destructive and irreversible.
  /// After clearing, location master data is re-seeded automatically.
  public shared func clearAllData() : async () {
    profileStore.clear();
    userStore.clear();
    categoryStore.clear();
    productStore.clear();
    customerStore.clear();
    bodyCompositionStore.clear();
    batchStore.clear();
    movementStore.clear();
    saleStore.clear();
    saleItemStore.clear();
    poStore.clear();
    poItemStore.clear();
    vendorStore.clear();
    notificationsStore.clear();
    // Clear both legacy and active goal/medical stores
    goalStore.clear();
    medicalIssueStore.clear();
    bodyInchesStore.clear();
    goalMasterStore.clear();
    medicalIssueMasterStore.clear();
    bodyInchesStore2.clear();
    customerNoteStore.clear();
    // Clear the V2 notes store (separate dedicated store for CustomerNoteV2 records)
    customerNotesStore.clear();
    leadStore.clear();
    // Re-seed location master data so dropdowns still work after a clear
    LocationMasterLib.seedIfEmpty(locationMasterStore);
    superAdminPrincipal := null;
  };

  // ── _upsertSuperAdminRole (private helper) ────────────────────────────────
  /// Creates or updates the userStore entry for the given principal with role=#superAdmin.
  /// Called by initSuperAdmin() and claimSuperAdmin() to ensure the Super Admin always
  /// has an approved, correctly-roled user record even after a clearAllData().
  func _upsertSuperAdminRole(principal : Common.UserId) {
    let existing = userStore.get(principal);
    let now = Time.now();
    let up : UserTypes.UserProfile = switch (existing) {
      case (?u) {
        // Preserve all existing fields but force role=superAdmin and approval=approved
        {
          u with
          role = #superAdmin;
          approval_status = ?"approved";
          last_updated_by = principal;
          last_update_date = now;
        }
      };
      case null {
        // Brand-new Super Admin record with sensible defaults
        {
          principal = principal;
          profile_key = "";        // Super Admin has no profile_key until impersonation
          role = #superAdmin;
          warehouse_name = "";
          display_name = "Super Admin";
          email = null;
          joined_at = now;
          approval_status = ?"approved";
          module_access = null;
          language_preference = "en";
          date_format = "DD/MM/YYYY";
          default_receipt_language = "en";
          theme = "herbal";
          // Diagnostics default: 2 = INFO
          diagnostics_level = 2;
          created_by = principal;
          last_updated_by = principal;
          creation_date = now;
          last_update_date = now;
        }
      };
    };
    userStore.add(principal, up);
  };

  // ── initSuperAdmin ────────────────────────────────────────────────────────
  /// One-time bootstrap: the FIRST caller of this function becomes Super Admin.
  /// If Super Admin is already set, only the same principal can re-confirm (re-run
  /// after clearAllData). Returns true on success, false if already taken by someone else.
  public shared ({ caller }) func initSuperAdmin() : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (superAdminPrincipal) {
      case (?existing) {
        // Already bootstrapped — only the same principal can re-confirm
        if (existing == caller) {
          _upsertSuperAdminRole(caller);
          true
        } else {
          false // Another user is already Super Admin
        }
      };
      case null {
        // First-time setup: lock in this caller as Super Admin
        superAdminPrincipal := ?caller;
        _upsertSuperAdminRole(caller);
        true
      };
    }
  };

  // ── doesSuperAdminExist ───────────────────────────────────────────────────
  /// Public unauthenticated query — returns true if a Super Admin has been set up.
  /// The frontend uses this to decide whether to show the first-time setup screen
  /// (superAdminPrincipal is null) or the normal onboarding screen (it is set).
  public shared query func doesSuperAdminExist() : async Bool {
    switch (superAdminPrincipal) {
      case (?_) true;
      case null false;
    }
  };

  // ── claimSuperAdmin ───────────────────────────────────────────────────────
  /// Re-claim or confirm Super Admin role. Behaves identically to initSuperAdmin
  /// but is named separately so the frontend can call it to refresh the user record
  /// after a preference change or after recovering from a data clear.
  public shared ({ caller }) func claimSuperAdmin() : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (superAdminPrincipal) {
      case (?existing) {
        if (existing == caller) {
          _upsertSuperAdminRole(caller);
          true
        } else {
          false
        }
      };
      case null {
        superAdminPrincipal := ?caller;
        _upsertSuperAdminRole(caller);
        true
      };
    }
  };

  // ── Mixin inclusions ──────────────────────────────────────────────────────
  // Each "include" line wires a domain-specific mixin into this actor.
  // The mixin receives only the stores it needs (principle of least privilege).
  // All public functions callable by the frontend are defined inside these mixins.
  // This file (main.mo) itself defines NO public business functions.

  // Profile and user management (create profile, join, approve, preferences, routing)
  // Receives all stores because deleteProfile cascades to every domain.
  include ProfileApi(
    profileStore, userStore,
    categoryStore, productStore, customerStore,
    batchStore, movementStore,
    saleStore, saleItemStore,
    poStore, poItemStore,
    notificationsStore,
  );

  // Product categories and products (CRUD + CSV)
  include CatalogApi(categoryStore, productStore, userStore);

  // Customer records, body composition, notes (CRUD)
  include CustomersApi(customerStore, bodyCompositionStore, saleStore, saleItemStore, userStore);

  // Inventory batches and movements (FIFO, warehouse transfer, stage inventory)
  include InventoryApi(batchStore, movementStore, userStore);

  // Sales orders and return orders (cart → FIFO deduct → order → payment history)
  include SalesApi(saleStore, saleItemStore, batchStore, productStore, customerStore, userStore, profileStore, notificationsStore);

  // Purchase orders (receive stock into warehouse, FIFO replenish)
  include PurchasesApi(poStore, poItemStore, batchStore, userStore, profileStore);

  // Dashboard KPI queries (sales counts, customer status, referral commission charts)
  include DashboardApi(saleStore, batchStore, customerStore, profileStore, userStore);

  // Vendor / supplier management (used on PO creation)
  include VendorsApi(vendorStore, userStore);

  // Indian State/City/Country lookup values (pre-seeded master data)
  include LocationMasterApi(locationMasterStore);

  // Notification panel (read, mark-read, manual trigger, background checks)
  include NotificationsApi(notificationsStore, saleStore, customerStore, userStore, profileStore);

  // LEGACY goal/medical API — exposes getGoalMasterData / createGoalMaster etc.
  // These back the old goalStore/medicalIssueStore/bodyInchesStore.
  // Do NOT add new features here; use CustomerGoalsMedicalApi below.
  include GoalsApi(goalStore, medicalIssueStore, bodyInchesStore, userStore);

  // ACTIVE goal/medical/body-inches/notes API — exposes listGoals / createGoal etc.
  // This is the system the frontend uses for all current goal/medical/inches/notes pages.
  include CustomerGoalsMedicalApi(
    goalMasterStore, medicalIssueMasterStore,
    bodyInchesStore2, customerNoteStore,
    customerStore, profileStore, userStore,
  );

  // ACTIVE customer notes API (V2 separate store) — exposes addCustomerNoteV2,
  // getCustomerNotes, updateCustomerNote, deleteCustomerNote, getAllCustomerNotesForProfile.
  // Notes here are stored independently of the Customer record (CustomerNoteV2 type).
  // Legacy notes on Customer.notes remain untouched for backward compatibility.
  include CustomerNotesApi(customerNotesStore, customerStore, userStore);

  // Marketing leads (submitted from public Index page, managed by Super Admin)
  include LeadsApi(leadStore, userStore);
};
