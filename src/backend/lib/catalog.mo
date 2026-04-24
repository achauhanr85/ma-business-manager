import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Common "../types/common";
import CatalogTypes "../types/catalog";

module {
  public type CategoryStore = Map.Map<Common.CategoryId, CatalogTypes.Category>;
  public type ProductStore = Map.Map<Common.ProductId, CatalogTypes.Product>;

  public func getCategories(store : CategoryStore, caller : Common.UserId) : [CatalogTypes.Category] {
    let result = List.empty<CatalogTypes.Category>();
    for ((_, cat) in store.entries()) {
      if (Principal.equal(cat.owner, caller)) {
        result.add(cat);
      };
    };
    result.toArray();
  };

  public func createCategory(store : CategoryStore, caller : Common.UserId, nextId : Nat, input : CatalogTypes.CategoryInput) : Common.CategoryId {
    let id = nextId;
    let cat : CatalogTypes.Category = {
      id;
      name = input.name;
      description = input.description;
      owner = caller;
    };
    store.add(id, cat);
    id;
  };

  public func updateCategory(store : CategoryStore, caller : Common.UserId, id : Common.CategoryId, input : CatalogTypes.CategoryInput) : Bool {
    switch (store.get(id)) {
      case (?cat) {
        if (not Principal.equal(cat.owner, caller)) return false;
        store.add(id, { cat with name = input.name; description = input.description });
        true;
      };
      case null false;
    };
  };

  public func deleteCategory(store : CategoryStore, caller : Common.UserId, id : Common.CategoryId) : Bool {
    switch (store.get(id)) {
      case (?cat) {
        if (not Principal.equal(cat.owner, caller)) return false;
        store.remove(id);
        true;
      };
      case null false;
    };
  };

  public func getProducts(store : ProductStore, caller : Common.UserId) : [CatalogTypes.Product] {
    let result = List.empty<CatalogTypes.Product>();
    for ((_, prod) in store.entries()) {
      if (Principal.equal(prod.owner, caller)) {
        result.add(prod);
      };
    };
    result.toArray();
  };

  public func createProduct(store : ProductStore, caller : Common.UserId, nextId : Nat, input : CatalogTypes.ProductInput) : ?Common.ProductId {
    // Validate SKU uniqueness per caller
    let skuExists = store.any(func(_, prod) {
      Principal.equal(prod.owner, caller) and prod.sku == input.sku
    });
    if (skuExists) return null;

    let id = nextId;
    let prod : CatalogTypes.Product = {
      id;
      sku = input.sku;
      name = input.name;
      category_id = input.category_id;
      volume_points = input.volume_points;
      earn_base = input.earn_base;
      mrp = input.mrp;
      hsn_code = input.hsn_code;
      owner = caller;
    };
    store.add(id, prod);
    ?id;
  };

  public func updateProduct(store : ProductStore, caller : Common.UserId, id : Common.ProductId, input : CatalogTypes.ProductInput) : Bool {
    switch (store.get(id)) {
      case (?prod) {
        if (not Principal.equal(prod.owner, caller)) return false;
        // Check SKU uniqueness if changed
        if (prod.sku != input.sku) {
          let skuExists = store.any(func(_, p) {
            Principal.equal(p.owner, caller) and p.sku == input.sku and p.id != id
          });
          if (skuExists) return false;
        };
        store.add(id, {
          prod with
          sku = input.sku;
          name = input.name;
          category_id = input.category_id;
          volume_points = input.volume_points;
          earn_base = input.earn_base;
          mrp = input.mrp;
          hsn_code = input.hsn_code;
        });
        true;
      };
      case null false;
    };
  };

  public func deleteProduct(store : ProductStore, caller : Common.UserId, id : Common.ProductId) : Bool {
    switch (store.get(id)) {
      case (?prod) {
        if (not Principal.equal(prod.owner, caller)) return false;
        store.remove(id);
        true;
      };
      case null false;
    };
  };
};
