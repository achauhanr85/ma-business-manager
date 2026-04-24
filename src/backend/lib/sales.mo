import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Time "mo:core/Time";
import Common "../types/common";
import SalesTypes "../types/sales";
import CatalogTypes "../types/catalog";
import InventoryTypes "../types/inventory";
import InventoryLib "inventory";

module {
  public type SaleStore = Map.Map<Common.SaleId, SalesTypes.Sale>;
  public type SaleItemStore = List.List<SalesTypes.SaleItem>;

  public func createSale(
    saleStore : SaleStore,
    saleItemStore : SaleItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
    caller : Common.UserId,
    nextId : Nat,
    cartItems : [SalesTypes.CartItem],
  ) : ?Common.SaleId {
    // Validate cart is non-empty
    if (cartItems.size() == 0) return null;

    // First pass: validate all products exist and check stock
    for (item in cartItems.vals()) {
      switch (productStore.get(item.product_id)) {
        case null return null; // Product not found
        case (?_prod) {};
      };
    };

    // Second pass: perform FIFO deductions and build sale items
    let saleItems = List.empty<SalesTypes.SaleItem>();
    var totalRevenue : Float = 0.0;
    var totalVP : Float = 0.0;
    var totalProfit : Float = 0.0;
    let saleId = nextId;

    for (item in cartItems.vals()) {
      let prod = switch (productStore.get(item.product_id)) {
        case (?p) p;
        case null return null;
      };

      // FIFO deduction
      let unitCost = switch (InventoryLib.deductFIFO(batchStore, caller, item.product_id, item.quantity)) {
        case (?cost) cost;
        case null return null; // Insufficient stock
      };

      let revenue = item.actual_sale_price * item.quantity.toFloat();
      let profit = (item.actual_sale_price - unitCost) * item.quantity.toFloat();
      let vp = prod.volume_points * item.quantity.toFloat();

      totalRevenue := totalRevenue + revenue;
      totalVP := totalVP + vp;
      totalProfit := totalProfit + profit;

      saleItems.add({
        sale_id = saleId;
        product_id = item.product_id;
        product_name_snapshot = prod.name;
        unit_cost_snapshot = unitCost;
        mrp_snapshot = prod.mrp;
        volume_points_snapshot = prod.volume_points;
        quantity = item.quantity;
        actual_sale_price = item.actual_sale_price;
      });
    };

    let sale : SalesTypes.Sale = {
      id = saleId;
      timestamp = Time.now();
      total_revenue = totalRevenue;
      total_volume_points = totalVP;
      total_profit = totalProfit;
      owner = caller;
    };

    saleStore.add(saleId, sale);
    saleItemStore.addAll(saleItems.values());
    ?saleId;
  };

  public func getSales(store : SaleStore, caller : Common.UserId) : [SalesTypes.Sale] {
    let result = List.empty<SalesTypes.Sale>();
    for ((_, sale) in store.entries()) {
      if (Principal.equal(sale.owner, caller)) {
        result.add(sale);
      };
    };
    // Sort by timestamp descending (newest first)
    result.sort(func(a, b) { Int.compare(b.timestamp, a.timestamp) }).toArray();
  };

  public func getSale(saleStore : SaleStore, caller : Common.UserId, sale_id : Common.SaleId) : ?SalesTypes.Sale {
    switch (saleStore.get(sale_id)) {
      case (?sale) {
        if (Principal.equal(sale.owner, caller)) ?sale else null
      };
      case null null;
    };
  };

  public func getSaleItems(saleStore : SaleStore, itemStore : SaleItemStore, caller : Common.UserId, sale_id : Common.SaleId) : [SalesTypes.SaleItem] {
    // Verify caller owns the sale
    switch (saleStore.get(sale_id)) {
      case (?sale) {
        if (not Principal.equal(sale.owner, caller)) return [];
        itemStore.filter(func(item) { item.sale_id == sale_id }).toArray();
      };
      case null [];
    };
  };
};
