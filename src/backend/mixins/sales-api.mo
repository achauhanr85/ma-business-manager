import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import SalesTypes "../types/sales";
import CatalogLib "../lib/catalog";
import InventoryLib "../lib/inventory";
import SalesLib "../lib/sales";
import CustomersLib "../lib/customers";
import ProfileLib "../lib/profile";
import NotificationsLib "../lib/notifications";
mixin (
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
  batchStore : InventoryLib.BatchStore,
  productStore : CatalogLib.ProductStore,
  customerStore : CustomersLib.CustomerStore,
  userStore : ProfileLib.UserStore,
  profileStore : ProfileLib.Store,
  notificationsStore : NotificationsLib.Store,
) {
  var nextSaleId : Nat = 1;
  var nextSaleBatchId : Nat = 1;

  public shared ({ caller }) func createSale(input : SalesTypes.SaleInput) : async ?Common.SaleId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");

    switch (ProfileLib.checkProfileAccess(profileStore, userStore, caller)) {
      case (#err(_)) { return null };
      case (#ok) {};
    };

    let result = SalesLib.createSale(
      saleStore, saleItemStore, batchStore, productStore, customerStore,
      userStore, notificationsStore, caller, nextSaleId, input,
    );
    switch (result) {
      case (?_) { nextSaleId += 1 };
      case null {};
    };
    result
  };

  /// Edit a placed order — only #admin or #superAdmin may update.
  /// Stock from original items is returned before new items are deducted.
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
    SalesLib.getSale(saleStore, userStore, caller, sale_id)
  };

  public shared query ({ caller }) func getSaleItems(sale_id : Common.SaleId) : async [SalesTypes.SaleItem] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSaleItems(saleStore, saleItemStore, userStore, caller, sale_id)
  };

  /// Returns the full CustomerOrderDetail (sale header + all items) for a sale.
  /// Used by the History tab to avoid a second round-trip for items.
  public shared query ({ caller }) func getSaleWithItems(sale_id : Common.SaleId) : async ?SalesTypes.CustomerOrderDetail {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getSaleWithItems(saleStore, saleItemStore, userStore, caller, sale_id)
  };

  /// Returns the most recent sale (with its items) for a given customer and profile.
  /// Used for cart auto-fill (Copy from Previous Order) and return-order validation
  /// (must be ≤ 20 days since sale date to allow return).
  public shared query ({ caller }) func getLastSaleForCustomer(customer_id : Common.CustomerId) : async ?SalesTypes.CustomerOrderDetail {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getLastSaleForCustomer(saleStore, saleItemStore, userStore, caller, customer_id)
  };

  /// Returns aggregated referral commission data grouped by month and referral user,  /// scoped to the caller's profile_key.
  /// Only accessible by #admin or #superAdmin.
  public shared query ({ caller }) func getReferralCommissionByMonth() : async [Common.ReferralCommissionEntry] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let up = switch (userStore.get(caller)) {
      case (?u) u;
      case null Runtime.trap("Caller has no profile");
    };
    if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
    let profileKey = up.profile_key;

    // Build a map of referral-user-principal → display_name from userStore
    let referralDisplayNames = Map.empty<Common.UserId, Text>();
    for ((_uid, u) in userStore.entries()) {
      if (u.role == #referralUser and u.profile_key == profileKey) {
        referralDisplayNames.add(u.principal, u.display_name);
      };
    };

    // Accumulate: (month, referral_user_principal) → (total_commission, customer_count)
    // key = month # "|" # principalText
    let accMap = Map.empty<Text, (Float, Nat)>();

    // Iterate all customers in this profile who have both referred_by and referral_commission_amount
    for ((_cid, customer) in customerStore.entries()) {
      if (customer.profile_key == profileKey) {
        switch (customer.referred_by, customer.referral_commission_amount) {
          case (?refBy, ?commission) {
            // Find all sales for this customer
            for ((_sid, sale) in saleStore.entries()) {
              if (sale.profile_key == profileKey and sale.customer_id == customer.id) {
                // Derive month string "YYYY-MM" from sale.timestamp (nanoseconds)
                // timestamp in nanoseconds → seconds → use approximate division
                let tsSeconds : Int = sale.timestamp / 1_000_000_000;
                // Days since Unix epoch
                let days : Int = tsSeconds / 86400;
                // Approximate year and month using integer arithmetic
                // Using the proleptic Gregorian calendar algorithm
                let z = days + 719468;
                let era = (if (z >= 0) z else z - 146096) / 146097;
                let doe = z - era * 146097;
                let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
                let y = yoe + era * 400;
                let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
                let mp = (5 * doy + 2) / 153;
                let month = mp + (if (mp < 10) 3 else -9);
                let year = y + (if (month <= 2) 1 else 0);
                // Format as "YYYY-MM"
                let monthStr = if (month < 10) "0" # month.toText() else month.toText();
                let yearStr = year.toText();
                let periodKey = yearStr # "-" # monthStr # "|" # refBy;
                switch (accMap.get(periodKey)) {
                  case null {
                    accMap.add(periodKey, (commission, 1));
                  };
                  case (?(total, count)) {
                    accMap.add(periodKey, (total + commission, count + 1));
                  };
                };
              };
            };
          };
          case _ {};
        };
      };
    };

    // Convert accMap to result array
    accMap.entries()
      .map<(Text, (Float, Nat)), Common.ReferralCommissionEntry>(func((k, (total, count))) {
        // k = "YYYY-MM|principalOrName"
        let parts = k.split(#char '|').toArray();
        let month = if (parts.size() > 0) parts[0] else "";
        let refBy = if (parts.size() > 1) parts[1] else "";
        // Try to find a matching referral user by display_name or principal text
        var refPrincipal : Common.UserId = caller; // fallback
        var refDisplayName : Text = refBy;
        for ((_uid, u) in userStore.entries()) {
          if (u.role == #referralUser and u.profile_key == profileKey) {
            if (u.display_name == refBy or u.principal.toText() == refBy) {
              refPrincipal := u.principal;
              refDisplayName := u.display_name;
            };
          };
        };
        {
          referral_user_principal = refPrincipal;
          referral_user_display_name = refDisplayName;
          profile_key = profileKey;
          month;
          total_commission = total;
          customer_count = count;
        }
      })
      .toArray()
  };

  // ── Return Orders ─────────────────────────────────────────────────────────────

  /// Create a return order linked to an original sale.
  /// Validates: sale is within 20 days; each item was in the original order.
  /// Usable items go to Stage Inventory; non-usable are recorded only.
  public shared ({ caller }) func createReturnOrder(
    original_sale_id : Common.SaleId,
    return_items : [SalesTypes.ReturnItem],
  ) : async SalesTypes.ReturnOrderResult {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (ProfileLib.checkProfileAccess(profileStore, userStore, caller)) {
      case (#err(_)) { return { success = false; return_order_id = null; error = ?"Profile access denied" } };
      case (#ok) {};
    };
    let (result, newBatchId) = SalesLib.createReturnOrder(
      saleStore, saleItemStore, batchStore, customerStore, userStore, notificationsStore,
      caller, nextSaleId, nextSaleBatchId, original_sale_id, return_items,
    );
    if (result.success) {
      nextSaleId += 1;
      nextSaleBatchId := newBatchId;
    };
    result
  };

  // ── Payment History ───────────────────────────────────────────────────────────

  /// Add a payment entry to a sale. Recalculates payment_status from history total.
  /// Returns false if the sale is already fully paid.
  public shared ({ caller }) func addPaymentEntry(
    sale_id : Common.SaleId,
    amount : Float,
    payment_method : Text,
  ) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.addPaymentEntry(saleStore, userStore, caller, sale_id, amount, payment_method)
  };

  /// Returns all payment entries for a sale (ascending by date).
  public shared query ({ caller }) func getPaymentHistory(sale_id : Common.SaleId) : async [SalesTypes.PaymentEntry] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getPaymentHistory(saleStore, userStore, caller, sale_id)
  };
};
