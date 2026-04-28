import Map "mo:core/Map";
import Time "mo:core/Time";
import Common "../types/common";
import SalesTypes "../types/sales";
import UserTypes "../types/users";
import ProfileTypes "../types/profile";
import CustomerTypes "../types/customers";

module {
  // ── Types ─────────────────────────────────────────────────────────────────────

  public type Notification = {
    id : Text;
    profile_key : Text;
    notification_type : Text;  // "StaffPendingApproval" | "PaymentOverdue" | "CustomerFollowUp" | "LoanedItemSold"
    message : Text;
    related_id : ?Text;
    is_read : Bool;
    created_at : Common.Timestamp;
    target_role : Text;        // "admin" | "staff" | "all" | "superAdmin" | "user:<principalText>"
  };

  public type Store = Map.Map<Text, Notification>;

  // ── Deduplication helper ──────────────────────────────────────────────────────

  /// Returns true if an unread notification of the given type already exists for
  /// (profileKey, notificationType, relatedId).  Used to prevent duplicate alerts.
  public func notificationExists(
    store : Store,
    profileKey : Text,
    notificationType : Text,
    relatedId : ?Text,
  ) : Bool {
    store.entries().any(func((_nid, n) : (Text, Notification)) : Bool {
      n.profile_key == profileKey
      and n.notification_type == notificationType
      and n.related_id == relatedId
      and not n.is_read
    })
  };

  // ── Read ──────────────────────────────────────────────────────────────────────

  /// Returns unread notifications for the given profile and target role.
  /// Also returns notifications targeted to a specific user principal (target_role = "user:<principal>").
  public func getNotifications(store : Store, profileKey : Text, targetRole : Text) : [Notification] {
    store.entries()
      .filter(func((_id, n) : (Text, Notification)) : Bool {
        n.profile_key == profileKey
        and not n.is_read
        and (n.target_role == targetRole or n.target_role == "all")
      })
      .map(func((_id, n) : (Text, Notification)) : Notification { n })
      .toArray()
  };

  /// Returns all unread notifications whose target_role matches "user:<principalText>".
  /// Used to fetch welcome and personal notifications for a specific user.
  public func getNotificationsForUser(store : Store, principalText : Text) : [Notification] {
    let target = "user:" # principalText;
    store.entries()
      .filter(func((_id, n) : (Text, Notification)) : Bool {
        not n.is_read and n.target_role == target
      })
      .map(func((_id, n) : (Text, Notification)) : Notification { n })
      .toArray()
  };

  // ── Write ─────────────────────────────────────────────────────────────────────

  /// Creates a new notification with a generated id.
  public func createNotification(
    store : Store,
    profileKey : Text,
    notificationType : Text,
    message : Text,
    relatedId : ?Text,
    targetRole : Text,
  ) : Notification {
    let now = Time.now();
    let id = profileKey # "-notif-" # now.toText() # "-" # store.size().toText();
    let notif : Notification = {
      id;
      profile_key = profileKey;
      notification_type = notificationType;
      message;
      related_id = relatedId;
      is_read = false;
      created_at = now;
      target_role = targetRole;
    };
    store.add(id, notif);
    notif
  };

  /// Marks a notification as read.
  public func markNotificationRead(store : Store, notificationId : Text) : Bool {
    switch (store.get(notificationId)) {
      case null false;
      case (?n) {
        store.add(notificationId, { n with is_read = true });
        true
      };
    }
  };

  /// Creates a one-time welcome notification for a brand-new user principal.
  /// Targeted to "user:<principal>" so it only appears in that user's notification panel.
  /// Skipped if a welcome notification already exists (read or unread) for this principal.
  public func createWelcomeNotification(store : Store, principal : Common.UserId) : ?Notification {
    let principalText = principal.toText();
    let target = "user:" # principalText;
    // Skip if one already exists (even if already read)
    let alreadyExists = store.entries().any(func((_nid, n) : (Text, Notification)) : Bool {
      n.notification_type == "Welcome" and n.target_role == target
    });
    if (alreadyExists) return null;
    ?createNotification(
      store,
      "system",
      "Welcome",
      "Welcome to Indi Negocio Livre! Start by creating your business profile or joining an existing one.",
      null,
      target,
    )
  };

  /// Creates a LoanedItemSold notification targeting "admin".
  /// Called after a sale containing is_loaned_item=true line items.
  public func notifyLoanedItemSold(
    store : Store,
    profileKey : Text,
    itemName : Text,
    quantity : Nat,
    sellerName : Text,
    saleId : Nat,
  ) {
    let saleIdText = saleId.toText();
    if (not notificationExists(store, profileKey, "LoanedItemSold", ?saleIdText)) {
      let _ = createNotification(
        store,
        profileKey,
        "LoanedItemSold",
        "Loaned item sold: " # itemName # " x" # quantity.toText() # " by " # sellerName # ". Payout/replacement owed to source.",
        ?saleIdText,
        "admin",
      );
    };
  };

  // ── Background checks ─────────────────────────────────────────────────────────

  /// Checks all sales with a payment_due_date set and payment_status != #Paid.
  /// Creates a PaymentOverdue notification for any overdue sale (due_date < now).
  /// Returns count of new notifications created.
  public func checkOverduePayments(
    store : Store,
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    profileKey : Text,
  ) : Nat {
    let now = Time.now();
    var count = 0;
    // We look for sales with unpaid/partial status; treat creation_date as implicit due if none stored
    // Since Sale type does not have payment_due_date, we use creation_date + 30 days as threshold
    // to detect "long overdue" sales. (payment_due_date field is a planned frontend-only feature)
    let thirtyDaysNs : Int = 30 * 24 * 60 * 60 * 1_000_000_000;
    for ((_id, sale) in saleStore.entries()) {
      if (sale.profile_key == profileKey) {
        let isUnpaid = switch (sale.payment_status) {
          case (?(#Unpaid)) true;
          case (?(#Partial)) true;
          case _ false;
        };
        if (isUnpaid and (now - sale.creation_date) > thirtyDaysNs) {
          let saleIdText = sale.id.toText();
          if (not notificationExists(store, profileKey, "PaymentOverdue", ?saleIdText)) {
            let _ = createNotification(
              store, profileKey, "PaymentOverdue",
              "Payment overdue for sale #" # saleIdText # " - Customer: " # sale.customer_name,
              ?saleIdText, "admin"
            );
            count += 1;
          };
        };
      };
    };
    count
  };

  /// Checks latest sale per customer in the profile.
  /// If last sale was > 20 days ago, creates a CustomerFollowUp notification.
  /// Returns count of new notifications created.
  public func checkCustomerFollowUp(
    store : Store,
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    profileKey : Text,
  ) : Nat {
    let now = Time.now();
    let twentyDaysNs : Int = 1_728_000_000_000_000;
    var count = 0;

    // Build map of customerId -> latest sale timestamp
    let latestSaleByCustomer = Map.empty<Common.CustomerId, (Common.Timestamp, Text)>();
    for ((_id, sale) in saleStore.entries()) {
      if (sale.profile_key == profileKey) {
        switch (latestSaleByCustomer.get(sale.customer_id)) {
          case null {
            latestSaleByCustomer.add(sale.customer_id, (sale.timestamp, sale.customer_name));
          };
          case (?(ts, name)) {
            if (sale.timestamp > ts) {
              latestSaleByCustomer.add(sale.customer_id, (sale.timestamp, name));
            };
          };
        };
      };
    };

    for ((_custId, (lastTs, custName)) in latestSaleByCustomer.entries()) {
      if ((now - lastTs) > twentyDaysNs) {
        let custIdText = _custId.toText();
        if (not notificationExists(store, profileKey, "CustomerFollowUp", ?custIdText)) {
          let _ = createNotification(
            store, profileKey, "CustomerFollowUp",
            "No order from customer " # custName # " in the last 20 days. Follow up!",
            ?custIdText, "staff"
          );
          count += 1;
        };
      };
    };
    count
  };

  /// Checks for profiles still in #pending_super_admin_approval state.
  /// Creates a #NewProfilePendingApproval reminder notification for Super Admin
  /// if one doesn't already exist (unread) for that profile.
  /// Returns count of new notifications created.
  public func checkPendingProfiles(
    store : Store,
    profileStore : Map.Map<Common.ProfileKey, ProfileTypes.Profile>,
  ) : Nat {
    var count = 0;
    for ((_k, profile) in profileStore.entries()) {
      if (profile.profile_approval_status == #pending_super_admin_approval) {
        if (not notificationExists(store, "superadmin", "NewProfilePendingApproval", ?profile.profile_key)) {
          let _ = createNotification(
            store,
            "superadmin",
            "NewProfilePendingApproval",
            "Business profile '" # profile.business_name # "' (key: " # profile.profile_key # ") is still pending Super Admin approval.",
            ?profile.profile_key,
            "superAdmin",
          );
          count += 1;
        };
      };
    };
    count
  };

  /// Runs overdue-payment and customer-follow-up checks for a single profile.
  /// Returns total count of new notifications created.
  public func runChecksForProfile(
    store : Store,
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    profileKey : Text,
  ) : Nat {
    let c1 = checkOverduePayments(store, saleStore, profileKey);
    let c2 = checkCustomerFollowUp(store, saleStore, profileKey);
    c1 + c2
  };

  // ── 3-month inactivity silent update ─────────────────────────────────────────

  /// Silently marks customers as #inactive if they have had no sales for 90+ days.
  /// No notification is emitted — this is a silent background operation only.
  /// customersStore is the live Map of customers (mutated in place via store.add).
  public func checkCustomerInactivity(
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    profileKey : Text,
  ) {
    let now = Time.now();
    let ninetyDaysNs : Int = 7_776_000_000_000_000;

    // Build map of customerId -> latest sale timestamp for this profile
    let latestSaleByCustomer = Map.empty<Common.CustomerId, Common.Timestamp>();
    for ((_id, sale) in saleStore.entries()) {
      if (sale.profile_key == profileKey) {
        switch (latestSaleByCustomer.get(sale.customer_id)) {
          case null {
            latestSaleByCustomer.add(sale.customer_id, sale.timestamp);
          };
          case (?ts) {
            if (sale.timestamp > ts) {
              latestSaleByCustomer.add(sale.customer_id, sale.timestamp);
            };
          };
        };
      };
    };

    // Check each customer in this profile
    for ((_id, customer) in customerStore.entries()) {
      if (customer.profile_key == profileKey) {
        // Only check non-inactive customers
        switch (customer.customer_type) {
          case (#inactive) {}; // already inactive — skip
          case _ {
            let shouldMarkInactive = switch (latestSaleByCustomer.get(customer.id)) {
              case (?lastSaleTs) {
                // Has sales — check if last sale > 90 days ago
                (now - lastSaleTs) > ninetyDaysNs
              };
              case null {
                // No sales at all — check if creation date > 90 days ago
                (now - customer.creation_date) > ninetyDaysNs
              };
            };
            if (shouldMarkInactive) {
              // Silent update — no notification
              customerStore.add(customer.id, {
                customer with
                customer_type = #inactive;
                last_update_date = now;
              });
            };
          };
        };
      };
    };
  };

  // ── Lead follow-up due notification ──────────────────────────────────────────

  /// Checks all #lead customers in the profile whose lead_follow_up_date has arrived.
  /// Fires a #LeadFollowUpDue notification to Admin only (no duplicates).
  /// Returns count of new notifications created.
  public func checkLeadFollowUp(
    store : Store,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    profileKey : Text,
    _adminPrincipal : Common.UserId,
  ) : Nat {
    let now = Time.now();
    var count = 0;

    for ((_id, customer) in customerStore.entries()) {
      if (customer.profile_key == profileKey) {
        switch (customer.customer_type) {
          case (#lead) {
            switch (customer.lead_follow_up_date) {
              case (?followUpDate) {
                if (followUpDate <= now) {
                  let custIdText = customer.id.toText();
                  if (not notificationExists(store, profileKey, "LeadFollowUpDue", ?custIdText)) {
                    let _ = createNotification(
                      store, profileKey, "LeadFollowUpDue",
                      "Lead follow-up due for customer: " # customer.name,
                      ?custIdText, "admin"
                    );
                    count += 1;
                  };
                };
              };
              case null {}; // no follow-up date scheduled — skip
            };
          };
          case _ {}; // not a lead — skip
        };
      };
    };
    count
  };
};
