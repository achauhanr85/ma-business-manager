import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import SalesTypes "../types/sales";
import CatalogLib "../lib/catalog";
import InventoryLib "../lib/inventory";
import SalesLib "../lib/sales";

mixin (
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
  batchStore : InventoryLib.BatchStore,
  productStore : CatalogLib.ProductStore,
) {
  var nextSaleId : Nat = 1;

  public shared ({ caller }) func createSale(cartItems : [SalesTypes.CartItem]) : async ?Common.SaleId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = SalesLib.createSale(saleStore, saleItemStore, batchStore, productStore, caller, nextSaleId, cartItems);
    switch (result) {
      case (?id) { nextSaleId += 1; ?id };
      case null null;
    };
  };

  public shared query ({ caller }) func getSales() : async [SalesTypes.Sale] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSales(saleStore, caller);
  };

  public shared query ({ caller }) func getSale(sale_id : Common.SaleId) : async ?SalesTypes.Sale {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSale(saleStore, caller, sale_id);
  };

  public shared query ({ caller }) func getSaleItems(sale_id : Common.SaleId) : async [SalesTypes.SaleItem] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSaleItems(saleStore, saleItemStore, caller, sale_id);
  };
};
