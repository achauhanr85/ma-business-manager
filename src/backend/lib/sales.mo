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

  // ── Discount calculation helper ───────────────────────────────────────────────
  func computeDiscount(subtotal : Float, discountType : ?Common.DiscountType, discountValue : ?Float) : Float {
    switch (discountType, discountValue) {
      case (?#Percentage, ?pct) {
        let amount = subtotal * (pct / 100.0);
        if (amount > subtotal) subtotal else amount
      };
      case (?#Fixed, ?fixed) {
        if (fixed > subtotal) subtotal else fixed
      };
      case _ 0.0;
    }
  };

  // ── Build sale items from cart, deducting FIFO inventory ─────────────────────
  func buildItems(
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
    caller : Common.UserId,
    profileKey : Common.ProfileKey,
    warehouseName : Common.WarehouseName,
    saleId : Nat,
    cartItems : [SalesTypes.CartItem],
    now : Common.Timestamp,
  ) : ?(([SalesTypes.SaleItem], Float, Float, Float)) {
    var totalRevenue : Float = 0.0;
    var totalVP : Float = 0.0;
    var totalProfit : Float = 0.0;
    var saleItems : [SalesTypes.SaleItem] = [];

    for (item in cartItems.values()) {
      let product = switch (productStore.get(item.product_id)) {
        case (?p) p;
        case null return null;
      };
      if (product.profile_key != profileKey) return null;
      // Deduct FIFO — returns null if insufficient stock
      let avgCostOpt = InventoryLib.deductFIFO(batchStore, caller, profileKey, warehouseName, item.product_id, item.quantity);
      let avgCost = switch (avgCostOpt) {
        case (?c) c;
        case null return null;
      };
      let lineRevenue = item.actual_sale_price * item.quantity.toFloat();
      let lineProfit = (item.actual_sale_price - avgCost) * item.quantity.toFloat();
      let lineVP = product.volume_points * item.quantity.toFloat();
      totalRevenue += lineRevenue;
      totalVP += lineVP;
      totalProfit += lineProfit;
      let saleItem : SalesTypes.SaleItem = {
        sale_id = saleId;
        product_id = item.product_id;
        product_name_snapshot = product.name;
        unit_cost_snapshot = avgCost;
        mrp_snapshot = product.mrp;
        volume_points_snapshot = product.volume_points;
        quantity = item.quantity;
        actual_sale_price = item.actual_sale_price;
        // Who-columns for each line item
        created_by = caller;
        last_updated_by = caller;
        creation_date = now;
        last_update_date = now;
      };
      saleItems := saleItems.concat([saleItem]);
    };
    ?(saleItems, totalRevenue, totalVP, totalProfit)
  };

  // ── Return stock to inventory (FIFO unwind for order edits) ──────────────────
  func returnItemsToInventory(
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    caller : Common.UserId,
    profileKey : Common.ProfileKey,
    warehouseName : Common.WarehouseName,
    items : [SalesTypes.SaleItem],
    nextBatchId : Nat,
    now : Common.Timestamp,
  ) : Nat {
    var batchId = nextBatchId;
    for (item in items.values()) {
      let _ = InventoryLib.addBatch(batchStore, caller, profileKey, warehouseName, batchId, item.product_id, item.quantity, item.unit_cost_snapshot, now);
      batchId += 1;
    };
    batchId
  };

  // ── createSale ────────────────────────────────────────────────────────────────
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

    let now = Time.now();

    // Build sale items and deduct inventory
    let buildResult = buildItems(batchStore, productStore, caller, up.profile_key, up.warehouse_name, nextId, input.cart_items, now);
    let (saleItems, rawSubtotal, totalVP, totalProfit) = switch (buildResult) {
      case (?r) r;
      case null return null;
    };

    // Apply customer discount (snapshot discount type+value for historical audit)
    let discountType = customer.discount_applicable;
    let discountVal = customer.discount_value;
    let discountAmount = computeDiscount(rawSubtotal, discountType, discountVal);
    let finalRevenue = rawSubtotal - discountAmount;

    // Payment tracking
    let amountPaid = switch (input.amount_paid) { case (?a) a; case null 0.0 };
    let balanceDue = finalRevenue - amountPaid;

    let sale : SalesTypes.Sale = {
      id = nextId;
      profile_key = up.profile_key;
      timestamp = now;
      total_revenue = finalRevenue;
      total_volume_points = totalVP;
      total_profit = totalProfit;
      customer_id = input.customer_id;
      customer_name = customer.name;
      sold_by = caller;
      owner = caller;
      // Discount audit trail — stored at sale time, immutable for history
      original_subtotal = ?rawSubtotal;
      discount_type = discountType;
      discount_applied = ?discountAmount;
      // Payment tracking
      payment_mode = input.payment_mode;
      payment_status = input.payment_status;
      amount_paid = input.amount_paid;
      balance_due = ?balanceDue;
      // Who-columns
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    saleStore.add(nextId, sale);
    saleItemStore.add(nextId, saleItems);

    // Update customer stats with the post-discount revenue
    CustomersLib.recordSale(customerStore, input.customer_id, finalRevenue, now);

    ?nextId
  };

  // ── updateSale ────────────────────────────────────────────────────────────────
  // Only #admin or #superAdmin may update a sale. #staff and regular users are read-only.
  public func updateSale(
    saleStore : SaleStore,
    saleItemStore : SaleItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    input : SalesTypes.UpdateSaleInput,
    nextBatchId : Nat,
  ) : (Bool, Nat) {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null return (false, nextBatchId);
    };
    // Role check: only #admin or #superAdmin can update orders
    if (up.role != #admin and up.role != #superAdmin) {
      return (false, nextBatchId);
    };
    // Fetch the original sale and verify ownership
    let existingSale = switch (saleStore.get(input.sale_id)) {
      case (?s) s;
      case null return (false, nextBatchId);
    };
    if (existingSale.profile_key != up.profile_key) return (false, nextBatchId);

    // Fetch the customer (for re-applying current discount)
    let customer = switch (customerStore.get(existingSale.customer_id)) {
      case (?c) c;
      case null return (false, nextBatchId);
    };

    let now = Time.now();

    // Step 1: Reverse inventory — return original items back to stock
    let originalItems = switch (saleItemStore.get(input.sale_id)) {
      case (?items) items;
      case null [];
    };
    let batchIdAfterReturn = returnItemsToInventory(batchStore, caller, up.profile_key, up.warehouse_name, originalItems, nextBatchId, now);

    // Step 2: Deduct inventory for new items
    let buildResult = buildItems(batchStore, productStore, caller, up.profile_key, up.warehouse_name, input.sale_id, input.items, now);
    let (newSaleItems, newSubtotal, newTotalVP, newTotalProfit) = switch (buildResult) {
      case (?r) r;
      // If new items can't be deducted (e.g. out of stock), undo the stock return
      // by re-deducting the original items to restore pre-edit state.
      case null {
        // Best-effort restore: re-deduct original items
        for (item in originalItems.values()) {
          let _ = InventoryLib.deductFIFO(batchStore, caller, up.profile_key, up.warehouse_name, item.product_id, item.quantity);
        };
        return (false, nextBatchId);
      };
    };

    // Step 3: Recompute totals with customer discount (re-fetch live discount)
    let discountType = customer.discount_applicable;
    let discountVal = customer.discount_value;
    let discountAmount = computeDiscount(newSubtotal, discountType, discountVal);
    let finalRevenue = newSubtotal - discountAmount;
    let amountPaid = switch (input.amount_paid) { case (?a) a; case null 0.0 };
    let balanceDue = finalRevenue - amountPaid;

    // Step 4: Persist updated sale with new totals and who-columns
    saleStore.add(input.sale_id, {
      existingSale with
      total_revenue = finalRevenue;
      total_volume_points = newTotalVP;
      total_profit = newTotalProfit;
      original_subtotal = ?newSubtotal;
      discount_type = discountType;
      discount_applied = ?discountAmount;
      payment_mode = input.payment_mode;
      payment_status = input.payment_status;
      amount_paid = input.amount_paid;
      balance_due = ?balanceDue;
      // Who-columns: last_updated_by and last_update_date reflect this edit
      last_updated_by = caller;
      last_update_date = now;
    });

    // Step 5: Replace sale items
    saleItemStore.add(input.sale_id, newSaleItems);

    // Update customer lifetime revenue delta (new revenue - old revenue)
    let oldRevenue = existingSale.total_revenue;
    let revenueDelta = finalRevenue - oldRevenue;
    if (revenueDelta != 0.0) {
      CustomersLib.adjustRevenue(customerStore, existingSale.customer_id, revenueDelta, now);
    };

    (true, batchIdAfterReturn)
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

  public func getSale(saleStore : SaleStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, sale_id : Common.SaleId) : ?SalesTypes.Sale {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    switch (saleStore.get(sale_id)) {
      case (?s) {
        if (s.profile_key == up.profile_key) ?s else null
      };
      case null null;
    }
  };

  public func getSaleItems(saleStore : SaleStore, itemStore : SaleItemStore, userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId, sale_id : Common.SaleId) : [SalesTypes.SaleItem] {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    switch (saleStore.get(sale_id)) {
      case null [];
      case (?s) {
        if (s.profile_key != up.profile_key) return [];
        switch (itemStore.get(sale_id)) {
          case (?items) items;
          case null [];
        }
      };
    }
  };

  /// Fetch all orders for a customer with full detail (for History tab)
  public func getCustomerOrders(
    saleStore : SaleStore,
    saleItemStore : SaleItemStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customer_id : Common.CustomerId,
  ) : [SalesTypes.CustomerOrderDetail] {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    saleStore.entries()
      .filter(func((_id, s)) { s.profile_key == up.profile_key and s.customer_id == customer_id })
      .map<(Common.SaleId, SalesTypes.Sale), SalesTypes.CustomerOrderDetail>(func((_id, s)) {
        let items = switch (saleItemStore.get(s.id)) {
          case (?arr) arr;
          case null [];
        };
        { sale = s; items }
      })
      .toArray()
  };
};
