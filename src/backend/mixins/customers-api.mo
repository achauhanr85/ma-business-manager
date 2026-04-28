import Runtime "mo:core/Runtime";
import Common "../types/common";
import CustomerTypes "../types/customers";
import SalesTypes "../types/sales";
import CustomersLib "../lib/customers";
import SalesLib "../lib/sales";
import ProfileLib "../lib/profile";

mixin (
  customerStore : CustomersLib.CustomerStore,
  bodyCompositionStore : CustomersLib.BodyCompositionStore,
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
  userStore : ProfileLib.UserStore,
) {
  var nextCustomerId : Nat = 1;
  var nextCustomerNoteId : Nat = 1;

  public shared query ({ caller }) func getCustomers() : async [CustomerTypes.CustomerPublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.getCustomers(customerStore, userStore, caller)
  };

  public shared query ({ caller }) func getCustomer(id : Common.CustomerId) : async ?CustomerTypes.CustomerPublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.getCustomer(customerStore, userStore, caller, id)
  };

  /// Fuzzy duplicate detection before saving a new customer
  public shared query ({ caller }) func checkCustomerDuplicate(name : Text) : async CustomerTypes.DuplicateCheckResult {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let profileKey = switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile");
    };
    CustomersLib.checkDuplicate(customerStore, profileKey, name)
  };

  /// Standard customer creation.
  /// If caller is a #referralUser, customer_type is forced to #lead regardless of input.
  public shared ({ caller }) func createCustomer(input : CustomerTypes.CustomerInput) : async Common.CustomerId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let callerRole = switch (userStore.get(caller)) {
      case (?up) up.role;
      case null Runtime.trap("Caller has no profile");
    };
    // Referral users always create leads
    let effectiveInput = if (callerRole == #referralUser) {
      { input with customer_type = ?#lead }
    } else {
      input
    };
    let id = CustomersLib.createCustomer(customerStore, userStore, caller, nextCustomerId, effectiveInput);
    nextCustomerId += 1;
    id
  };

  /// Creates a customer from the Sales page quick-add flow.
  /// customer_type is always forced to #active for sales-page additions.
  public shared ({ caller }) func createCustomerFromSales(input : CustomerTypes.CustomerInput) : async Common.CustomerId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let effectiveInput = { input with customer_type = ?#active };
    let id = CustomersLib.createCustomer(customerStore, userStore, caller, nextCustomerId, effectiveInput);
    nextCustomerId += 1;
    id
  };

  public shared ({ caller }) func updateCustomer(id : Common.CustomerId, input : CustomerTypes.CustomerInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.updateCustomer(customerStore, userStore, caller, id, input)
  };

  public shared ({ caller }) func deleteCustomer(id : Common.CustomerId) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.deleteCustomer(customerStore, userStore, caller, id)
  };

  /// Returns full order history for a customer — chronological list of sales + items.
  public shared query ({ caller }) func getCustomerOrders(customer_id : Common.CustomerId) : async [SalesTypes.CustomerOrderDetail] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getCustomerOrders(saleStore, saleItemStore, userStore, caller, customer_id)
  };

  // ── Body Composition History ──────────────────────────────────────────────────

  /// Create a body composition entry for a customer.
  public shared ({ caller }) func createBodyCompositionEntry(customerId : Common.CustomerId, input : CustomerTypes.BodyCompositionInput) : async ?CustomerTypes.BodyCompositionEntry {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.createBodyCompositionEntry(bodyCompositionStore, userStore, caller, customerId, input)
  };

  /// Returns the body composition history for a customer (newest first).
  public shared query ({ caller }) func getBodyCompositionHistory(customerId : Common.CustomerId) : async [CustomerTypes.BodyCompositionEntry] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.getBodyCompositionHistory(bodyCompositionStore, userStore, caller, customerId)
  };

  /// Delete a single body composition entry.
  public shared ({ caller }) func deleteBodyCompositionEntry(id : Text) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomersLib.deleteBodyCompositionEntry(bodyCompositionStore, userStore, caller, id)
  };
};
