import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";

import Migration "migration";
import ProfileLib "lib/profile";
import CatalogLib "lib/catalog";
import InventoryLib "lib/inventory";
import SalesLib "lib/sales";
import PurchasesLib "lib/purchases";
import CustomersLib "lib/customers";

import ProfileApi "mixins/profile-api";
import CatalogApi "mixins/catalog-api";
import CustomersApi "mixins/customers-api";
import InventoryApi "mixins/inventory-api";
import SalesApi "mixins/sales-api";
import PurchasesApi "mixins/purchases-api";
import DashboardApi "mixins/dashboard-api";

import Common "types/common";
import UserTypes "types/users";

(with migration = Migration.run)
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

  // --- Super Admin principal (set once via initSuperAdmin) ---
  var superAdminPrincipal : ?Common.UserId = null;

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
          joined_at = now;
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
  // ProfileApi now receives all stores for cascade-delete support
  include ProfileApi(profileStore, userStore, categoryStore, productStore, customerStore, batchStore, movementStore, saleStore, saleItemStore, poStore, poItemStore);
  include CatalogApi(categoryStore, productStore, userStore);
  include CustomersApi(customerStore, bodyCompositionStore, saleStore, saleItemStore, userStore);
  include InventoryApi(batchStore, movementStore, userStore);
  include SalesApi(saleStore, saleItemStore, batchStore, productStore, customerStore, userStore, profileStore);
  include PurchasesApi(poStore, poItemStore, batchStore, userStore, profileStore);
  include DashboardApi(saleStore, batchStore, profileStore, userStore);
};
