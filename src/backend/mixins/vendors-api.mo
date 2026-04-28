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

  public shared ({ caller }) func createVendor(input : VendorTypes.VendorInput, profileKey : Text) : async ?VendorTypes.Vendor {
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
