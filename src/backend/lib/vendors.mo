/*
 * FILE: lib/vendors.mo
 * MODULE: lib
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Implements CRUD for vendor/supplier records used on Purchase Orders.
 *   Admin, Staff, and Super Admin can create and update vendors.
 *
 * FLOW:
 *   PAGE: Vendor page (sidebar under Purchasing)
 *     getVendors(profileKey) → all vendors for the profile
 *     createVendor(profileKey, input) → creates vendor with unique timestamp-based ID
 *       If input.is_default=true: clears is_default on all other vendors first
 *     updateVendor(vendorId, input) → update all mutable fields
 *     deleteVendor(vendorId) → Admin only (not staff)
 *
 *   PAGE: Create PO
 *     getVendors() is called to populate the vendor selector
 *     If only one vendor exists → auto-selected as default
 *     If no vendor exists → "Quick Create Vendor" inline form shown
 *       → calls createVendor() from within the PO form
 *     getVendor(vendorId) → single vendor lookup for PO detail view
 *
 * DEPENDENCIES:
 *   imports: mo:core/Map, mo:core/Time, mo:core/Runtime, types/common,
 *            types/vendors, types/users
 *   called by: mixins/vendors-api.mo, lib/purchases.mo (vendor lookup)
 *
 * KEY TYPES:
 *   Store     — Map<Text, Vendor>  (Text key = generated ID)
 *   UserStore — Map<UserId, UserProfile>
 *
 * IMPORTANT — Vendor ID generation:
 *   Vendor IDs are generated as: profileKey + "-vendor-" + timestamp + "-" + store.size()
 *   This ensures uniqueness without a separate counter variable.
 * ─────────────────────────────────────────────────────────────────────
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import VendorTypes "../types/vendors";
import UserTypes "../types/users";

module {
  public type Store = Map.Map<Text, VendorTypes.Vendor>;
  public type UserStore = Map.Map<Common.UserId, UserTypes.UserProfile>;

  // ── Read ──────────────────────────────────────────────────────────────────────

  /// Returns all vendors for a given profile. Any authenticated role may read.
  public func getVendors(store : Store, userStore : UserStore, caller : Common.UserId, profileKey : Text) : [VendorTypes.Vendor] {
    // Validate caller is registered
    switch (userStore.get(caller)) {
      case null Runtime.trap("Caller has no profile");
      case (?_) {};
    };
    store.entries()
      .filter(func((_id, v) : (Text, VendorTypes.Vendor)) : Bool {
        v.profile_key == profileKey
      })
      .map(func((_id, v) : (Text, VendorTypes.Vendor)) : VendorTypes.Vendor { v })
      .toArray()
  };

  /// Returns a single vendor by id.
  public func getVendor(store : Store, vendorId : Text) : ?VendorTypes.Vendor {
    store.get(vendorId)
  };

  // ── Write ─────────────────────────────────────────────────────────────────────

  /// Creates a vendor. Admin or staff only.
  /// If input.is_default is true, clears is_default on all other vendors in the profile first.
  public func createVendor(store : Store, userStore : UserStore, caller : Common.UserId, input : VendorTypes.VendorInput, profileKey : Text) : ?VendorTypes.Vendor {
    let up = switch (userStore.get(caller)) {
      case null return null;
      case (?u) u;
    };
    if (up.role != #admin and up.role != #staff and up.role != #superAdmin) return null;

    let now = Time.now();

    // If this vendor is being set as default, clear existing default flag on others
    if (input.is_default) {
      let toUpdate = store.entries()
        .filter(func((_id, v) : (Text, VendorTypes.Vendor)) : Bool {
          v.profile_key == profileKey and v.is_default
        })
        .map(func((id, v)) { (id, v) })
        .toArray();
      for ((id, v) in toUpdate.values()) {
        store.add(id, { v with is_default = false; last_updated_by = caller; last_update_date = now });
      };
    };

    // Generate a unique ID using profile_key + timestamp + size
    let id = profileKey # "-vendor-" # now.toText() # "-" # store.size().toText();

    let vendor : VendorTypes.Vendor = {
      id;
      profile_key = profileKey;
      name = input.name;
      contact_name = input.contact_name;
      phone = input.phone;
      email = input.email;
      address = input.address;
      is_default = input.is_default;
      created_by = caller;
      creation_date = now;
      last_updated_by = caller;
      last_update_date = now;
    };
    store.add(id, vendor);
    ?vendor
  };

  /// Updates a vendor. Admin or staff only.
  public func updateVendor(store : Store, userStore : UserStore, caller : Common.UserId, vendorId : Text, input : VendorTypes.VendorInput) : Bool {
    let up = switch (userStore.get(caller)) {
      case null return false;
      case (?u) u;
    };
    if (up.role != #admin and up.role != #staff and up.role != #superAdmin) return false;

    let existing = switch (store.get(vendorId)) {
      case null return false;
      case (?v) v;
    };
    // Must belong to caller's profile (or superAdmin can update any)
    if (up.role != #superAdmin and existing.profile_key != up.profile_key) return false;

    let now = Time.now();

    // If setting as default, clear others in the same profile
    if (input.is_default and not existing.is_default) {
      let toUpdate = store.entries()
        .filter(func((_id, v) : (Text, VendorTypes.Vendor)) : Bool {
          v.profile_key == existing.profile_key and v.is_default and v.id != vendorId
        })
        .map(func((id, v)) { (id, v) })
        .toArray();
      for ((id, v) in toUpdate.values()) {
        store.add(id, { v with is_default = false; last_updated_by = caller; last_update_date = now });
      };
    };

    store.add(vendorId, {
      existing with
      name = input.name;
      contact_name = input.contact_name;
      phone = input.phone;
      email = input.email;
      address = input.address;
      is_default = input.is_default;
      last_updated_by = caller;
      last_update_date = now;
    });
    true
  };

  /// Deletes a vendor. Admin only.
  public func deleteVendor(store : Store, userStore : UserStore, caller : Common.UserId, vendorId : Text) : Bool {
    let up = switch (userStore.get(caller)) {
      case null return false;
      case (?u) u;
    };
    if (up.role != #admin and up.role != #superAdmin) return false;

    let existing = switch (store.get(vendorId)) {
      case null return false;
      case (?v) v;
    };
    if (up.role != #superAdmin and existing.profile_key != up.profile_key) return false;

    store.remove(vendorId);
    true
  };
};
