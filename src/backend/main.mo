import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Timer "mo:core/Timer";



import ProfileLib "lib/profile";
import CatalogLib "lib/catalog";
import InventoryLib "lib/inventory";
import SalesLib "lib/sales";
import PurchasesLib "lib/purchases";
import CustomersLib "lib/customers";
import VendorsLib "lib/vendors";
import LocationMasterLib "lib/location-master";
import NotificationsLib "lib/notifications";
import GoalsLib "lib/goals";
import CustomerGoalsMedicalLib "lib/customer-goals-medical";
import LeadsLib "lib/leads";

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
import GoalsApi "mixins/goals-api";
import CustomerGoalsMedicalApi "mixins/customer-goals-medical-api";
import LeadsApi "mixins/leads-api";

import Common "types/common";
import UserTypes "types/users";





actor {
  // --- Profile state ---
  let profileStore : ProfileLib.Store = Map.empty();
  let userStore : ProfileLib.UserStore = Map.empty();

  // --- Catalog state ---
  let categoryStore : CatalogLib.CategoryStore = Map.empty();
  let productStore : CatalogLib.ProductStore = Map.empty();

  // --- Customer state ---
  let customerStore : CustomersLib.CustomerStore = Map.empty();
  let bodyCompositionStore : CustomersLib.BodyCompositionStore = Map.empty();

  // --- Inventory state ---
  let batchStore : InventoryLib.BatchStore = Map.empty();
  let movementStore : InventoryLib.MovementStore = Map.empty();

  // --- Sales state ---
  let saleStore : SalesLib.SaleStore = Map.empty();
  let saleItemStore : SalesLib.SaleItemStore = Map.empty();

  // --- Purchase Orders state ---
  let poStore : PurchasesLib.POStore = Map.empty();
  let poItemStore : PurchasesLib.POItemStore = Map.empty();

  // --- Vendors state ---
  let vendorStore : VendorsLib.Store = Map.empty();

  // --- Location Master state ---
  let locationMasterStore : LocationMasterLib.Store = Map.empty();

  // --- Notifications state ---
  let notificationsStore : NotificationsLib.Store = Map.empty();

  // --- Goals / Medical Issues / Body Inches state ---
  let goalStore : GoalsLib.GoalStore = Map.empty();
  let medicalIssueStore : GoalsLib.MedicalIssueStore = Map.empty();
  let bodyInchesStore : GoalsLib.BodyInchesStore = Map.empty();

  // --- Customer Goals/Medical (goals-medical type system) / Body Inches / Notes state ---
  let goalMasterStore : CustomerGoalsMedicalLib.GoalMasterStore = Map.empty();
  let medicalIssueMasterStore : CustomerGoalsMedicalLib.MedicalIssueMasterStore = Map.empty();
  let bodyInchesStore2 : CustomerGoalsMedicalLib.BodyInchesStore = Map.empty();
  let customerNoteStore : CustomerGoalsMedicalLib.CustomerNoteStore = Map.empty();

  // --- Leads state (public marketing page submissions) ---
  let leadStore : LeadsLib.LeadStore = Map.empty();

  // --- Super Admin principal (set once via initSuperAdmin) ---
  var superAdminPrincipal : ?Common.UserId = null;

  // Seed location master data on first use
  LocationMasterLib.seedIfEmpty(locationMasterStore);

  // ── Background notification timer ─────────────────────────────────────────────
  // Runs every 6 hours: checks overdue payments, customer follow-up reminders,
  // pending profile approvals, 3-month inactivity (silent), and lead follow-up
  // notifications across all active profiles.
  let _bgTimerId = Timer.recurringTimer<system>(#seconds(21600), func() : async () {
    // Check pending profiles (Super Admin notification)
    let _ = NotificationsLib.checkPendingProfiles(notificationsStore, profileStore);
    // Collect unique profile keys
    let profileKeys = Map.empty<Text, Bool>();
    for ((_p, up) in userStore.entries()) {
      if (up.profile_key != "") {
        profileKeys.add(up.profile_key, true);
      };
    };
    for ((pk, _) in profileKeys.entries()) {
      // Standard overdue-payment and 20-day customer follow-up checks
      let _ = NotificationsLib.runChecksForProfile(notificationsStore, saleStore, pk);
      // Silent 3-month inactivity update (no notification emitted)
      NotificationsLib.checkCustomerInactivity(customerStore, saleStore, pk);
      // Lead follow-up due notifications — fire to the Admin of this profile
      let adminPrincipalOpt = userStore.entries()
        .find(func((_uid, up)) { up.profile_key == pk and up.role == #admin });
      switch (adminPrincipalOpt) {
        case (?(_, adminUp)) {
          let _ = NotificationsLib.checkLeadFollowUp(notificationsStore, customerStore, pk, adminUp.principal);
        };
        case null {};
      };
    };
  });

  /// Wipe ALL stored data — clears every Map store and resets the super admin principal.
  /// Use this in preview/development to start with a completely fresh state.
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
    goalStore.clear();
    medicalIssueStore.clear();
    bodyInchesStore.clear();
    goalMasterStore.clear();
    medicalIssueMasterStore.clear();
    bodyInchesStore2.clear();
    customerNoteStore.clear();
    leadStore.clear();
    // Re-seed location master after clearing
    LocationMasterLib.seedIfEmpty(locationMasterStore);
    superAdminPrincipal := null;
  };

  /// Helper: upsert userStore entry with #superAdmin role for the given principal.
  func _upsertSuperAdminRole(principal : Common.UserId) {
    let existing = userStore.get(principal);
    let now = Time.now();
    let up : UserTypes.UserProfile = switch (existing) {
      case (?u) {
        {
          u with
          role = #superAdmin;
          approval_status = ?"approved";
          last_updated_by = principal;
          last_update_date = now;
        }
      };
      case null {
        {
          principal = principal;
          profile_key = "";
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
          theme = "dark";
          created_by = principal;
          last_updated_by = principal;
          creation_date = now;
          last_update_date = now;
        }
      };
    };
    userStore.add(principal, up);
  };

  /// One-time bootstrap: first caller becomes super admin (if not already set).
  public shared ({ caller }) func initSuperAdmin() : async Bool {
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

  /// Returns true if a Super Admin has already been registered (superAdminPrincipal is set).
  /// This is a public, unauthenticated query — used by the frontend to decide whether
  /// a new anonymous user should see the first-time setup screen or the onboarding screen.
  public shared query func doesSuperAdminExist() : async Bool {
    switch (superAdminPrincipal) {
      case (?_) true;
      case null false;
    }
  };

  /// Claim or re-claim superAdmin role.
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

  // --- Mixins ---
  // ProfileApi now receives all stores for cascade-delete support and notifications
  include ProfileApi(profileStore, userStore, categoryStore, productStore, customerStore, batchStore, movementStore, saleStore, saleItemStore, poStore, poItemStore, notificationsStore);
  include CatalogApi(categoryStore, productStore, userStore);
  include CustomersApi(customerStore, bodyCompositionStore, saleStore, saleItemStore, userStore);
  include InventoryApi(batchStore, movementStore, userStore);
  include SalesApi(saleStore, saleItemStore, batchStore, productStore, customerStore, userStore, profileStore, notificationsStore);
  include PurchasesApi(poStore, poItemStore, batchStore, userStore, profileStore);
  include DashboardApi(saleStore, batchStore, customerStore, profileStore, userStore);
  include VendorsApi(vendorStore, userStore);
  include LocationMasterApi(locationMasterStore);
  include NotificationsApi(notificationsStore, saleStore, customerStore, userStore, profileStore);
  include GoalsApi(goalStore, medicalIssueStore, bodyInchesStore, userStore);
  include CustomerGoalsMedicalApi(goalMasterStore, medicalIssueMasterStore, bodyInchesStore2, customerNoteStore, customerStore, profileStore, userStore);
  include LeadsApi(leadStore, userStore);
};
