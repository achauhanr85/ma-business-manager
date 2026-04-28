import Runtime "mo:core/Runtime";
import Common "../types/common";
import LeadTypes "../types/leads";
import LeadsLib "../lib/leads";
import ProfileLib "../lib/profile";

mixin (
  leadStore : LeadsLib.LeadStore,
  userStore : ProfileLib.UserStore,
) {
  var nextLeadId : Nat = 1;

  // ── Public — no auth required ─────────────────────────────────────────────────

  /// Submit a demo/inquiry lead from the public marketing page.
  /// Anyone may call this — including anonymous callers.
  public shared func submitLead(input : LeadTypes.LeadInput) : async LeadTypes.Lead {
    let lead = LeadsLib.createLead(leadStore, nextLeadId, input);
    nextLeadId += 1;
    lead
  };

  // ── Super Admin only ──────────────────────────────────────────────────────────

  /// Returns all leads. Super Admin only.
  public shared query ({ caller }) func getLeads() : async [LeadTypes.Lead] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LeadsLib.getLeads(leadStore, userStore, caller)
  };

  /// Returns a single lead by id. Super Admin only.
  public shared query ({ caller }) func getLead(id : Nat) : async ?LeadTypes.Lead {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LeadsLib.getLead(leadStore, userStore, caller, id)
  };

  /// Close a lead and optionally record the onboarding profile link sent to the lead.
  /// Super Admin only.
  public shared ({ caller }) func closeLead(id : Nat, profile_link : ?Text) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LeadsLib.closeLead(leadStore, userStore, caller, id, profile_link)
  };

  /// Delete a lead. Super Admin only.
  public shared ({ caller }) func deleteLead(id : Nat) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    LeadsLib.deleteLead(leadStore, userStore, caller, id)
  };
};
