import Runtime "mo:core/Runtime";
import Common "../types/common";
import LocationMasterLib "../lib/location-master";

mixin (
  locationMasterStore : LocationMasterLib.Store,
) {
  public shared query ({ caller }) func getStates() : async [Common.LocationMasterEntry] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LocationMasterLib.getStates(locationMasterStore)
  };

  public shared query ({ caller }) func getCitiesByState(stateId : Text) : async [Common.LocationMasterEntry] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LocationMasterLib.getCitiesByState(locationMasterStore, stateId)
  };

  public shared query ({ caller }) func getCountries() : async [Common.LocationMasterEntry] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LocationMasterLib.getCountries(locationMasterStore)
  };

  public shared ({ caller }) func addLocationEntry(entry : Common.LocationMasterEntry) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LocationMasterLib.addEntry(locationMasterStore, entry)
  };
};
