/*
 * mixins/customer-notes-api.mo — Customer Notes Public API (Separate Store)
 *
 * WHAT THIS FILE DOES:
 *   Exposes the public canister functions for managing customer notes stored in
 *   the dedicated customerNotesStore. This is the ACTIVE notes API.
 *
 *   Public functions exposed:
 *     - addCustomerNoteV2        : create a new note for a customer
 *     - getCustomerNotes         : list all notes for a customer (newest-first)
 *     - getAllCustomerNotesForProfile : list all notes for a profile (Super Admin / Data Inspector)
 *     - updateCustomerNote       : update the text of an existing note
 *     - deleteCustomerNote       : permanently remove a note
 *
 * WHO USES IT:
 *   The frontend's Customer Notes section (customer detail page, notes tab) calls
 *   these functions. The Super Admin Data Inspector page uses getAllCustomerNotesForProfile.
 *
 * WHY SEPARATE FROM customer-goals-medical-api.mo:
 *   The notes store is now independent — it has its own stable store and ID counter
 *   in main.mo. Separating the API into its own mixin keeps each file focused on
 *   one responsibility and avoids bloating customer-goals-medical-api.mo further.
 *
 * NOTE ON LEGACY NOTES:
 *   This mixin does NOT touch the legacy Customer.notes embedded array.
 *   Legacy notes remain readable via getCustomer() → CustomerPublic.notes.
 *   New notes created here go to customerNotesStore only (CustomerNoteV2 type).
 *   The frontend should display both sources during the migration window.
 *
 * ACCESS CONTROL:
 *   - All functions require the caller to be authenticated (non-anonymous).
 *   - All mutations verify the note/customer belongs to the caller's profile.
 *   - getAllCustomerNotesForProfile is open to any authenticated user (Super Admin
 *     passes any profile key; regular users are scoped to their own profile by
 *     the lib function's auth check).
 *
 * SUPER ADMIN IMPERSONATION:
 *   When Super Admin calls createGoal / addCustomerNoteV2 etc., their profile_key
 *   in userStore reflects the currently impersonated profile (set via
 *   setSuperAdminActiveProfile in profile-api.mo). So all writes are correctly
 *   scoped to the impersonated profile automatically.
 */

import Runtime "mo:core/Runtime";
import Common "../types/common";
import CustomerTypes "../types/customers";
import CustomerNotesLib "../lib/customer-notes";
import ProfileLib "../lib/profile";
import CustomersLib "../lib/customers";

