import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";

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




actor {
  // --- Profile state ---
  // All stores start empty — no seed or preview data.
  let profileStore : ProfileLib.Store = Map.empty();
  let userStore : ProfileLib.UserStore = Map.empty();

  // --- Catalog state ---
  let categoryStore : CatalogLib.CategoryStore = Map.empty();
  let productStore : CatalogLib.ProductStore = Map.empty();

  // --- Customer state ---
  let customerStore : CustomersLib.CustomerStore = Map.empty();

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
  //
  // Dry-run — Super Admin routing:
  //   On login, getUserProfile() is called first. If the returned role == #superAdmin,
  //   the frontend navigates directly to the Super Admin Dashboard, bypassing any saved
  //   profile session. This check is performed BEFORE restoring the last active profile,
  //   ensuring the super admin view always loads regardless of prior session state.
  //   The initSuperAdmin() function is a one-shot bootstrap: only the very first caller
  //   (before superAdminPrincipal is set) can claim the role.
  var superAdminPrincipal : ?Common.UserId = null;

  /// Wipe ALL stored data — clears every Map store and resets the super admin principal.
  /// Use this in preview/development to start with a completely fresh state.
  public shared func clearAllData() : async () {
    profileStore.clear();
    userStore.clear();
    categoryStore.clear();
    productStore.clear();
    customerStore.clear();
    batchStore.clear();
    movementStore.clear();
    saleStore.clear();
    saleItemStore.clear();
    poStore.clear();
    poItemStore.clear();
    superAdminPrincipal := null;
  };

  /// One-time bootstrap: first caller becomes super admin (if not already set)
  public shared ({ caller }) func initSuperAdmin() : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (superAdminPrincipal) {
      case (?_) false; // already set
      case null {
        superAdminPrincipal := ?caller;
        // Also upsert (or create) a UserProfile with #superAdmin role
        let existing = userStore.get(caller);
        let up : UserTypes.UserProfile = switch (existing) {
          case (?u) {
            {
              u with
              role = #superAdmin;
              last_updated_by = caller;
              last_update_date = Time.now();
            }
          };
          case null {
            let now = Time.now();
            {
              principal = caller;
              profile_key = "";
              role = #superAdmin;
              warehouse_name = "";
              display_name = "Super Admin";
              joined_at = now;
              // Who-columns — populated at bootstrap time
              created_by = caller;
              last_updated_by = caller;
              creation_date = now;
              last_update_date = now;
            }
          };
        };
        userStore.add(caller, up);
        true
      };
    }
  };

  // --- Mixins ---
  include ProfileApi(profileStore, userStore);
  include CatalogApi(categoryStore, productStore, userStore);
  include CustomersApi(customerStore, saleStore, saleItemStore, userStore);
  include InventoryApi(batchStore, movementStore, userStore);
  // SalesApi and PurchasesApi now receive profileStore for governance checks
  include SalesApi(saleStore, saleItemStore, batchStore, productStore, customerStore, userStore, profileStore);
  include PurchasesApi(poStore, poItemStore, batchStore, userStore, profileStore);
  include DashboardApi(saleStore, batchStore, profileStore, userStore);
};
