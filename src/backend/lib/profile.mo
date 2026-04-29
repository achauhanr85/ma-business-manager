/*
 * lib/profile.mo — Profile and User Management Business Logic
 *
 * WHAT THIS FILE DOES:
 *   Handles all the domain logic for:
 *     - Creating and managing business profiles (multi-tenant isolation key)
 *     - User registration flows: createProfile (→ Admin), joinProfile (→ Staff),
 *       createReferralUser (→ ReferralUser)
 *     - Profile approval by Super Admin and user approval by Admin
 *     - User preferences (language, theme, date format, receipt language)
 *     - Profile key updates with cascading user migration
 *     - Profile deletion with full cascade (users, products, customers, sales, POs)
 *     - Routing status logic — tells the frontend which screen to show on login
 *
 * WHO USES IT:
 *   mixins/profile-api.mo (delegates all public functions here)
 *
 * KEY DESIGN DECISIONS:
 *   - Profile creator always gets role=#admin (not #staff) — enforced in createProfile()
 *   - joinProfile() always assigns role=#staff with approval_status="pending"
 *   - Super Admin bypasses all approval gates (checked in checkProfileAccess and getRoutingStatus)
 *   - Super Admin notifications use profile_key="superadmin" with NO profileKey filter
 *     so they appear in the Super Admin panel regardless of which profile is selected
 *   - Language preference is loaded via getUserPreferences() BEFORE first render
 *     to prevent the "flash to English" bug
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import ProfileTypes "../types/profile";
import UserTypes "../types/users";
import CatalogTypes "../types/catalog";
import InventoryTypes "../types/inventory";
import SalesTypes "../types/sales";
import PurchaseTypes "../types/purchases";
import CustomerTypes "../types/customers";
import NotificationsLib "notifications";

module {
  // Store type aliases — these are the Map types declared in main.mo
  public type Store = Map.Map<Common.ProfileKey, ProfileTypes.Profile>;
  public type UserStore = Map.Map<Common.UserId, UserTypes.UserProfile>;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  /// Project Profile → ProfilePublic (strips who-columns from public surface)
  func toPublic(p : ProfileTypes.Profile) : ProfileTypes.ProfilePublic {
    {
      profile_key = p.profile_key;
      business_name = p.business_name;
      phone_number = p.phone_number;
      business_address = p.business_address;
      fssai_number = p.fssai_number;
      email = p.email;
      owner = p.owner;
      logo_url = p.logo_url;
      theme_color = p.theme_color;
      receipt_notes = p.receipt_notes;
      instagram_handle = p.instagram_handle;
      created_at = p.created_at;
      is_archived = p.is_archived;
      is_enabled = p.is_enabled;
      start_date = p.start_date;
      end_date = p.end_date;
      profile_approval_status = p.profile_approval_status;
    };
  };

  // ── Governance helper ─────────────────────────────────────────────────────────

  /// Check whether a profile's active window is currently open.
  public func isProfileActive(profile : ProfileTypes.Profile) : Bool {
    if (not profile.is_enabled) return false;
    let now = Time.now();
    let windowOpen = switch (profile.start_date) {
      case (?sd) now >= sd;
      case null  true;
    };
    let windowNotExpired = switch (profile.end_date) {
      case (?ed) now <= ed;
      case null  true;
    };
    windowOpen and windowNotExpired
  };

  public func checkProfileAccess(store : Store, userStore : UserStore, caller : Common.UserId) : { #ok; #err : ProfileTypes.ProfileAccessError } {
    let profileKey = switch (userStore.get(caller)) {
      case (?up) {
        // Super Admin bypasses all profile access checks — they manage profiles, not subject to them
        if (up.role == #superAdmin) return #ok;
        up.profile_key
      };
      case null Runtime.trap("Caller has no profile");
    };
    let profile = switch (store.get(profileKey)) {
      case (?p) p;
      case null Runtime.trap("Profile not found: " # profileKey);
    };
    // Check approval status first
    switch (profile.profile_approval_status) {
      case (#pending_super_admin_approval) return #err(#PendingSuperAdminApproval);
      case (#suspended) return #err(#ProfileSuspended);
      case (#approved) {};
    };
    if (not profile.is_enabled) return #err(#ProfileDisabled);
    let now = Time.now();
    let windowOpen = switch (profile.start_date) {
      case (?sd) now >= sd;
      case null  true;
    };
    let windowNotExpired = switch (profile.end_date) {
      case (?ed) now <= ed;
      case null  true;
    };
    if (not windowOpen or not windowNotExpired) return #err(#OutsideActiveWindow);
    #ok
  };

  // ── Read operations ───────────────────────────────────────────────────────────

  /// Look up a profile by profile_key
  public func getProfileByKey(store : Store, profile_key : Common.ProfileKey) : ?ProfileTypes.ProfilePublic {
    switch (store.get(profile_key)) {
      case (?p) ?toPublic(p);
      case null null;
    }
  };

  /// Look up the caller's own profile (via their UserProfile's profile_key)
  public func getProfileForCaller(store : Store, userStore : UserStore, caller : Common.UserId) : ?ProfileTypes.ProfilePublic {
    switch (userStore.get(caller)) {
      case (?up) getProfileByKey(store, up.profile_key);
      case null null;
    }
  };

  /// Returns governance status for a given profile_key (Super Admin view)
  public func getProfileStatus(store : Store, profile_key : Common.ProfileKey) : ?ProfileTypes.ProfileStatus {
    switch (store.get(profile_key)) {
      case (?p) {
        let now = Time.now();
        let windowOpen = switch (p.start_date) {
          case (?sd) now >= sd;
          case null  true;
        };
        let windowNotExpired = switch (p.end_date) {
          case (?ed) now <= ed;
          case null  true;
        };
        ?{
          is_enabled = p.is_enabled;
          is_within_window = windowOpen and windowNotExpired;
          start_date = p.start_date;
          end_date = p.end_date;
          profile_approval_status = p.profile_approval_status;
        }
      };
      case null null;
    }
  };

  /// Returns all profiles with full governance details — Super Admin only
  public func getAllProfilesForAdmin(store : Store) : [ProfileTypes.ProfilePublic] {
    store.entries()
      .map(func((_k, p) : (Common.ProfileKey, ProfileTypes.Profile)) : ProfileTypes.ProfilePublic {
        toPublic(p)
      })
      .toArray()
  };

  /// Alias used by the Data Inspector page — returns every profile record.
  /// This is the same as getAllProfilesForAdmin() but with a name that makes
  /// its purpose explicit when called from the Super Admin data inspector.
  /// Super Admin only — enforced in the mixin caller check.
  public func getAllProfilesRaw(store : Store) : [ProfileTypes.ProfilePublic] {
    getAllProfilesForAdmin(store)
  };

  /// Returns all UserProfiles across every profile — Super Admin only
  public func getAllUsersForAdmin(userStore : UserStore) : [UserTypes.UserProfilePublic] {
    userStore.entries()
      .map(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : UserTypes.UserProfilePublic {
        {
          principal = up.principal;
          profile_key = up.profile_key;
          role = up.role;
          warehouse_name = up.warehouse_name;
          display_name = up.display_name;
          email = up.email;
          joined_at = up.joined_at;
          approval_status = up.approval_status;
          module_access = up.module_access;
          language_preference = up.language_preference;
          date_format = up.date_format;
          default_receipt_language = up.default_receipt_language;
          theme = up.theme;
        }
      })
      .toArray()
  };

  /// Alias used by the Data Inspector page — returns every user record.
  /// This is the same as getAllUsersForAdmin() but with a name that makes
  /// its purpose explicit when called from the Super Admin data inspector.
  /// profileKey="" returns ALL users; non-empty profileKey filters to that profile.
  /// Super Admin only — enforced in the mixin caller check.
  public func getAllUsersRaw(userStore : UserStore, profileKey : Common.ProfileKey) : [UserTypes.UserProfilePublic] {
    userStore.entries()
      .filter(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : Bool {
        profileKey == "" or up.profile_key == profileKey
      })
      .map(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : UserTypes.UserProfilePublic {
        {
          principal = up.principal;
          profile_key = up.profile_key;
          role = up.role;
          warehouse_name = up.warehouse_name;
          display_name = up.display_name;
          email = up.email;
          joined_at = up.joined_at;
          approval_status = up.approval_status;
          module_access = up.module_access;
          language_preference = up.language_preference;
          date_format = up.date_format;
          default_receipt_language = up.default_receipt_language;
          theme = up.theme;
        }
      })
      .toArray()
  };

  /// Returns all UserProfiles for a specific profile_key — Super Admin only
  public func getUsersByProfile(userStore : UserStore, profile_key : Common.ProfileKey) : [UserTypes.UserProfilePublic] {
    userStore.entries()
      .filter(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : Bool {
        up.profile_key == profile_key
      })
      .map(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : UserTypes.UserProfilePublic {
        {
          principal = up.principal;
          profile_key = up.profile_key;
          role = up.role;
          warehouse_name = up.warehouse_name;
          display_name = up.display_name;
          email = up.email;
          joined_at = up.joined_at;
          approval_status = up.approval_status;
          module_access = up.module_access;
          language_preference = up.language_preference;
          date_format = up.date_format;
          default_receipt_language = up.default_receipt_language;
          theme = up.theme;
        }
      })
      .toArray()
  };

  /// Assigns a new role to a target user within a specific profile — Super Admin only
  public func assignUserRole(userStore : UserStore, caller : Common.UserId, targetUserId : Common.UserId, newRole : Common.UserRole, profile_key : Common.ProfileKey) : Bool {
    // Verify caller has #superAdmin role
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) return false;
      };
      case null return false;
    };
    // Look up target user and verify profile_key matches
    switch (userStore.get(targetUserId)) {
      case null false;
      case (?existing) {
        if (existing.profile_key != profile_key) return false;
        let updated : UserTypes.UserProfile = {
          existing with
          role = newRole;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        userStore.add(targetUserId, updated);
        true
      };
    }
  };

  // ── Write operations ──────────────────────────────────────────────────────────

  /// Create a new profile; traps if the profile_key already exists; caller becomes #admin.
  /// New profiles start with profile_approval_status = #pending_super_admin_approval.
  /// A #NewProfilePendingApproval notification is created for Super Admin.
  public func createProfile(store : Store, userStore : UserStore, notificationsStore : NotificationsLib.Store, caller : Common.UserId, input : ProfileTypes.ProfileInput) : Bool {
    switch (store.get(input.profile_key)) {
      case (?_) false; // profile_key already taken
      case null {
        let now = Time.now();
        let profile : ProfileTypes.Profile = {
          profile_key = input.profile_key;
          business_name = input.business_name;
          phone_number = input.phone_number;
          business_address = input.business_address;
          fssai_number = input.fssai_number;
          email = input.email;
          owner = caller;
          logo_url = input.logo_url;
          theme_color = input.theme_color;
          receipt_notes = input.receipt_notes;
          instagram_handle = input.instagram_handle;
          created_at = now;
          is_archived = false;
          // Profiles start enabled with no window restrictions
          is_enabled = true;
          start_date = null;
          end_date = null;
          // New profiles require Super Admin approval before becoming active
          profile_approval_status = #pending_super_admin_approval;
          // Who-columns
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
        };
        store.add(input.profile_key, profile);
        let up : UserTypes.UserProfile = {
          principal = caller;
          profile_key = input.profile_key;
          role = #admin;
          warehouse_name = "Main";
          display_name = input.business_name;
          email = null;
          joined_at = now;
          // Profile creator is immediately approved as Admin
          approval_status = ?"approved";
          module_access = null;
          // User preferences — default to English / DD/MM/YYYY / dark theme
          language_preference = "en";
          date_format = "DD/MM/YYYY";
          default_receipt_language = "en";
          theme = "dark";
          // Who-columns
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
        };
        userStore.add(caller, up);
        // Notify Super Admin that a new profile is pending approval.
        // profile_key is set to "superadmin" (sentinel — no real profile key).
        // related_id is null because this is a system-level notification scoped
        // only to the Super Admin principal; it must NOT carry the new profile's key
        // or the notification will be filtered out when Super Admin queries with
        // a different active profile_key selected.
        let _ = NotificationsLib.createNotification(
          notificationsStore,
          "superadmin",
          "NewProfilePendingApproval",
          "New business profile '" # input.business_name # "' (key: " # input.profile_key # ") is pending Super Admin approval.",
          null,
          "superAdmin",
        );
        true
      };
    }
  };

  /// Join an existing profile by profile_key; assigns #staff role with pending approval.
  /// Sends a #StaffPendingApproval notification to Admin.
  public func joinProfile(store : Store, userStore : UserStore, notificationsStore : NotificationsLib.Store, caller : Common.UserId, profile_key : Common.ProfileKey, display_name : Text, warehouse_name : Common.WarehouseName) : Bool {
    switch (store.get(profile_key)) {
      case null false; // profile_key does not exist
      case (?_) {
        let now = Time.now();
        let up : UserTypes.UserProfile = {
          principal = caller;
          profile_key;
          role = #staff;
          warehouse_name;
          display_name;
          email = null;
          joined_at = now;
          // Staff members start as pending until approved by Admin
          approval_status = ?"pending";
          module_access = null;
          // User preferences — default to English / DD/MM/YYYY / dark theme
          language_preference = "en";
          date_format = "DD/MM/YYYY";
          default_receipt_language = "en";
          theme = "dark";
          // Who-columns
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
        };
        userStore.add(caller, up);
        // Notify Admin that a new staff member is pending approval
        let _ = NotificationsLib.createNotification(
          notificationsStore,
          profile_key,
          "StaffPendingApproval",
          "New staff member '" # display_name # "' has joined and is awaiting Admin approval.",
          ?(caller.toText()),
          "admin",
        );
        true
      };
    }
  };

  /// Create a referral user in an existing profile; assigns #referralUser role with pending approval.
  /// Sends a #ReferralUserPendingApproval notification to Admin.
  public func createReferralUser(store : Store, userStore : UserStore, notificationsStore : NotificationsLib.Store, caller : Common.UserId, profile_key : Common.ProfileKey, display_name : Text) : Bool {
    switch (store.get(profile_key)) {
      case null false;
      case (?_) {
        let now = Time.now();
        let up : UserTypes.UserProfile = {
          principal = caller;
          profile_key;
          role = #referralUser;
          warehouse_name = "";
          display_name;
          email = null;
          joined_at = now;
          approval_status = ?"pending";
          module_access = null;
          language_preference = "en";
          date_format = "DD/MM/YYYY";
          default_receipt_language = "en";
          theme = "dark";
          created_by = caller;
          last_updated_by = caller;
          creation_date = now;
          last_update_date = now;
        };
        userStore.add(caller, up);
        // Notify Admin that a new referral user is pending approval
        let _ = NotificationsLib.createNotification(
          notificationsStore,
          profile_key,
          "ReferralUserPendingApproval",
          "New referral user '" # display_name # "' has been created and is awaiting Admin approval.",
          ?(caller.toText()),
          "admin",
        );
        true
      };
    }
  };

  /// Update profile details; #admin may update their own profile;
  /// #superAdmin may update any profile by passing target profile_key in input.
  public func updateProfile(store : Store, userStore : UserStore, caller : Common.UserId, input : ProfileTypes.ProfileInput) : Bool {
    switch (userStore.get(caller)) {
      case null false;
      case (?up) {
        if (up.role != #admin and up.role != #superAdmin) return false;
        // Super Admins target profile via input.profile_key (they have no profile_key of their own).
        // Admins always update their own profile (up.profile_key must match input.profile_key).
        let targetKey : Common.ProfileKey = if (up.role == #superAdmin) {
          input.profile_key
        } else {
          up.profile_key
        };
        switch (store.get(targetKey)) {
          case null false;
          case (?existing) {
            let updated : ProfileTypes.Profile = {
              existing with
              business_name = input.business_name;
              phone_number = input.phone_number;
              business_address = input.business_address;
              fssai_number = input.fssai_number;
              email = input.email;
              logo_url = input.logo_url;
              theme_color = input.theme_color;
              receipt_notes = input.receipt_notes;
              instagram_handle = input.instagram_handle;
              last_updated_by = caller;
              last_update_date = Time.now();
            };
            store.add(existing.profile_key, updated);
            true
          };
        }
      };
    }
  };

  /// Enable or disable a profile — Super Admin only.
  public func enableProfile(store : Store, userStore : UserStore, caller : Common.UserId, profile_key : Common.ProfileKey, enabled : Bool) : Bool {
    // Verify caller is superAdmin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    switch (store.get(profile_key)) {
      case null false;
      case (?existing) {
        let updated : ProfileTypes.Profile = {
          existing with
          is_enabled = enabled;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        store.add(profile_key, updated);
        true
      };
    }
  };

  /// Set the active governance window for a profile — Super Admin only.
  public func setProfileWindow(store : Store, userStore : UserStore, caller : Common.UserId, profile_key : Common.ProfileKey, start_date : ?Common.Timestamp, end_date : ?Common.Timestamp) : Bool {
    // Verify caller is superAdmin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin only");
      };
      case null Runtime.trap("Caller has no profile");
    };
    switch (store.get(profile_key)) {
      case null false;
      case (?existing) {
        let updated : ProfileTypes.Profile = {
          existing with
          start_date;
          end_date;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        store.add(profile_key, updated);
        true
      };
    }
  };

  /// Delete a profile and ALL related data — Super Admin only.
  /// Cascades to: users, categories, products, customers, batches, movements,
  /// sales, sale items, purchase orders, PO items scoped to the profile.
  public func deleteProfile(
    store : Store,
    userStore : UserStore,
    categoryStore : Map.Map<Common.CategoryId, CatalogTypes.Category>,
    productStore : Map.Map<Common.ProductId, CatalogTypes.Product>,
    customerStore : Map.Map<Common.CustomerId, CustomerTypes.Customer>,
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>,
    movementStore : Map.Map<Common.MovementId, InventoryTypes.InventoryMovement>,
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>,
    saleItemStore : Map.Map<Common.SaleId, [SalesTypes.SaleItem]>,
    poStore : Map.Map<Common.PurchaseOrderId, PurchaseTypes.PurchaseOrder>,
    poItemStore : Map.Map<Common.PurchaseOrderId, [PurchaseTypes.PurchaseOrderItem]>,
    caller : Common.UserId,
    profileKey : Common.ProfileKey,
  ) : Bool {
    // Verify caller is superAdmin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) return false;
      };
      case null return false;
    };
    // Verify profile exists
    switch (store.get(profileKey)) {
      case null return false;
      case (?_) {};
    };
    // Remove profile record
    store.remove(profileKey);
    // Remove all users in this profile
    let userKeysToRemove = userStore.entries()
      .filter(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : Bool {
        up.profile_key == profileKey
      })
      .map(func((k, _up) : (Common.UserId, UserTypes.UserProfile)) : Common.UserId { k })
      .toArray();
    for (uid in userKeysToRemove.values()) {
      userStore.remove(uid);
    };
    // Remove categories
    let catKeysToRemove = categoryStore.entries()
      .filter(func((_k, c) : (Common.CategoryId, CatalogTypes.Category)) : Bool { c.profile_key == profileKey })
      .map(func((k, _c) : (Common.CategoryId, CatalogTypes.Category)) : Common.CategoryId { k })
      .toArray();
    for (cid in catKeysToRemove.values()) {
      categoryStore.remove(cid);
    };
    // Remove products
    let prodKeysToRemove = productStore.entries()
      .filter(func((_k, p) : (Common.ProductId, CatalogTypes.Product)) : Bool { p.profile_key == profileKey })
      .map(func((k, _p) : (Common.ProductId, CatalogTypes.Product)) : Common.ProductId { k })
      .toArray();
    for (pid in prodKeysToRemove.values()) {
      productStore.remove(pid);
    };
    // Remove customers
    let custKeysToRemove = customerStore.entries()
      .filter(func((_k, c) : (Common.CustomerId, CustomerTypes.Customer)) : Bool { c.profile_key == profileKey })
      .map(func((k, _c) : (Common.CustomerId, CustomerTypes.Customer)) : Common.CustomerId { k })
      .toArray();
    for (cid in custKeysToRemove.values()) {
      customerStore.remove(cid);
    };
    // Remove inventory batches
    let batchKeysToRemove = batchStore.entries()
      .filter(func((_k, b) : (Common.BatchId, InventoryTypes.InventoryBatch)) : Bool { b.profile_key == profileKey })
      .map(func((k, _b) : (Common.BatchId, InventoryTypes.InventoryBatch)) : Common.BatchId { k })
      .toArray();
    for (bid in batchKeysToRemove.values()) {
      batchStore.remove(bid);
    };
    // Remove inventory movements
    let mvKeysToRemove = movementStore.entries()
      .filter(func((_k, m) : (Common.MovementId, InventoryTypes.InventoryMovement)) : Bool { m.profile_key == profileKey })
      .map(func((k, _m) : (Common.MovementId, InventoryTypes.InventoryMovement)) : Common.MovementId { k })
      .toArray();
    for (mid in mvKeysToRemove.values()) {
      movementStore.remove(mid);
    };
    // Remove sales and their items
    let saleKeysToRemove = saleStore.entries()
      .filter(func((_k, s) : (Common.SaleId, SalesTypes.Sale)) : Bool { s.profile_key == profileKey })
      .map(func((k, _s) : (Common.SaleId, SalesTypes.Sale)) : Common.SaleId { k })
      .toArray();
    for (sid in saleKeysToRemove.values()) {
      saleStore.remove(sid);
      saleItemStore.remove(sid);
    };
    // Remove POs and their items
    let poKeysToRemove = poStore.entries()
      .filter(func((_k, po) : (Common.PurchaseOrderId, PurchaseTypes.PurchaseOrder)) : Bool { po.profile_key == profileKey })
      .map(func((k, _po) : (Common.PurchaseOrderId, PurchaseTypes.PurchaseOrder)) : Common.PurchaseOrderId { k })
      .toArray();
    for (poid in poKeysToRemove.values()) {
      poStore.remove(poid);
      poItemStore.remove(poid);
    };
    true
  };

  /// Update the profile_key for a profile — Super Admin only.
  /// Migrates all users whose profile_key matches oldKey to newKey.
  public func updateProfileKey(store : Store, userStore : UserStore, caller : Common.UserId, oldKey : Common.ProfileKey, newKey : Common.ProfileKey) : Bool {
    // Verify caller is superAdmin
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) return false;
      };
      case null return false;
    };
    // Validate new key
    if (newKey.size() == 0) return false;
    // New key must not conflict with existing profile
    switch (store.get(newKey)) {
      case (?_) return false; // newKey already in use
      case null {};
    };
    // Fetch existing profile
    let existing = switch (store.get(oldKey)) {
      case null return false;
      case (?p) p;
    };
    // Re-insert under new key
    let updated : ProfileTypes.Profile = {
      existing with
      profile_key = newKey;
      last_updated_by = caller;
      last_update_date = Time.now();
    };
    store.remove(oldKey);
    store.add(newKey, updated);
    // Update all users that reference oldKey
    let now = Time.now();
    let usersToUpdate = userStore.entries()
      .filter(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : Bool {
        up.profile_key == oldKey
      })
      .toArray();
    for ((uid, up) in usersToUpdate.values()) {
      userStore.add(uid, {
        up with
        profile_key = newKey;
        last_updated_by = caller;
        last_update_date = now;
      });
    };
    true
  };

  /// Returns the UserProfile for the caller (onboarding status).
  public func getUserProfile(userStore : UserStore, caller : Common.UserId) : ?UserTypes.UserProfilePublic {
    switch (userStore.get(caller)) {
      case (?up) ?{
        principal = up.principal;
        profile_key = up.profile_key;
        role = up.role;
        warehouse_name = up.warehouse_name;
        display_name = up.display_name;
        email = up.email;
        joined_at = up.joined_at;
        approval_status = up.approval_status;
        module_access = up.module_access;
        language_preference = up.language_preference;
        date_format = up.date_format;
        default_receipt_language = up.default_receipt_language;
        theme = up.theme;
      };
      case null null;
    }
  };

  // ── Routing status helpers ────────────────────────────────────────────────────

  /// Returns the routing status for a caller — used by the frontend to decide
  /// which screen to show on login without any ambiguity.
  ///   #noprofile        — brand-new user, no profile assigned yet → onboarding
  ///   #pending_approval — user has a profile but is awaiting Admin approval → waiting screen
  ///   #profile_pending_super_admin — profile exists but Super Admin hasn't approved it yet
  ///   #active           — user is good to go → normal routing
  ///   #superAdmin       — caller is Super Admin → SA dashboard
  public type RoutingStatus = {
    #noprofile;
    #pending_approval;
    #profile_pending_super_admin;
    #active;
    #superAdmin;
  };

  public func getRoutingStatus(
    store : Store,
    userStore : UserStore,
    notificationsStore : NotificationsLib.Store,
    caller : Common.UserId,
  ) : RoutingStatus {
    switch (userStore.get(caller)) {
      case null {
        // Brand-new user: write welcome notification and return #noprofile
        let _ = NotificationsLib.createWelcomeNotification(notificationsStore, caller);
        #noprofile
      };
      case (?up) {
        // Super Admin always bypasses every gate
        if (up.role == #superAdmin) return #superAdmin;
        // No profile assigned (shouldn't happen for registered users, but guard it)
        if (up.profile_key == "") return #noprofile;
        // Check individual approval status
        let userApproved = switch (up.approval_status) {
          case (?"approved") true;
          case _ false;
        };
        if (not userApproved) return #pending_approval;
        // Check profile-level approval
        switch (store.get(up.profile_key)) {
          case null return #noprofile; // profile was deleted
          case (?profile) {
            switch (profile.profile_approval_status) {
              case (#pending_super_admin_approval) return #profile_pending_super_admin;
              case (#suspended) return #pending_approval;
              case (#approved) {};
            };
          };
        };
        #active
      };
    }
  };

  // ── User preferences ──────────────────────────────────────────────────────────

  /// Returns user preferences for a given principal — fast query, called before first render.
  /// Returns defaults when user is not found (anonymous / brand-new user).
  public func getUserPreferences(userStore : UserStore, caller : Common.UserId) : UserTypes.UserPreferences {
    switch (userStore.get(caller)) {
      case (?up) {
        {
          language = up.language_preference;
          dateFormat = up.date_format;
          defaultReceiptLanguage = up.default_receipt_language;
          whatsappNumber = switch (up.email) { case (?e) e; case null "" };
          theme = up.theme;
        }
      };
      case null {
        { language = "en"; dateFormat = "DD/MM/YYYY"; defaultReceiptLanguage = "en"; whatsappNumber = ""; theme = "dark" }
      };
    }
  };

  /// Updates user preferences — always succeeds (creates entry if missing).
  public func updateUserPreferences(
    userStore : UserStore,
    caller : Common.UserId,
    language : Text,
    dateFormat : Text,
    defaultReceiptLanguage : Text,
    whatsappNumber : Text,
    theme : Text,
  ) : Bool {
    let now = Time.now();
    switch (userStore.get(caller)) {
      case null false; // user must exist before preferences can be updated
      case (?existing) {
        userStore.add(caller, {
          existing with
          language_preference = language;
          date_format = dateFormat;
          default_receipt_language = defaultReceiptLanguage;
          theme;
          email = if (whatsappNumber == "") existing.email else ?whatsappNumber;
          last_updated_by = caller;
          last_update_date = now;
        });
        true
      };
    }
  };

  // ── Super Admin active profile context ───────────────────────────────────────

  /// Returns the profile_key currently active for Super Admin context.
  /// Super Admin can have an optional impersonated profile_key stored in a separate
  /// mechanism; here we return the profile_key stored in the Super Admin's UserProfile,
  /// which the frontend sets via setSuperAdminActiveProfile().
  public func getSuperAdminActiveProfile(userStore : UserStore, caller : Common.UserId) : ?Common.ProfileKey {
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) return null;
        if (up.profile_key == "") null else ?up.profile_key
      };
      case null null;
    }
  };

  /// Sets the active profile_key for Super Admin impersonation context.
  /// Only applicable to Super Admin principals.
  public func setSuperAdminActiveProfile(userStore : UserStore, caller : Common.UserId, profile_key : Common.ProfileKey) : Bool {
    switch (userStore.get(caller)) {
      case null false;
      case (?up) {
        if (up.role != #superAdmin) return false;
        userStore.add(caller, {
          up with
          profile_key;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Update caller's display_name; warehouse_name update allowed for all roles
  public func updateUserProfile(userStore : UserStore, caller : Common.UserId, input : UserTypes.UserProfileInput) : Bool {
    switch (userStore.get(caller)) {
      case null false;
      case (?existing) {
        let updated : UserTypes.UserProfile = {
          existing with
          warehouse_name = input.warehouse_name;
          display_name = input.display_name;
          last_updated_by = caller;
          last_update_date = Time.now();
        };
        userStore.add(caller, updated);
        true
      };
    }
  };

  /// Returns all UserProfile entries for the profile where approval_status = "pending" — Admin/SuperAdmin only.
  /// Super Admin can pass profileKey="" to get ALL pending users across ALL profiles.
  /// Admin must pass their own profile_key to get pending users for their profile.
  public func getPendingApprovalUsers(userStore : UserStore, caller : Common.UserId, profileKey : Common.ProfileKey) : [UserTypes.UserProfilePublic] {
    let callerRole = switch (userStore.get(caller)) {
      case null return [];
      case (?up) up.role;
    };
    if (callerRole != #admin and callerRole != #superAdmin) return [];
    // Super Admin with empty profileKey → return ALL pending users across all profiles
    let filterByProfile = callerRole != #superAdmin or profileKey != "";
    userStore.entries()
      .filter(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : Bool {
        (not filterByProfile or up.profile_key == profileKey) and up.approval_status == ?"pending"
      })
      .map(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : UserTypes.UserProfilePublic {
        {
          principal = up.principal;
          profile_key = up.profile_key;
          role = up.role;
          warehouse_name = up.warehouse_name;
          display_name = up.display_name;
          email = up.email;
          joined_at = up.joined_at;
          approval_status = up.approval_status;
          module_access = up.module_access;
          language_preference = up.language_preference;
          date_format = up.date_format;
          default_receipt_language = up.default_receipt_language;
          theme = up.theme;
        }
      })
      .toArray()
  };

  /// Approve or reject a pending user — Admin or SuperAdmin only.
  /// Sets approval_status to "approved" or "rejected".
  /// Works for both #staff and #referralUser roles.
  public func approveUser(userStore : UserStore, caller : Common.UserId, userId : Common.UserId, approved : Bool) : Bool {
    let callerRole = switch (userStore.get(caller)) {
      case null return false;
      case (?up) up.role;
    };
    if (callerRole != #admin and callerRole != #superAdmin) return false;

    switch (userStore.get(userId)) {
      case null false;
      case (?existing) {
        let newStatus = if (approved) "approved" else "rejected";
        userStore.add(userId, {
          existing with
          approval_status = ?newStatus;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Approve or reject a profile — Super Admin only.
  /// approved=true → #approved; approved=false → #suspended.
  public func approveProfile(store : Store, userStore : UserStore, caller : Common.UserId, profile_key : Common.ProfileKey, approved : Bool) : Bool {
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) return false;
      };
      case null return false;
    };
    switch (store.get(profile_key)) {
      case null false;
      case (?existing) {
        let newStatus : ProfileTypes.ProfileApprovalStatus = if (approved) #approved else #suspended;
        store.add(profile_key, {
          existing with
          profile_approval_status = newStatus;
          last_updated_by = caller;
          last_update_date = Time.now();
        });
        true
      };
    }
  };

  /// Returns all users with role #referralUser for a given profile.
  /// Used to populate the "Referred By" dropdown on the customer form.
  public func getReferralUsers(userStore : UserStore, profile_key : Common.ProfileKey) : [UserTypes.UserProfilePublic] {
    userStore.entries()
      .filter(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : Bool {
        up.profile_key == profile_key and up.role == #referralUser
      })
      .map(func((_k, up) : (Common.UserId, UserTypes.UserProfile)) : UserTypes.UserProfilePublic {
        {
          principal = up.principal;
          profile_key = up.profile_key;
          role = up.role;
          warehouse_name = up.warehouse_name;
          display_name = up.display_name;
          email = up.email;
          joined_at = up.joined_at;
          approval_status = up.approval_status;
          module_access = up.module_access;
          language_preference = up.language_preference;
          date_format = up.date_format;
          default_receipt_language = up.default_receipt_language;
          theme = up.theme;
        }
      })
      .toArray()
  };
};