mixin (
  // The dedicated notes store — one entry per CustomerNoteV2, keyed by note ID.
  // This store is declared as: let customerNotesStore : CustomerNotesLib.CustomerNotesStore = Map.empty()
  // in main.mo, alongside customerNoteIdCounter : Nat = 0.
  customerNotesStore : CustomerNotesLib.CustomerNotesStore,

  // The customer store is needed to verify customer existence and profile ownership
  // before a note can be written (addNote traps if customer not found / wrong profile).
  customerStore : CustomersLib.CustomerStore,

  // User store is needed for auth — every function derives the caller's profile_key
  // from their user record. Super Admin's profile_key is updated on impersonation.
  userStore : ProfileLib.UserStore,
) {

  // Auto-incrementing note ID counter for V2 separate store.
  // Named nextCustomerNoteIdV2 to avoid collision with the identically-named
  // var in customers-api.mo and core-bug-fixes-profile-sales-notifications-api.mo,
  // which track embedded-note IDs on the legacy Customer record.
  // Starts at 1. Incremented after each successful addNote call.
  var nextCustomerNoteIdV2 : Nat = 1;

  // ── addCustomerNoteV2 ────────────────────────────────────────────────────
  // Creates a new note for a customer in the dedicated customerNotesStore.
  //
  // This is the primary way to add notes in the new notes system.
  // The note is stored independently of the Customer record.
  //
  // PARAMETERS (via CustomerNoteV2Input):
  //   customer_id  — which customer to attach the note to
  //   profile_key  — must match the caller's active profile (verified server-side)
  //   note         — the text content of the note
  //   date         — user-provided date string (e.g. "2025-04-29")
  //
  // RETURNS: CustomerNotePublic — the created note with server-assigned id, timestamps, etc.
  //
  // TRAPS IF: caller not registered, customer not found, or profile mismatch.
  public shared ({ caller }) func addCustomerNoteV2(
    input : CustomerTypes.CustomerNoteV2Input
  ) : async CustomerTypes.CustomerNotePublic {
    // Reject anonymous callers — notes must be attributed to a real user
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");

    let note = CustomerNotesLib.addNote(
      customerNotesStore,
      nextCustomerNoteIdV2,
      customerStore,
      userStore,
      caller,
      input,
    );
    nextCustomerNoteIdV2 += 1; // advance the counter after successful creation
    note
  };

  // ── getCustomerNotes ─────────────────────────────────────────────────────
  // Returns all notes for a specific customer from the dedicated notes store.
  // Results are scoped to the caller's profile and sorted newest-first.
  //
  // PARAMETER: customerId — the Nat ID of the customer whose notes to retrieve.
  // RETURNS: [CustomerNotePublic] — may be empty if no notes exist yet.
  //
  // This is a query function (read-only, no state change) so it is faster and
  // cheaper than an update call.
  public shared query ({ caller }) func getCustomerNotes(
    customerId : Common.CustomerId
  ) : async [CustomerTypes.CustomerNotePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomerNotesLib.getNotesByCustomer(customerNotesStore, userStore, caller, customerId)
  };

  // ── getAllCustomerNotesForProfile ─────────────────────────────────────────
  // Returns ALL notes for a given profile, across all customers.
  //
  // PRIMARY USE CASE: Super Admin Data Inspector page — allows browsing all raw
  // note records for any profile without opening individual customer records.
  //
  // PARAMETER: profileKey — the profile whose notes to return.
  //   Regular users: pass their own profile key (the lib function verifies ownership).
  //   Super Admin:   may pass any profile key when impersonating.
  //
  // RETURNS: [CustomerNotePublic] — all notes for the profile, newest-first.
  public shared query ({ caller }) func getAllCustomerNotesForProfile(
    profileKey : Common.ProfileKey
  ) : async [CustomerTypes.CustomerNotePublic] {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomerNotesLib.getAllNotesForProfile(customerNotesStore, userStore, caller, profileKey)
  };

  // ── updateCustomerNote ────────────────────────────────────────────────────
  // Updates the text of an existing note.
  // Only the note text can be changed — customer_id, profile_key, and date are immutable.
  //
  // PARAMETERS:
  //   noteId     — the ID of the note to update
  //   newText    — the new text content
  //   profileKey — must match the note's stored profile_key (cross-profile edits denied)
  //
  // RETURNS: ?CustomerNotePublic — the updated note, or null if not found / access denied.
  //   null means the note was not found or the caller does not own it.
  //   The frontend should show an appropriate "not found" message on null.
  public shared ({ caller }) func updateCustomerNote(
    noteId : Nat,
    newText : Text,
    profileKey : Common.ProfileKey,
  ) : async ?CustomerTypes.CustomerNotePublic {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomerNotesLib.updateNote(customerNotesStore, userStore, caller, noteId, newText, profileKey)
  };

  // ── deleteCustomerNote ────────────────────────────────────────────────────
  // Permanently removes a note from the customerNotesStore by its note ID.
  // This is a hard delete — there is no undo or archive.
  //
  // PARAMETERS:
  //   noteId     — the ID of the note to delete
  //   profileKey — must match the note's stored profile_key (prevents cross-profile deletes)
  //
  // RETURNS: Bool — true if deleted, false if note not found or profile mismatch.
  //   false is returned instead of trapping so the frontend can gracefully handle
  //   "already deleted" without seeing a canister error screen.
  public shared ({ caller }) func deleteCustomerNote(
    noteId : Nat,
    profileKey : Common.ProfileKey,
  ) : async Bool {
    if (caller.isAnonymous()) Runtime.trap("Anonymous caller not allowed");
    CustomerNotesLib.deleteNote(customerNotesStore, userStore, caller, noteId, profileKey)
  };

};
