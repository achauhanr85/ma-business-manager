/*
 * lib/sales.mo — Sales Order Business Logic
 *
 * WHAT THIS FILE DOES:
 *   Implements all business logic for sales orders and related operations:
 *     - createSale: builds cart items, deducts FIFO inventory, applies customer
 *       discount, records payment, notifies for loaned items, updates customer stats
 *     - updateSale: reverses original inventory, re-deducts for new items (Admin only)
 *     - createReturnOrder: validates 20-day window, validates items were in original order,
 *       creates new linked #return_ order, stages usable items to Stage Inventory
 *     - getSales / getSalesByCustomer / getSale / getSaleItems / getSaleWithItems
 *     - getLastSaleForCustomer: finds latest sale (used for "copy from previous order")
 *     - getCustomerOrders: all orders for a customer (history tab)
 *     - addPaymentEntry: appends a payment to the history array and recalculates status
 *     - getPaymentHistory: returns payment entries sorted by date
 *
 * WHO USES IT:
 *   mixins/sales-api.mo (public API layer)
 *
 * KEY DESIGN DECISIONS:
 *   - Product name, MRP, cost are SNAPSHOTTED on each SaleItem at sale time
 *     (no live inventory lookup needed for receipts or history)
 *   - Payment status is DERIVED from payment history total vs order total
 *     (not stored as a raw editable field after first payment entry)
 *   - Once a sale is marked #Paid, addPaymentEntry returns false (immutable)
 *   - Return orders create a NEW sale record linked to the original (return_of_sale_id)
 *   - Usable return items go to Stage Inventory (warehouse_name="Stage") for review
 *
 * FIFO:
 *   InventoryLib.deductFIFO() removes stock from the oldest batch first.
 *   If stock is insufficient for any line item, the entire sale is rolled back.
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import SalesTypes "../types/sales";
import CatalogTypes "../types/catalog";
import InventoryTypes "../types/inventory";
import CustomerTypes "../types/customers";
import UserTypes "../types/users";
import NotificationsLib "notifications";
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
      let isLoanedItem = switch (item.is_loaned_item) { case (?v) v; case null false };
      let saleItem : SalesTypes.SaleItem = {
        sale_id = saleId;
        product_id = item.product_id;
        product_name_snapshot = product.name;
        unit_cost_snapshot = avgCost;
        mrp_snapshot = product.mrp;
        volume_points_snapshot = product.volume_points;
        quantity = item.quantity;
        actual_sale_price = item.actual_sale_price;
        product_instructions = item.product_instructions;
        is_loaned_item = isLoanedItem;
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
    notificationsStore : NotificationsLib.Store,
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
      payment_due_date = input.payment_due_date;
      // Per-sale note
      sale_note = input.sale_note;
      // Payment history — starts empty; entries added via addPaymentEntry
      payment_history = [];
      // Order type — default to #standard when not specified
      order_type = switch (input.order_type) { case (?ot) ?ot; case null ?#standard };
      return_of_sale_id = input.return_of_sale_id;
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

    // Notify admin for any loaned items sold
    let sellerName = up.display_name;
    for (item in saleItems.values()) {
      if (item.is_loaned_item) {
        NotificationsLib.notifyLoanedItemSold(
          notificationsStore,
          up.profile_key,
          item.product_name_snapshot,
          item.quantity,
          sellerName,
          nextId,
        );
      };
    };

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
      payment_due_date = input.payment_due_date;
      sale_note = input.sale_note;
      // payment_history is preserved from existingSale (not touched on edit)
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

  /// Return the full CustomerOrderDetail (sale + items) for a single sale_id.
  /// Returns null if the sale does not exist or does not belong to the caller's profile.
  public func getSaleWithItems(
    saleStore : SaleStore,
    saleItemStore : SaleItemStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    sale_id : Common.SaleId,
  ) : ?SalesTypes.CustomerOrderDetail {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    switch (saleStore.get(sale_id)) {
      case null null;
      case (?sale) {
        if (sale.profile_key != up.profile_key) return null;
        let items = switch (saleItemStore.get(sale_id)) {
          case (?arr) arr;
          case null [];
        };
        ?{ sale; items }
      };
    }
  };

  /// Return the most recent sale (with its items) for a given customer in the caller's profile.
  /// Finds the sale with the highest timestamp; returns null if no sales exist for that customer.
  public func getLastSaleForCustomer(
    saleStore : SaleStore,
    saleItemStore : SaleItemStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customer_id : Common.CustomerId,
  ) : ?SalesTypes.CustomerOrderDetail {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    // Find the sale with the latest timestamp for this customer in this profile
    var bestSale : ?SalesTypes.Sale = null;
    for ((_id, sale) in saleStore.entries()) {
      if (sale.profile_key == up.profile_key and sale.customer_id == customer_id) {
        switch (bestSale) {
          case null { bestSale := ?sale };
          case (?prev) {
            if (sale.timestamp > prev.timestamp) {
              bestSale := ?sale;
            };
          };
        };
      };
    };
    switch (bestSale) {
      case null null;
      case (?sale) {
        let items = switch (saleItemStore.get(sale.id)) {
          case (?arr) arr;
          case null [];
        };
        ?{ sale; items }
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

  /// Create a return order linked to an original sale.
  /// Validates: original sale is within 20 days; each return item was part of the original order.
  /// Usable items are staged in Stage Inventory. Non-usable items are only recorded.
  /// Returns a ReturnOrderResult with success flag, new order ID, and error message if any.
  public func createReturnOrder(
    saleStore : SaleStore,
    saleItemStore : SaleItemStore,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    _customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    _notificationsStore : NotificationsLib.Store,
    caller : Common.UserId,
    nextSaleId : Nat,
    nextBatchId : Nat,
    originalSaleId : Common.SaleId,
    returnItems : [SalesTypes.ReturnItem],
  ) : (SalesTypes.ReturnOrderResult, Nat) {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null return ({ success = false; return_order_id = null; error = ?"Caller has no profile" }, nextBatchId);
    };

    // Fetch the original sale
    let originalSale = switch (saleStore.get(originalSaleId)) {
      case (?s) s;
      case null return ({ success = false; return_order_id = null; error = ?"Original sale not found" }, nextBatchId);
    };
    if (originalSale.profile_key != up.profile_key) {
      return ({ success = false; return_order_id = null; error = ?"Sale not in caller's profile" }, nextBatchId);
    };

    // Validate: sale must be within 20 days (20 * 24 * 3600 * 1_000_000_000 nanoseconds)
    let now = Time.now();
    let twentyDaysNs : Int = 20 * 24 * 3600 * 1_000_000_000;
    if (now - originalSale.timestamp > twentyDaysNs) {
      return ({ success = false; return_order_id = null; error = ?"Return period of 20 days has expired" }, nextBatchId);
    };

    // Fetch original items
    let originalItems = switch (saleItemStore.get(originalSaleId)) {
      case (?items) items;
      case null [];
    };

    // Validate each return item was part of the original sale
    for (ri in returnItems.values()) {
      let found = originalItems.find(func(si : SalesTypes.SaleItem) : Bool { si.product_id == ri.product_id });
      if (found == null) {
        return ({ success = false; return_order_id = null; error = ?("Product not in original sale: " # ri.product_id.toText()) }, nextBatchId);
      };
    };

    // Build return sale items
    var returnSaleItems : [SalesTypes.SaleItem] = [];
    var totalRevenue : Float = 0.0;
    for (ri in returnItems.values()) {
      let si : SalesTypes.SaleItem = {
        sale_id = nextSaleId;
        product_id = ri.product_id;
        product_name_snapshot = switch (originalItems.find(func(o : SalesTypes.SaleItem) : Bool { o.product_id == ri.product_id })) {
          case (?o) o.product_name_snapshot;
          case null "";
        };
        unit_cost_snapshot = ri.unit_price;
        mrp_snapshot = ri.unit_price;
        volume_points_snapshot = 0.0;
        quantity = ri.qty;
        actual_sale_price = ri.unit_price;
        product_instructions = null;
        is_loaned_item = false;
        created_by = caller;
        last_updated_by = caller;
        creation_date = now;
        last_update_date = now;
      };
      returnSaleItems := returnSaleItems.concat([si]);
      totalRevenue += ri.unit_price * ri.qty.toFloat();
    };

    // Persist return order record
    let returnSale : SalesTypes.Sale = {
      id = nextSaleId;
      profile_key = up.profile_key;
      timestamp = now;
      total_revenue = totalRevenue;
      total_volume_points = 0.0;
      total_profit = 0.0;
      customer_id = originalSale.customer_id;
      customer_name = originalSale.customer_name;
      sold_by = caller;
      owner = caller;
      original_subtotal = ?totalRevenue;
      discount_type = null;
      discount_applied = ?0.0;
      payment_mode = null;
      payment_status = ?#Paid;    // Returns are considered settled
      amount_paid = ?totalRevenue;
      balance_due = ?0.0;
      payment_due_date = null;
      sale_note = ?("Return for order #" # originalSaleId.toText());
      payment_history = [];
      order_type = ?#return_;
      return_of_sale_id = ?originalSaleId;
      created_by = caller;
      last_updated_by = caller;
      creation_date = now;
      last_update_date = now;
    };
    saleStore.add(nextSaleId, returnSale);
    saleItemStore.add(nextSaleId, returnSaleItems);

    // Move usable items to Stage Inventory
    var currentBatchId = nextBatchId;
    for (ri in returnItems.values()) {
      if (ri.is_usable) {
        let _ = InventoryLib.moveToStageInventory(
          batchStore, caller, up.profile_key,
          ri.product_id, ri.qty, ri.unit_price,
          currentBatchId, nextSaleId,
        );
        currentBatchId += 1;
      };
    };

    ({ success = true; return_order_id = ?nextSaleId; error = null }, currentBatchId)
  };

  /// Append a payment entry to a sale and recalculate payment_status.
  /// payment_status is DERIVED: #unpaid (0 paid), #partial (partial), #paid (full).
  /// Returns false if the sale is already fully paid.
  public func addPaymentEntry(
    saleStore : SaleStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    saleId : Common.SaleId,
    amount : Float,
    paymentMethod : Text,
  ) : Bool {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    switch (saleStore.get(saleId)) {
      case null false;
      case (?sale) {
        if (sale.profile_key != up.profile_key) return false;
        // Block adding payments to already-paid orders
        switch (sale.payment_status) {
          case (?#Paid) return false;
          case _ {};
        };
        let now = Time.now();
        let newEntry : SalesTypes.PaymentEntry = {
          id = saleId.toText() # "_pmt_" # sale.payment_history.size().toText();
          payment_date = now;
          amount;
          payment_method = paymentMethod;
          recorded_by = up.display_name;
        };
        let updatedHistory = sale.payment_history.concat([newEntry]);
        // Recalculate totals from full history
        let totalPaid = updatedHistory.foldLeft(0.0, func(acc : Float, e : SalesTypes.PaymentEntry) : Float { acc + e.amount });
        let revenue = sale.total_revenue;
        let balanceDue = revenue - totalPaid;
        let newStatus : Common.PaymentStatus = if (totalPaid <= 0.0) #Unpaid
          else if (totalPaid >= revenue) #Paid
          else #Partial;
        saleStore.add(saleId, {
          sale with
          payment_history = updatedHistory;
          amount_paid = ?totalPaid;
          balance_due = ?balanceDue;
          payment_status = ?newStatus;
          last_updated_by = caller;
          last_update_date = now;
        });
        true
      };
    }
  };

  /// Returns all payment entries for a sale, sorted by payment_date ascending.
  public func getPaymentHistory(
    saleStore : SaleStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    saleId : Common.SaleId,
  ) : [SalesTypes.PaymentEntry] {
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    switch (saleStore.get(saleId)) {
      case null [];
      case (?sale) {
        if (sale.profile_key != up.profile_key) return [];
        sale.payment_history.sort(func(a, b) {
          if (a.payment_date < b.payment_date) #less
          else if (a.payment_date > b.payment_date) #greater
          else #equal
        })
      };
    }
  };
};
