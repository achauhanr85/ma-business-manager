import Runtime "mo:core/Runtime";
import Common "../types/common";
import SalesTypes "../types/sales";
import CatalogLib "../lib/catalog";
import InventoryLib "../lib/inventory";
import SalesLib "../lib/sales";
import CustomersLib "../lib/customers";
import ProfileLib "../lib/profile";

mixin (
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
  batchStore : InventoryLib.BatchStore,
  productStore : CatalogLib.ProductStore,
  customerStore : CustomersLib.CustomerStore,
  userStore : ProfileLib.UserStore,
) {
  var nextSaleId : Nat = 1;

  public shared ({ caller }) func createSale(input : SalesTypes.SaleInput) : async ?Common.SaleId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let result = SalesLib.createSale(
      saleStore, saleItemStore, batchStore, productStore, customerStore,
      userStore, caller, nextSaleId, input,
    );
    switch (result) {
      case (?_) { nextSaleId += 1 };
      case null {};
    };
    result
  };

  public shared query ({ caller }) func getSales() : async [SalesTypes.Sale] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSales(saleStore, userStore, caller)
  };

  public shared query ({ caller }) func getSalesByCustomer(customer_id : Common.CustomerId) : async [SalesTypes.Sale] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSalesByCustomer(saleStore, userStore, caller, customer_id)
  };

  public shared query ({ caller }) func getSale(sale_id : Common.SaleId) : async ?SalesTypes.Sale {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSale(saleStore, caller, sale_id)
  };

  public shared query ({ caller }) func getSaleItems(sale_id : Common.SaleId) : async [SalesTypes.SaleItem] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSaleItems(saleStore, saleItemStore, caller, sale_id)
  };
};
