/*
 * lib/leads.mo — Marketing Lead Business Logic
 *
 * WHAT THIS FILE DOES:
 *   Manages demo/contact request leads submitted from the public marketing Index page:
 *     - createLead: no auth required — anyone can submit a lead from the Index page
 *     - getLeads / getLead: Super Admin only — view all submitted leads
 *     - closeLead: Super Admin marks a lead as closed and optionally sets a profile_link
 *                  (an onboarding URL the Super Admin can share via WhatsApp)
 *     - deleteLead: Super Admin permanently removes a lead
 *
 * WHO USES IT:
 *   mixins/leads-api.mo (public API layer)
 *
 * HOW IT FITS INTO THE FLOW:
 *   1. Visitor fills demo request form on the Index page → createLead() called (no login)
 *   2. Super Admin sees the lead in their dashboard → calls getLeads()
 *   3. Super Admin contacts the lead via WhatsApp (frontend formats the number/message)
 *   4. Super Admin closes the lead and provides a profile creation link via closeLead()
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import LeadTypes "../types/leads";
import UserTypes "../types/users";

module {
  public type LeadStore = Map.Map<Nat, LeadTypes.Lead>;

  // ── Auth helper ───────────────────────────────────────────────────────────────

  func requireSuperAdmin(userStore : Map.Map<Common.UserId, UserTypes.UserProfile>, caller : Common.UserId) {
    switch (userStore.get(caller)) {
      case (?up) {
        if (up.role != #superAdmin) Runtime.trap("Super Admin access required");
      };
      case null Runtime.trap("Caller has no profile");
    };
  };

  // ── Create ────────────────────────────────────────────────────────────────────

  /// Create a new lead from the public marketing page — no auth required.
  /// Returns the new lead record.
  public func createLead(
    store : LeadStore,
    nextId : Nat,
    input : LeadTypes.LeadInput,
  ) : LeadTypes.Lead {
    let lead : LeadTypes.Lead = {
      id = nextId;
      name = input.name;
      business_name = input.business_name;
      phone = input.phone;
      email = input.email;
      message = input.message;
      created_at = Time.now();
      is_closed = false;
      profile_link = null;
    };
    store.add(nextId, lead);
    lead
  };

  // ── Read ──────────────────────────────────────────────────────────────────────

  /// Returns all leads — Super Admin only; caller must have #superAdmin role.
  public func getLeads(
    store : LeadStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : [LeadTypes.Lead] {
    requireSuperAdmin(userStore, caller);
    store.entries()
      .map(func((_id, lead) : (Nat, LeadTypes.Lead)) : LeadTypes.Lead { lead })
      .toArray()
  };

  /// Returns a single lead by id — Super Admin only.
  public func getLead(
    store : LeadStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
  ) : ?LeadTypes.Lead {
    requireSuperAdmin(userStore, caller);
    store.get(id)
  };

  // ── Update ────────────────────────────────────────────────────────────────────

  /// Close a lead and optionally set the profile_link to an onboarding URL.
  /// Super Admin only.
  public func closeLead(
    store : LeadStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
    profile_link : ?Text,
  ) : Bool {
    requireSuperAdmin(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?existing) {
        store.add(id, {
          existing with
          is_closed = true;
          profile_link;
        });
        true
      };
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  /// Delete a lead permanently — Super Admin only.
  public func deleteLead(
    store : LeadStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    id : Nat,
  ) : Bool {
    requireSuperAdmin(userStore, caller);
    switch (store.get(id)) {
      case null false;
      case (?_) {
        store.remove(id);
        true
      };
    }
  };
};
