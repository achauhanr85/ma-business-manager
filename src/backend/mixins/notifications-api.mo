/*
 * mixins/notifications-api.mo — Notifications Public API
 *
 * WHAT THIS FILE DOES:
 *   Exposes public canister functions for the notification system:
 *     - getNotifications(profileKey, targetRole) — merged panel query
 *       For Super Admin: also appends system-level "superAdmin" notifications
 *       For regular users: also includes personal "user:<principal>" notifications
 *     - getSuperAdminNotifications() — Super Admin system notifications only (dedicated)
 *     - getNotificationsForUser() — personal notifications only (welcome, etc.)
 *     - markNotificationRead(notificationId) — marks a single notification as read
 *     - checkAndCreateNotifications(profileKey) — manual trigger by Admin
 *     - runBackgroundChecks() — runs ALL checks for ALL profiles (Super Admin or timer)
 *     - getAllNotificationsRaw(profileKey) — Super Admin Data Inspector raw query
 *
 * WHO USES IT:
 *   Included in main.mo. The Notification Panel in the frontend calls getNotifications()
 *   to populate the bell icon panel.
 *
 * IMPORTANT — Super Admin Notifications:
 *   Super Admin system notifications (e.g. "New profile pending approval") are stored
 *   with profile_key="superadmin" (sentinel) and target_role="superAdmin".
 *   They must NEVER be filtered by a real profileKey — they always live under the
 *   sentinel key and are returned regardless of which profile the SA has active.
 *
 *   Two paths exist for Super Admin to fetch these:
 *     1. getNotifications(any profileKey, "superAdmin")
 *        — appends superAdmin notifs via the isSuperAdmin check in this mixin.
 *        — Works for the notification panel.
 *     2. getSuperAdminNotifications()
 *        — dedicated query, always returns exactly the superAdmin-targeted records.
 *        — USE THIS in the DataInspectorPage and anywhere you only want SA notifs.
 *        — Does NOT require a profileKey argument — no risk of wrong-key filtering.
 *
 * DATA INSPECTOR:
 *   getAllNotificationsRaw("") returns all notifications across all profiles.
 *   getAllNotificationsRaw("somekey") returns records for that profile PLUS the
 *   "superadmin" sentinel records (so new-profile-approval notifs are always visible).
 *
 * BACKGROUND CHECKS:
 *   runBackgroundChecks() is safe to call manually by Super Admin from the dashboard.
 *   It runs the same logic as the 6-hour recurring timer in main.mo.
 *   Anonymous callers (from the timer context) are also allowed.
 */

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
    // These are stored with profile_key="superadmin" and target_role="superAdmin".
    // They must be appended here regardless of the profileKey argument so they always
    // appear in the Super Admin notification panel no matter which profile is active.
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

  /// Dedicated Super Admin system-notification query.
  /// Returns only the system-level notifications stored with profile_key="superadmin"
  /// (target_role="superAdmin") — i.e. new profile pending approval, etc.
  ///
  /// WHY this exists in addition to getNotifications():
  ///   The frontend for the Super Admin notification panel calls getNotifications()
  ///   with targetRole="superAdmin". If the frontend ever passes an incorrect
  ///   targetRole (e.g. "admin") the system notifications would be missed.
  ///   This dedicated function is always correct because it does not depend on the
  ///   targetRole argument — it filters solely by target_role="superAdmin" in the store.
  ///
  ///   Super Admin only — other callers receive an empty array (not an error, so
  ///   the frontend can safely call it regardless of role).
  public shared query ({ caller }) func getSuperAdminNotifications() : async [NotificationsLib.Notification] {
    if (caller.isAnonymous()) return [];
    let isSuperAdmin = switch (userStore.get(caller)) {
      case (?up) up.role == #superAdmin;
      case null false;
    };
    if (not isSuperAdmin) return [];
    NotificationsLib.getSuperAdminNotifications(notificationsStore)
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

  // ── Data Inspector — Super Admin only ────────────────────────────────────

  /// Returns ALL notifications (read and unread) across all profiles.
  /// Used by the Super Admin Data Inspector page to browse raw notification records.
  ///
  /// Filtering rules:
  ///   - profileKey="" → returns EVERY notification (all profiles + sentinel superadmin records)
  ///   - profileKey="somekey" → returns notifications for that profile PLUS any
  ///     profile_key="superadmin" sentinel records (system-level notifications that
  ///     are never tied to a single profile but must always be visible to Super Admin)
  ///
  /// WHY we always include "superadmin" sentinel records even when a profileKey is given:
  ///   Notifications for new profile approvals are stored with profile_key="superadmin"
  ///   so they survive regardless of which profile Super Admin is currently viewing.
  ///   Without this inclusion the Data Inspector would always show 0 rows for the
  ///   notifications table because the query would never match the sentinel key.
  public shared query ({ caller }) func getAllNotificationsRaw(profileKey : Text) : async [NotificationsLib.Notification] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    notificationsStore.entries()
      .filter(func((_id, n) : (Text, NotificationsLib.Notification)) : Bool {
        // Always include every record when no filter is requested
        profileKey == ""
        // When a profile is specified: include that profile's records AND the
        // "superadmin" sentinel records (system-level Super Admin notifications)
        or n.profile_key == profileKey
        or n.profile_key == "superadmin"
      })
      .map(func((_id, n) : (Text, NotificationsLib.Notification)) : NotificationsLib.Notification { n })
      .toArray()
  };
};
