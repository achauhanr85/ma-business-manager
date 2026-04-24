import Map "mo:core/Map";
import Runtime "mo:core/Runtime";

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

import Migration "migration";
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
              principal = u.principal;
              profile_key = u.profile_key;
              role = #superAdmin;
              warehouse_name = u.warehouse_name;
              display_name = u.display_name;
              joined_at = u.joined_at;
            }
          };
          case null {
            {
              principal = caller;
              profile_key = "";
              role = #superAdmin;
              warehouse_name = "";
              display_name = "Super Admin";
              joined_at = 0;
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
  include CustomersApi(customerStore, userStore);
  include InventoryApi(batchStore, movementStore, userStore);
  include SalesApi(saleStore, saleItemStore, batchStore, productStore, customerStore, userStore);
  include PurchasesApi(poStore, poItemStore, batchStore, userStore);
  include DashboardApi(saleStore, batchStore, profileStore, userStore);
};
