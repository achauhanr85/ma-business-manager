/*
 * FILE: mixins/catalog-api.mo
 * MODULE: mixin
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Exposes public canister functions for product categories and products.
 *   Delegates all logic to lib/catalog.mo. Manages auto-incrementing ID counters.
 *
 * FLOW:
 *   PAGE: Category page
 *     getCategories() → CatalogLib.getCategories() → profile-scoped list
 *     createCategory(input) → nextCategoryId++, CatalogLib.createCategory()
 *     updateCategory(id, input) → CatalogLib.updateCategory()
 *     deleteCategory(id) → CatalogLib.deleteCategory()
 *
 *   PAGE: Product page
 *     getProducts() → CatalogLib.getProducts() → profile-scoped list
 *     createProduct(input) → nextProductId++, CatalogLib.createProduct()
 *       Returns ?ProductId (null if SKU is a duplicate for this profile)
 *     updateProduct(id, input) → CatalogLib.updateProduct()
 *     deleteProduct(id) → CatalogLib.deleteProduct()
 *
 *   PAGE: Cart / Sale creation
 *     getProducts() is called to populate the product selector in the cart.
 *     Product prices/names shown in the cart are live; they are snapshotted
 *     onto each SaleItem when the sale is confirmed.
 *
 * DEPENDENCIES:
 *   imports: mo:core/Runtime, types/common, types/catalog, lib/catalog, lib/profile
 *   called by: main.mo (include CatalogApi(...))
 *
 * STATE:
 *   var nextCategoryId : Nat = 1   (auto-incremented per createCategory call)
 *   var nextProductId : Nat = 1    (auto-incremented per createProduct call)
 * ─────────────────────────────────────────────────────────────────────
 */

import Runtime "mo:core/Runtime";
import Common "../types/common";
import CatalogTypes "../types/catalog";
import CatalogLib "../lib/catalog";
import ProfileLib "../lib/profile";

mixin (
  categoryStore : CatalogLib.CategoryStore,
  productStore : CatalogLib.ProductStore,
  userStore : ProfileLib.UserStore,
) {
  var nextCategoryId : Nat = 1;
  var nextProductId : Nat = 1;

  public shared query ({ caller }) func getCategories() : async [CatalogTypes.Category] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CatalogLib.getCategories(categoryStore, userStore, caller)
  };

  public shared ({ caller }) func createCategory(input : CatalogTypes.CategoryInput) : async Common.CategoryId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let id = CatalogLib.createCategory(categoryStore, userStore, caller, nextCategoryId, input);
    nextCategoryId += 1;
    id
  };

  public shared ({ caller }) func updateCategory(id : Common.CategoryId, input : CatalogTypes.CategoryInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CatalogLib.updateCategory(categoryStore, userStore, caller, id, input)
  };

  public shared ({ caller }) func deleteCategory(id : Common.CategoryId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CatalogLib.deleteCategory(categoryStore, userStore, caller, id)
  };

  public shared query ({ caller }) func getProducts() : async [CatalogTypes.Product] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CatalogLib.getProducts(productStore, userStore, caller)
  };

  public shared ({ caller }) func createProduct(input : CatalogTypes.ProductInput) : async ?Common.ProductId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = CatalogLib.createProduct(productStore, userStore, caller, nextProductId, input);
    switch (result) {
      case (?_) { nextProductId += 1 };
      case null {};
    };
    result
  };

  public shared ({ caller }) func updateProduct(id : Common.ProductId, input : CatalogTypes.ProductInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CatalogLib.updateProduct(productStore, userStore, caller, id, input)
  };

  public shared ({ caller }) func deleteProduct(id : Common.ProductId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CatalogLib.deleteProduct(productStore, userStore, caller, id)
  };
};
