/*
 * FILE: lib/catalog.mo
 * MODULE: lib
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Implements CRUD for the product catalog (categories and products).
 *   All data is strictly scoped to the caller's business profile via profileKey.
 *
 * FLOW:
 *   PAGE: Category page
 *     getCategories() → filter by profileKey → [Category]
 *     createCategory(input) → validate caller has profile → insert with auto-ID
 *     updateCategory(id, input) → verify ownership → update fields
 *     deleteCategory(id) → verify ownership → remove
 *
 *   PAGE: Product page
 *     getProducts() → filter by profileKey → [Product]
 *     createProduct(input) → check SKU uniqueness per profile → insert
 *     updateProduct(id, input) → check SKU uniqueness if changed → update
 *     deleteProduct(id) → verify ownership → remove
 *
 *   PAGE: Cart / Sale creation
 *     Products are looked up here by product_id and their name/mrp/cost are
 *     SNAPSHOTTED onto each SaleItem at sale time — historical receipts always
 *     show the price at time of sale even if the product is later changed.
 *
 * DEPENDENCIES:
 *   imports: mo:core/Map, mo:core/Time, mo:core/Runtime, types/common,
 *            types/catalog, types/users
 *   called by: mixins/catalog-api.mo, lib/sales.mo (product lookup for snapshots)
 *              lib/profile.mo (cascade delete on deleteProfile)
 *   calls: types/catalog (Category, Product types)
 *
 * KEY TYPES:
 *   CategoryStore — Map<CategoryId, Category>
 *   ProductStore  — Map<ProductId, Product>
 *
 * IMPORTANT — SKU Uniqueness:
 *   SKU uniqueness is enforced PER PROFILE — two different profiles can have the same SKU.
 *   Within a profile, no two active products may share a SKU.
 * ─────────────────────────────────────────────────────────────────────
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import CatalogTypes "../types/catalog";
import UserTypes "../types/users";

module {
  public type CategoryStore = Map.Map<Common.CategoryId, CatalogTypes.Category>;
  public type ProductStore = Map.Map<Common.ProductId, CatalogTypes.Product>;

  func callerProfileKey(userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : Common.ProfileKey {
    switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile");
    }
  };

  public func getCategories(store : CategoryStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : [CatalogTypes.Category] {
    let profileKey = callerProfileKey(userStore, caller);
    let result = store.entries()
      .filter(func((_id, cat)) { cat.profile_key == profileKey })
      .map(func((_id, cat) : (Common.CategoryId, CatalogTypes.Category)) : CatalogTypes.Category { cat });
    result.toArray()
  };

  public func createCategory(store : CategoryStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, nextId : Nat, input : CatalogTypes.CategoryInput) : Common.CategoryId {
    let profileKey = callerProfileKey(userStore, caller);
    let now = Time.now();
    let cat : CatalogTypes.Category = {
      id = nextId;
      name = input.name;
      description = input.description;
      profile_key = profileKey;
      owner = caller;
      // Who-columns
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, cat);
    nextId
  };

  public func updateCategory(store : CategoryStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, id : Common.CategoryId, input : CatalogTypes.CategoryInput) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.add(id, { existing with name = input.name; description = input.description; last_updated_by = caller; last_update_date = Time.now() });
        true
      };
    }
  };

  public func deleteCategory(store : CategoryStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, id : Common.CategoryId) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };

  public func getProducts(store : ProductStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : [CatalogTypes.Product] {
    let profileKey = callerProfileKey(userStore, caller);
    let result = store.entries()
      .filter(func((_id, prod)) { prod.profile_key == profileKey })
      .map(func((_id, prod) : (Common.ProductId, CatalogTypes.Product)) : CatalogTypes.Product { prod });
    result.toArray()
  };

  /// Returns ?ProductId on success; null if SKU already exists for this profile
  public func createProduct(store : ProductStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, nextId : Nat, input : CatalogTypes.ProductInput) : ?Common.ProductId {
    let profileKey = callerProfileKey(userStore, caller);
    // Validate SKU uniqueness per profile
    let skuTaken = store.entries().any(func((_id, prod)) {
      prod.profile_key == profileKey and prod.sku == input.sku
    });
    if (skuTaken) return null;
    let now = Time.now();
    let prod : CatalogTypes.Product = {
      id = nextId;
      sku = input.sku;
      name = input.name;
      category_id = input.category_id;
      volume_points = input.volume_points;
      earn_base = input.earn_base;
      mrp = input.mrp;
      hsn_code = input.hsn_code;
      instructions = input.instructions;
      serving_size = input.serving_size;
      profile_key = profileKey;
      owner = caller;
      // Who-columns
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    store.add(nextId, prod);
    ?nextId
  };

  public func updateProduct(store : ProductStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, id : Common.ProductId, input : CatalogTypes.ProductInput) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        // Check SKU uniqueness if it changed
        if (existing.sku != input.sku) {
          let skuTaken = store.entries().any(func((pid, prod)) {
            prod.profile_key == profileKey and prod.sku == input.sku and pid != id
          });
          if (skuTaken) return false;
        };
        store.add(id, {
          existing with
          sku = input.sku;
          name = input.name;
          category_id = input.category_id;
          volume_points = input.volume_points;
          earn_base = input.earn_base;
          mrp = input.mrp;
          hsn_code = input.hsn_code;
          instructions = input.instructions;
          serving_size = input.serving_size;
          // Who-columns: update last_updated_by and last_update_date
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  public func deleteProduct(store : ProductStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, id : Common.ProductId) : Bool {
    let profileKey = callerProfileKey(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profileKey) return false;
        store.remove(id);
        true
      };
    }
  };
};
