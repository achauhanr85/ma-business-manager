import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import NotificationsLib "../lib/notifications";
import SalesLib "../lib/sales";
import ProfileLib "../lib/profile";
import CustomersLib "../lib/customers";

mixin (
  notificationsStore : NotificationsLib.Store,
  saleStore : SalesLib.SaleStore,
  customerStore : CustomersLib.CustomerStore,
  userStore : ProfileLib.UserStore,
  profileStore : ProfileLib.Store,
) {
  /// Returns unread notifications for a profile + role, plus any personal notifications
  /// for the caller (welcome messages etc.).  Merges both query paths.
  /// For Super Admin callers, also fetches system-level SuperAdmin notifications
  /// (stored with profile_key="superadmin", target_role="superAdmin") regardless of profileKey.
  public shared query ({ caller }) func getNotifications(profileKey : Text, targetRole : Text) : async [NotificationsLib.Notification] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    let roleNotifs = NotificationsLib.getNotifications(notificationsStore, profileKey, targetRole);
    let personalNotifs = NotificationsLib.getNotificationsForUser(notificationsStore, caller.toText());
    // Super Admin: also include system-level notifications (new profile approvals, etc.)
    let isSuperAdmin = switch (userStore.get(caller)) {
      case (?up) up.role == #superAdmin;
      case null false;
    };
    let superAdminNotifs = if (isSuperAdmin) {
      NotificationsLib.getSuperAdminNotifications(notificationsStore)
    } else {
      []
    };
    roleNotifs.concat(personalNotifs).concat(superAdminNotifs)
  };

  /// Returns personal notifications for the caller (e.g. welcome message).
  /// Uses target_role = "user:<principalText>" matching.
  public shared query ({ caller }) func getNotificationsForUser() : async [NotificationsLib.Notification] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    NotificationsLib.getNotificationsForUser(notificationsStore, caller.toText())
  };

  public shared ({ caller }) func markNotificationRead(notificationId : Text) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    NotificationsLib.markNotificationRead(notificationsStore, notificationId)
  };

  /// Runs overdue-payment and customer-follow-up checks for a profile,
  /// creates notifications for any new cases, and returns total count created.
  public shared ({ caller }) func checkAndCreateNotifications(profileKey : Text) : async Nat {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    // Validate the caller belongs to the requested profile or is superAdmin
    switch (userStore.get(caller)) {
      case null Runtime.trap("Caller has no profile");
      case (?up) {
        if (up.role != #superAdmin and up.profile_key != profileKey) {
          Runtime.trap("Access denied: profile mismatch");
        };
      };
    };
    NotificationsLib.runChecksForProfile(notificationsStore, saleStore, profileKey)
  };

  /// Background checks entry point — runs all checks for ALL active profiles.
  /// Called by the recurring timer in main.mo. Also callable by superAdmin.
  public shared ({ caller }) func runBackgroundChecks() : async Nat {
    // Allow system (anonymous from timer context) and superAdmin
    let isSystem = caller.isAnonymous();
    if (not isSystem) {
      switch (userStore.get(caller)) {
        case null Runtime.trap("Caller has no profile");
        case (?up) {
          if (up.role != #superAdmin) {
            Runtime.trap("Access denied: superAdmin required");
          };
        };
      };
    };
    // Check pending profiles (Super Admin notification)
    var totalCount = NotificationsLib.checkPendingProfiles(notificationsStore, profileStore);
    // Collect unique profile keys from all users
    let profileKeys = Map.empty<Text, Bool>();
    for ((_p, up) in userStore.entries()) {
      if (up.profile_key != "") {
        profileKeys.add(up.profile_key, true);
      };
    };
    for ((pk, _) in profileKeys.entries()) {
      // Standard overdue + follow-up checks
      totalCount += NotificationsLib.runChecksForProfile(notificationsStore, saleStore, pk);
      // Silent 3-month inactivity update (no notification emitted)
      NotificationsLib.checkCustomerInactivity(customerStore, saleStore, pk);
      // Lead follow-up due notifications — find the Admin principal for this profile
      let adminPrincipalOpt = userStore.entries()
        .find(func((_uid, up)) { up.profile_key == pk and up.role == #admin });
      switch (adminPrincipalOpt) {
        case (?(_, adminUp)) {
          totalCount += NotificationsLib.checkLeadFollowUp(notificationsStore, customerStore, pk, adminUp.principal);
        };
        case null {}; // no admin found for this profile — skip lead follow-up
      };
    };
    totalCount
  };
};
