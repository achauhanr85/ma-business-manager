/*
 * FILE: mixins/vendors-api.mo
 * MODULE: mixin
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Exposes public canister functions for vendor/supplier management.
 *   Delegates all logic to lib/vendors.mo.
 *
 * FLOW:
 *   PAGE: Vendor page (sidebar → Purchasing → Vendor)
 *     getVendors(profileKey) → all vendors for the profile
 *     createVendor(profileKey, input) → new vendor; if is_default=true, clears others
 *     updateVendor(vendorId, input) → update name, phone, is_default, etc.
 *     deleteVendor(vendorId) → Admin only
 *
 *   PAGE: Create PO (vendor quick-create inline)
 *     createVendor(profileKey, input) is called directly from the PO form
 *     when the user clicks "Quick Create" because no vendor exists yet.
 *     After creation the PO form re-fetches getVendors() and auto-selects the new vendor.
 *
 *   NOTE — parameter order:
 *     createVendor(profileKey, input) — profileKey is first.
 *     This matches the frontend call convention from both the PO page and the Vendor page.
 *
 * DEPENDENCIES:
 *   imports: mo:core/Runtime, types/common, types/vendors, lib/vendors, lib/profile
 *   called by: main.mo (include VendorsApi(...))
 * ─────────────────────────────────────────────────────────────────────
 */

import Runtime "mo:core/Runtime";
import Common "../types/common";
import VendorTypes "../types/vendors";
import VendorsLib "../lib/vendors";
import ProfileLib "../lib/profile";

mixin (
  vendorStore : VendorsLib.Store,
  userStore : ProfileLib.UserStore,
) {
  public shared query ({ caller }) func getVendors(profileKey : Text) : async [VendorTypes.Vendor] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    VendorsLib.getVendors(vendorStore, userStore, caller, profileKey)
  };

  public shared query ({ caller }) func getVendor(vendorId : Text) : async ?VendorTypes.Vendor {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    VendorsLib.getVendor(vendorStore, vendorId)
  };

  // NOTE — parameter order: profileKey first, then input.
  // The frontend (PO page and Vendor page) calls createVendor(profileKey, input).
  // Keeping profileKey as the first argument matches the frontend call convention.
  public shared ({ caller }) func createVendor(profileKey : Text, input : VendorTypes.VendorInput) : async ?VendorTypes.Vendor {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    VendorsLib.createVendor(vendorStore, userStore, caller, input, profileKey)
  };

  public shared ({ caller }) func updateVendor(vendorId : Text, input : VendorTypes.VendorInput) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    VendorsLib.updateVendor(vendorStore, userStore, caller, vendorId, input)
  };

  public shared ({ caller }) func deleteVendor(vendorId : Text) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    VendorsLib.deleteVendor(vendorStore, userStore, caller, vendorId)
  };
};
