import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import SalesTypes "../types/sales";
import CatalogTypes "../types/catalog";
import InventoryTypes "../types/inventory";
import CustomerTypes "../types/customers";
import UserTypes "../types/users";
import InventoryLib "inventory";
import CustomersLib "customers";

module {
  public type SaleStore = Map.Map<Common.SaleId, SalesTypes.Sale>;
  public type SaleItemStore = Map.Map<Common.SaleId, [SalesTypes.SaleItem]>;

  public func createSale(
    saleStore : SaleStore,
    saleItemStore : SaleItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    nextId : Nat,
    input : SalesTypes.SaleInput,
  ) : ?Common.SaleId {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    // Verify customer belongs to this profile
    let customer = switch (customerStore.get(input.customer_id)) {
      case (?c) c;
      case null return null;
    };
    if (customer.profile_key != up.profile_key) return null;

    // Build sale items and deduct inventory
    var totalRevenue : Float = 0.0;
    var totalVP : Float = 0.0;
    var totalProfit : Float = 0.0;
    var saleItems : [SalesTypes.SaleItem] = [];

    for (item in input.cart_items.values()) {
      let product = switch (productStore.get(item.product_id)) {
        case (?p) p;
        case null return null; // product not found
      };
      if (product.profile_key != up.profile_key) return null;
      // Deduct FIFO
      let avgCostOpt = InventoryLib.deductFIFO(batchStore, caller, up.profile_key, up.warehouse_name, item.product_id, item.quantity);
      let avgCost = switch (avgCostOpt) {
        case (?c) c;
        case null return null; // insufficient stock
      };
      let lineRevenue = item.actual_sale_price * item.quantity.toFloat();
      let lineProfit = (item.actual_sale_price - avgCost) * item.quantity.toFloat();
      let lineVP = product.volume_points * item.quantity.toFloat();
      totalRevenue += lineRevenue;
      totalVP += lineVP;
      totalProfit += lineProfit;
      let saleItem : SalesTypes.SaleItem = {
        sale_id = nextId;
        product_id = item.product_id;
        product_name_snapshot = product.name;
        unit_cost_snapshot = avgCost;
        mrp_snapshot = product.mrp;
        volume_points_snapshot = product.volume_points;
        quantity = item.quantity;
        actual_sale_price = item.actual_sale_price;
      };
      saleItems := saleItems.concat([saleItem]);
    };

    let now = Time.now();
    let sale : SalesTypes.Sale = {
      id = nextId;
      profile_key = up.profile_key;
      timestamp = now;
      total_revenue = totalRevenue;
      total_volume_points = totalVP;
      total_profit = totalProfit;
      customer_id = input.customer_id;
      customer_name = customer.name;
      sold_by = caller;
      owner = caller;
    };
    saleStore.add(nextId, sale);
    saleItemStore.add(nextId, saleItems);

    // Update customer stats
    CustomersLib.recordSale(customerStore, input.customer_id, totalRevenue, now);

    ?nextId
  };

  public func getSales(store : SaleStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) : [SalesTypes.Sale] {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    store.entries()
      .filter(func((_id, s)) { s.profile_key == up.profile_key })
      .map<(Common.SaleId, SalesTypes.Sale), SalesTypes.Sale>(func((_id, s)) { s })
      .toArray()
  };

  public func getSalesByCustomer(store : SaleStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, customer_id : Common.CustomerId) : [SalesTypes.Sale] {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    store.entries()
      .filter(func((_id, s)) { s.profile_key == up.profile_key and s.customer_id == customer_id })
      .map<(Common.SaleId, SalesTypes.Sale), SalesTypes.Sale>(func((_id, s)) { s })
      .toArray()
  };

  public func getSale(saleStore : SaleStore, caller : Common.UserId, sale_id : Common.SaleId) : ?SalesTypes.Sale {
    switch (saleStore.get(sale_id)) {
      case (?s) {
        if (s.owner == caller or s.sold_by == caller) ?s
        else null
      };
      case null null;
    }
  };

  public func getSaleItems(saleStore : SaleStore, itemStore : SaleItemStore, caller : Common.UserId, sale_id : Common.SaleId) : [SalesTypes.SaleItem] {
    switch (saleStore.get(sale_id)) {
      case null [];
      case (?s) {
        if (s.owner != caller and s.sold_by != caller) return [];
        switch (itemStore.get(sale_id)) {
          case (?items) items;
          case null [];
        }
      };
    }
  };
};
