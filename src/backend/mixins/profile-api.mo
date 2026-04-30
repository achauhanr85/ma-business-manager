/*
 * FILE: mixins/profile-api.mo
 * MODULE: mixin
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Exposes all public canister functions related to profile and user management.
 *   This is the public API surface — all business logic is delegated to lib/profile.mo.
 *
 * FLOW:
 *   PAGE: Login
 *     getRoutingStatus() → ProfileLib.getRoutingStatus()
 *       → returns #superAdmin / #active / #pending_approval / #profile_pending_super_admin / #noprofile
 *     getUserPreferences() → returns lang/theme/dateFormat/diagnosticsLevel (called BEFORE render)
 *
 *   PAGE: Create Profile
 *     createProfile(input) → ProfileLib.createProfile() → assigns #admin, creates SA notification
 *
 *   PAGE: Join Profile (Staff onboarding)
 *     joinProfile(profileKey, displayName, warehouseName) → ProfileLib.joinProfile()
 *       → assigns #staff pending, notifies Admin
 *
 *   PAGE: Super Admin Profile Approval
 *     getPendingProfiles() → ProfileLib.getPendingProfiles()
 *       → returns all profiles with #pending_super_admin_approval status
 *     approveProfile(profileKey) → ProfileLib.approveProfile(..., true)
 *       → sets #approved + notifies profile creator
 *     rejectProfile(profileKey) → ProfileLib.approveProfile(..., false)
 *       → sets #suspended + notifies profile creator
 *
 *   PAGE: User Preferences
 *     updateUserPreferences(lang, fmt, rcptLang, wa, theme, diagLevel) → persists all prefs
 *       → diagLevel is validated to 0-4 range (invalid → default 2=INFO)
 *
 *   PAGE: Super Admin Data Inspector
 *     updateProfileFields(profileKey, fields) → ProfileLib.updateProfileFields()
 *       → partial update (only non-null fields changed, key/owner never changed)
 *
 * DEPENDENCIES:
 *   imports: types/common, types/profile, types/users, lib/profile, lib/catalog,
 *            lib/customers, lib/inventory, lib/sales, lib/purchases, lib/notifications
 *   called by: main.mo (include ProfileApi(...))
 *   calls: lib/profile.mo (all functions)
 *
 * KEY TYPES:
 *   ProfileInput      — create/update payload
 *   ProfileUpdateInput — partial update for Data Inspector
 *   UserPreferences   — pre-render query result (includes diagnosticsLevel)
 *
 * PUBLIC FUNCTIONS:
 *   getUserProfile() → ?UserProfilePublic
 *   getRoutingStatus() → RoutingStatus
 *   getUserPreferences() → UserPreferences  [includes diagnosticsLevel]
 *   updateUserPreferences(lang,fmt,rcptLang,wa,theme,diagLevel) → Bool
 *   createProfile(input) → Bool
 *   joinProfile(profileKey,displayName,warehouseName) → Bool
 *   getPendingProfiles() → [ProfilePublic]
 *   approveProfile(profileKey) → Bool
 *   rejectProfile(profileKey) → Bool
 *   updateProfileFields(profileKey, fields) → Bool
 *   getAllProfilesForAdmin() → [ProfilePublic]
 *   getAllUsersRaw(profileKey) → [UserProfilePublic]
 *   getAllProfilesRaw() → [ProfilePublic]
 * ─────────────────────────────────────────────────────────────────────
 */

import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";
import ProfileLib "../lib/profile";
import CatalogLib "../lib/catalog";
import CustomersLib "../lib/customers";
import InventoryLib "../lib/inventory";
import SalesLib "../lib/sales";
import PurchasesLib "../lib/purchases";
import NotificationsLib "../lib/notifications";

