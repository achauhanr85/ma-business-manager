/*
 * FILE: mixins/notifications-api.mo
 * MODULE: mixin
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Exposes public canister functions for the notification system.
 *   All logic is in lib/notifications.mo; this file handles auth and routing only.
 *
 * FLOW:
 *   PAGE: Notification Panel (bell icon, top-right header)
 *     getNotifications(profileKey, targetRole) →
 *       1. Fetch profile+role-scoped notifications (getNotifications in lib)
 *       2. Fetch personal notifications (getNotificationsForUser in lib)
 *       3. If caller is Super Admin: also fetch getSuperAdminNotifications()
 *       4. Merge and return all three sets
 *     markNotificationRead(notificationId) → sets is_read=true
 *
 *   PAGE: Super Admin notification panel (dedicated SA call)
 *     getSuperAdminNotifications() → returns ONLY target_role="superAdmin" records
 *       Use this instead of getNotifications() on the SA approval page to avoid
 *       missing SA system notifications due to profileKey mismatch.
 *
 *   PAGE: Profile Approval (inline Approve/Reject in notification panel)
 *     Notification type "NewProfilePendingApproval" has related_id = profileKey
 *     Frontend reads related_id → calls approveProfile(related_id) or rejectProfile(related_id)
 *     This avoids needing to navigate to the Profile Approval page.
 *
 *   PAGE: Admin Dashboard (Manual Trigger button)
 *     checkAndCreateNotifications(profileKey) → runs overdue+followup checks NOW
 *       Caller must belong to profileKey (or be superAdmin)
 *       Returns count of new notifications created
 *
 *   BACKGROUND TIMER (main.mo, every 6 hours)
 *     runBackgroundChecks() → all checks for ALL profiles
 *       Also callable by Super Admin from dashboard for on-demand refresh
 *
 *   PAGE: Super Admin Data Inspector (notifications table)
 *     getAllNotificationsRaw(profileKey) →
 *       profileKey="" → all records from all profiles + sentinel "superadmin" records
 *       profileKey="somekey" → that profile's records + sentinel "superadmin" records
 *       Always includes "superadmin" sentinel records so SA approval notifs are visible.
 *
 * DEPENDENCIES:
 *   imports: mo:core/Map, mo:core/Runtime, lib/notifications, lib/sales,
 *            lib/profile, lib/customers
 *   called by: main.mo (include NotificationsApi(...))
 *   calls: lib/notifications.mo (all logic functions)
 *
 * IMPORTANT — Diagnostics Log Levels:
 *   0=TRACE, 1=DEBUG, 2=INFO (default), 3=WARN, 4=ERROR
 *   Frontend logs API calls to this mixin to the diagnostics panel when enabled.
 *   The user's saved diagnostics_level (from getUserPreferences) controls filter.
 * ─────────────────────────────────────────────────────────────────────
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
