import Map "mo:core/Map";
import List "mo:core/List";

import ProfileLib "lib/profile";
import CatalogLib "lib/catalog";
import InventoryLib "lib/inventory";
import SalesLib "lib/sales";
import PurchasesLib "lib/purchases";

import ProfileApi "mixins/profile-api";
import CatalogApi "mixins/catalog-api";
import InventoryApi "mixins/inventory-api";
import SalesApi "mixins/sales-api";
import PurchasesApi "mixins/purchases-api";
import DashboardApi "mixins/dashboard-api";

actor {
  // --- Profile state ---
  let profileStore : ProfileLib.Store = Map.empty();

  // --- Catalog state ---
  let categoryStore : CatalogLib.CategoryStore = Map.empty();
  let productStore : CatalogLib.ProductStore = Map.empty();

  // --- Inventory state ---
  let batchStore : InventoryLib.BatchStore = Map.empty();

  // --- Sales state ---
  let saleStore : SalesLib.SaleStore = Map.empty();
  let saleItemStore : SalesLib.SaleItemStore = List.empty();

  // --- Purchase Orders state ---
  let poStore : PurchasesLib.POStore = Map.empty();
  let poItemStore : PurchasesLib.POItemStore = List.empty();

  // --- Mixins ---
  include ProfileApi(profileStore);
  include CatalogApi(categoryStore, productStore);
  include InventoryApi(batchStore);
  include SalesApi(saleStore, saleItemStore, batchStore, productStore);
  include PurchasesApi(poStore, poItemStore, batchStore);
  include DashboardApi(saleStore, batchStore);
};
