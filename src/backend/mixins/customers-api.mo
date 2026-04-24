import Runtime "mo:core/Runtime";
import Common "../types/common";
import CustomerTypes "../types/customers";
import SalesTypes "../types/sales";
import CustomersLib "../lib/customers";
import SalesLib "../lib/sales";
import ProfileLib "../lib/profile";

mixin (
  customerStore : CustomersLib.CustomerStore,
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
  userStore : ProfileLib.UserStore,
) {
  var nextCustomerId : Nat = 1;

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

  public shared ({ caller }) func createCustomer(input : CustomerTypes.CustomerInput) : async Common.CustomerId {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let id = CustomersLib.createCustomer(customerStore, userStore, caller, nextCustomerId, input);
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
  /// Used by the customer profile History tab.
  public shared query ({ caller }) func getCustomerOrders(customer_id : Common.CustomerId) : async [SalesTypes.CustomerOrderDetail] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    SalesLib.getCustomerOrders(saleStore, saleItemStore, userStore, caller, customer_id)
  };
};
