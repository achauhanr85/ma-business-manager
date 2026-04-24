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
  profileStore : ProfileLib.Store,
) {
  var nextSaleId : Nat = 1;
  var nextSaleBatchId : Nat = 1;

  public shared ({ caller }) func createSale(input : SalesTypes.SaleInput) : async ?Common.SaleId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");

    // Dry-run — Governance Gatekeeper (Sale):
    //   checkProfileAccess verifies two conditions before allowing any transaction:
    //   1. profile.is_enabled == true    → else traps with variant #ProfileDisabled
    //   2. current time within [start_date, end_date] window → else #OutsideActiveWindow
    //   Example scenario: profile end_date = yesterday → now > end_date
    //     → checkProfileAccess returns #err(#OutsideActiveWindow)
    //     → createSale returns null (equivalent to HTTP 403 for the frontend)
    //   The frontend maps null + stored error variant to the appropriate user message.
    //   This runs BEFORE any inventory deduction, ensuring atomicity is preserved.
    switch (ProfileLib.checkProfileAccess(profileStore, userStore, caller)) {
      case (#err(_)) { return null };
      case (#ok) {};
    };

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

  /// Edit a placed order — replaces cart items, recomputes discount & balance.
  /// Stock from original items is returned before new items are deducted.
  /// Governance check applies: editing is blocked if the profile is outside its active window.
  public shared ({ caller }) func updateSale(input : SalesTypes.UpdateSaleInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (ProfileLib.checkProfileAccess(profileStore, userStore, caller)) {
      case (#err(_)) { return false };
      case (#ok) {};
    };
    let (ok, newBatchId) = SalesLib.updateSale(
      saleStore, saleItemStore, batchStore, productStore, customerStore,
      userStore, caller, input, nextSaleBatchId,
    );
    if (ok) { nextSaleBatchId := newBatchId };
    ok
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