mixin (
  profileStore : ProfileLib.Store,
  userStore : ProfileLib.UserStore,
  categoryStore : CatalogLib.CategoryStore,
  productStore : CatalogLib.ProductStore,
  customerStore : CustomersLib.CustomerStore,
  batchStore : InventoryLib.BatchStore,
  movementStore : InventoryLib.MovementStore,
  saleStore : SalesLib.SaleStore,
  saleItemStore : SalesLib.SaleItemStore,
  poStore : PurchasesLib.POStore,
  poItemStore : PurchasesLib.POItemStore,
  notificationsStore : NotificationsLib.Store,
) {
  /// Returns the caller's own UserProfile (for onboarding detection).
  public shared query ({ caller }) func getUserProfile() : async ?UserTypes.UserProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getUserProfile(userStore, caller)
  };

  /// Returns the routing status for the caller — use this on login to decide which
  /// screen to show.  Never routes #noprofile users to "Profile Under Review".
  ///   #noprofile                   → onboarding page (create or join profile)
  ///   #pending_approval            → user-level waiting screen ("Admin notified…")
  ///   #profile_pending_super_admin → profile waiting screen ("Profile pending Super Admin approval")
  ///   #active                      → normal app routing by role
  ///   #superAdmin                  → Super Admin dashboard
  public shared ({ caller }) func getRoutingStatus() : async ProfileLib.RoutingStatus {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getRoutingStatus(profileStore, userStore, notificationsStore, caller)
  };

  /// Returns user preferences for the caller — fast query, called BEFORE first render
  /// so the app can immediately apply the correct language without a flash to English.
  public shared query ({ caller }) func getUserPreferences() : async UserTypes.UserPreferences {
    if (caller.isAnonymous()) {
      return { language = "en"; dateFormat = "DD/MM/YYYY"; defaultReceiptLanguage = "en"; whatsappNumber = ""; theme = "herbal"; diagnosticsLevel = 2 };
    };
    ProfileLib.getUserPreferences(userStore, caller)
  };

  /// Saves user preferences (language, date format, receipt language, whatsapp number, theme, diagnosticsLevel).
  /// Returns true on success.  Frontend should log out and prompt re-login to apply language.
  /// diagnosticsLevel: 0=TRACE, 1=DEBUG, 2=INFO (default), 3=WARN, 4=ERROR.
  /// Invalid values (>4) are silently defaulted to 2 (INFO) by the backend.
  public shared ({ caller }) func updateUserPreferences(
    language : Text,
    dateFormat : Text,
    defaultReceiptLanguage : Text,
    whatsappNumber : Text,
    theme : Text,
    diagnosticsLevel : Nat,
  ) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateUserPreferences(userStore, caller, language, dateFormat, defaultReceiptLanguage, whatsappNumber, theme, diagnosticsLevel)
  };

  /// Returns the active profile_key for Super Admin impersonation context.
  public shared query ({ caller }) func getSuperAdminActiveProfile() : async ?Common.ProfileKey {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getSuperAdminActiveProfile(userStore, caller)
  };

  /// Sets the active profile_key for Super Admin impersonation (persisted in userStore).
  public shared ({ caller }) func setSuperAdminActiveProfile(profile_key : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.setSuperAdminActiveProfile(userStore, caller, profile_key)
  };

  /// Returns the caller's linked business profile details
  public shared query ({ caller }) func getProfile() : async ?ProfileTypes.ProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getProfileForCaller(profileStore, userStore, caller)
  };

  /// Look up any profile by its key (public info for join flow)
  public shared query ({ caller }) func getProfileByKey(profile_key : Common.ProfileKey) : async ?ProfileTypes.ProfilePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getProfileByKey(profileStore, profile_key)
  };

  /// Returns the governance status for a given profile — Super Admin only
  public shared query ({ caller }) func getProfileStatus(profile_key : Common.ProfileKey) : async ?ProfileTypes.ProfileStatus {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getProfileStatus(profileStore, profile_key)
  };

  /// Returns all profiles with governance details — Super Admin only.
  public shared query ({ caller }) func getAllProfilesForAdmin() : async [ProfileTypes.ProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getAllProfilesForAdmin(profileStore)
  };

  /// Returns all UserProfiles across all profiles — Super Admin only
  public shared query ({ caller }) func getAllUsersForAdmin() : async [UserTypes.UserProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getAllUsersForAdmin(userStore)
  };

  /// Returns all UserProfiles for a specific profile.
  /// Accessible by #superAdmin (any profile) or #admin (own profile only).
  public shared query ({ caller }) func getUsersByProfile(profile_key : Common.ProfileKey) : async [UserTypes.UserProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role == #superAdmin) {
          // Super Admin can query any profile
        } else if (up.role == #admin and up.profile_key == profile_key) {
          // Admin can only query their own profile
        } else {
          Runtime.trap("Access denied");
        };
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getUsersByProfile(userStore, profile_key)
  };

  /// Returns all users with role #referralUser for a given profile.
  /// Used to populate the "Referred By" dropdown on the customer form.
  /// Accessible by #admin, #staff, or #superAdmin.
  public shared query ({ caller }) func getReferralUsers(profile_key : Common.ProfileKey) : async [UserTypes.UserProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (
          up.role != #superAdmin and
          up.role != #admin and
          up.role != #staff
        ) Runtime.trap("Access denied");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getReferralUsers(userStore, profile_key)
  };

  /// Assigns a new role to a user within a profile — Super Admin only
  public shared ({ caller }) func assignUserRole(targetUserId : Common.UserId, newRole : Common.UserRole, profile_key : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.assignUserRole(userStore, caller, targetUserId, newRole, profile_key)
  };

  /// Creates a new profile; caller becomes the #admin owner.
  /// New profiles start with profile_approval_status = #pending_super_admin_approval.
  /// A #NewProfilePendingApproval notification is sent to Super Admin.
  public shared ({ caller }) func createProfile(input : ProfileTypes.ProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.createProfile(profileStore, userStore, notificationsStore, caller, input)
  };

  /// Joins an existing profile by profile_key as #staff
  public shared ({ caller }) func joinProfile(profile_key : Common.ProfileKey, display_name : Text, warehouse_name : Common.WarehouseName) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.joinProfile(profileStore, userStore, notificationsStore, caller, profile_key, display_name, warehouse_name)
  };

  /// Creates a referral user in an existing profile — Admin/SuperAdmin only.
  /// The referral user is created with #referralUser role and pending approval status.
  public shared ({ caller }) func createReferralUser(profile_key : Common.ProfileKey, display_name : Text) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #admin and up.role != #superAdmin) Runtime.trap("Admin access required");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.createReferralUser(profileStore, userStore, notificationsStore, caller, profile_key, display_name)
  };

  /// Updates profile branding/info; #admin updates own profile, #superAdmin may update any profile
  public shared ({ caller }) func updateProfile(input : ProfileTypes.ProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateProfile(profileStore, userStore, caller, input)
  };

  /// Enable or disable a profile — Super Admin only.
  public shared ({ caller }) func enableProfile(profile_key : Common.ProfileKey, enabled : Bool) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.enableProfile(profileStore, userStore, caller, profile_key, enabled)
  };

  /// Approve a pending profile — Super Admin only.
  /// Sets profile_approval_status to #approved, allowing all transactions.
  /// Notifies the profile creator (Admin) so they know access is now available.
  public shared ({ caller }) func approveProfile(profile_key : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.approveProfile(profileStore, userStore, notificationsStore, caller, profile_key, true)
  };

  /// Reject/suspend a profile — Super Admin only.
  /// Sets profile_approval_status to #suspended.
  /// Notifies the profile creator (Admin) that their profile was suspended.
  public shared ({ caller }) func rejectProfile(profile_key : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.approveProfile(profileStore, userStore, notificationsStore, caller, profile_key, false)
  };

  /// Set the active governance window for a profile — Super Admin only.
  public shared ({ caller }) func setProfileWindow(profile_key : Common.ProfileKey, start_date : ?Common.Timestamp, end_date : ?Common.Timestamp) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.setProfileWindow(profileStore, userStore, caller, profile_key, start_date, end_date)
  };

  /// Delete a profile and all associated data — Super Admin only.
  public shared ({ caller }) func deleteProfile(profile_key : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.deleteProfile(
      profileStore, userStore,
      categoryStore, productStore, customerStore,
      batchStore, movementStore,
      saleStore, saleItemStore,
      poStore, poItemStore,
      caller, profile_key,
    )
  };

  /// Update the unique profile key — Super Admin only.
  public shared ({ caller }) func updateProfileKey(oldKey : Common.ProfileKey, newKey : Common.ProfileKey) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateProfileKey(profileStore, userStore, caller, oldKey, newKey)
  };

  /// Updates caller's own display_name / warehouse_name
  public shared ({ caller }) func updateUserProfile(input : UserTypes.UserProfileInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.updateUserProfile(userStore, caller, input)
  };

  /// Returns all users with approval_status = "pending" for a profile — Admin/SuperAdmin only.
  public shared query ({ caller }) func getPendingApprovalUsers(profile_key : Common.ProfileKey) : async [UserTypes.UserProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.getPendingApprovalUsers(userStore, caller, profile_key)
  };

  /// Approve or reject a pending staff member — Admin/SuperAdmin only.
  public shared ({ caller }) func approveUser(userId : Common.UserId, approved : Bool) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    ProfileLib.approveUser(userStore, caller, userId, approved)
  };

  // ── Data Inspector functions — Super Admin only ───────────────────────────

  /// Returns all users, optionally filtered by profileKey.
  /// Pass profileKey="" to get every user across all profiles.
  /// Used by the Super Admin Data Inspector page.
  public shared query ({ caller }) func getAllUsersRaw(profileKey : Common.ProfileKey) : async [UserTypes.UserProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getAllUsersRaw(userStore, profileKey)
  };

  /// Returns all profiles.
  /// Used by the Super Admin Data Inspector page.
  public shared query ({ caller }) func getAllProfilesRaw() : async [ProfileTypes.ProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getAllProfilesRaw(profileStore)
  };

  /// Returns all profiles with profile_approval_status = #pending_super_admin_approval.
  ///
  /// FLOW (Profile Approval Page — Super Admin):
  ///   1. Page loads → calls getPendingProfiles()
  ///   2. Renders a table of profiles awaiting approval
  ///   3. Super Admin clicks Approve → approveProfile(profileKey)
  ///   4. Super Admin clicks Reject  → rejectProfile(profileKey)
  ///   5. Both actions send a notification to the profile creator
  ///
  /// Super Admin only.  Returns [] when no profiles are pending (not an error).
  public shared query ({ caller }) func getPendingProfiles() : async [ProfileTypes.ProfilePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.getPendingProfiles(profileStore)
  };

  /// Partial update of profile fields — Super Admin only (for Data Inspector).
  ///
  /// FLOW (Data Inspector edit modal):
  ///   1. Super Admin opens edit modal for a profile record
  ///   2. Changes desired fields (business_name, phone, address, etc.)
  ///   3. Frontend calls updateProfileFields(profileKey, fields)
  ///   4. Backend applies only non-null fields; key/owner fields are immutable
  ///   5. Returns true on success, false if profile not found or caller not SA
  ///
  /// NOTE: Use enableProfile() for the is_enabled toggle if you want the dedicated function.
  /// updateProfileFields also accepts is_enabled as an optional convenience.
  public shared ({ caller }) func updateProfileFields(
    profileKey : Common.ProfileKey,
    fields : ProfileTypes.ProfileUpdateInput,
  ) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    ProfileLib.updateProfileFields(profileStore, userStore, caller, profileKey, fields)
  };
};
