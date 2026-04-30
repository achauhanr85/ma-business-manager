/*
 * lib/customer-notes.mo — Customer Notes Business Logic (Separate Store)
 *
 * WHAT THIS FILE DOES:
 *   Implements all CRUD business logic for customer notes stored in the dedicated
 *   customerNotesStore (a Map<Nat, CustomerNoteV2> declared in main.mo).
 *
 *   This is the ACTIVE notes system. Notes are stored independently of the
 *   Customer record — each note is a first-class record keyed by its own unique ID.
 *   This makes it possible to update or delete individual notes without rewriting
 *   the entire customer record.
 *
 * WHY A SEPARATE STORE?
 *   The legacy approach stored notes as an embedded array on the Customer record
 *   (Customer.notes : [CustomerNote]). This had two problems:
 *     1. Updating a single note required rewriting the whole Customer record.
 *     2. Deleting a note required filtering the array and rewriting Customer.
 *   With a dedicated store, each note is independently addressable by note ID.
 *
 * WHO USES IT:
 *   mixins/customer-notes-api.mo — the public API layer that exposes these functions
 *   to the frontend via the Internet Computer canister interface.
 *
 * DATA ISOLATION:
 *   Every function that mutates data verifies that the note's profile_key matches
 *   the caller's profile_key (derived from the userStore). This ensures strict
 *   multi-tenant isolation — no profile can read or write another profile's notes.
 *
 * MIGRATION NOTE:
 *   Customer.notes (the legacy embedded array) is NOT modified by this module.
 *   Existing legacy notes remain on the customer record unchanged.
 *   All NEW notes created via this module go to customerNotesStore only.
 *   The frontend is responsible for merging both sources if needed during transition.
 */

import Map "mo:core/Map";
import Time "mo:core/Time";
import Runtime "mo:core/Runtime";
import Common "../types/common";
import CustomerTypes "../types/customers";
import UserTypes "../types/users";

module {

  // ── Store type alias ──────────────────────────────────────────────────────
  // The canonical type for the notes store used in main.mo and the mixin.
  // Keyed by note ID (Nat, auto-incremented), value is the full CustomerNoteV2 record.
  public type CustomerNotesStore = Map.Map<Nat, CustomerTypes.CustomerNoteV2>;

  // ── CustomerStore type alias ──────────────────────────────────────────────
  // Referenced to verify customer existence and profile ownership before writing.
  // Imported indirectly from lib/customers.mo via map type alias.
  public type CustomerStore = Map.Map<Common.CustomerId, CustomerTypes.Customer>;

  // ── Private helper: resolve caller's profile key ──────────────────────────
  // Every function that needs to scope data to a profile calls this first.
  // It looks up the caller's principal in the userStore and returns their profile_key.
  // If the caller has no user record (not yet registered), it traps with a clear message.
  func callerProfileKey(
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
  ) : Common.ProfileKey {
    switch (userStore.get(caller)) {
      case (?up) up.profile_key;
      case null Runtime.trap("Caller has no profile — register or join a profile first");
    }
  };

  // ── Private helper: convert CustomerNoteV2 to CustomerNotePublic ──────────
  // Converts Principal fields to Text so the record can be returned across the
  // canister boundary (shared types only — Principal is shared but Text is more
  // human-readable and matches frontend expectations).
  func toPublic(n : CustomerTypes.CustomerNoteV2) : CustomerTypes.CustomerNotePublic {
    {
      id = n.id;
      customer_id = n.customer_id;
      profile_key = n.profile_key;
      note = n.note;
      date = n.date;
      created_by = n.created_by.toText();          // Principal → Text for frontend
      creation_date = n.creation_date;
      last_updated_by = n.last_updated_by.toText(); // Principal → Text for frontend
      last_updated_date = n.last_updated_date;
    }
  };

  // ── addNote ───────────────────────────────────────────────────────────────
  // Creates a new note in the dedicated customerNotesStore.
  //
  // PARAMETERS:
  //   store      — the customerNotesStore map (mutated in place)
  //   idCounter  — the next available note ID (caller increments after this returns)
  //   customerStore — used to verify the customer exists in the caller's profile
  //   userStore  — used to derive the caller's profile_key
  //   caller     — the Internet Identity principal of the requesting user
  //   input      — the note content and metadata (customer_id, profile_key, note, date)
  //
  // RETURNS: CustomerNotePublic — the newly created note with all server-set fields.
  //
  // TRAPS IF:
  //   - caller is not in the userStore (not registered)
  //   - customer_id does not exist in customerStore
  //   - customer's profile_key does not match the caller's profile_key
  //   - input.profile_key does not match the caller's profile_key
  public func addNote(
    store : CustomerNotesStore,
    idCounter : Nat,
    customerStore : CustomerStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    input : CustomerTypes.CustomerNoteV2Input,
  ) : CustomerTypes.CustomerNotePublic {
    let profileKey = callerProfileKey(userStore, caller);

    // Verify the input profile_key matches the caller's profile — prevent cross-profile writes
    if (input.profile_key != profileKey) {
      Runtime.trap("Profile key mismatch — cannot write note to a different profile");
    };

    // Verify the customer exists and belongs to the caller's profile
    switch (customerStore.get(input.customer_id)) {
      case null Runtime.trap("Customer not found: " # input.customer_id.toText());
      case (?c) {
        if (c.profile_key != profileKey) {
          Runtime.trap("Customer does not belong to caller's profile");
        };
      };
    };

    let now = Time.now();
    let note : CustomerTypes.CustomerNoteV2 = {
      id = idCounter;
      customer_id = input.customer_id;
      profile_key = profileKey;  // always derive from userStore, never trust client input
      note = input.note;
      date = input.date;
      created_by = caller;          // Principal — authoritative from the canister runtime
      creation_date = now;
      last_updated_by = caller;
      last_updated_date = now;
    };
    store.add(idCounter, note);
    toPublic(note)
  };

  // ── getNotesByCustomer ─────────────────────────────────────────────────────
  // Returns all notes for a specific customer, filtered to the caller's profile.
  // Results are sorted newest-first by creation_date.
  //
  // PARAMETERS:
  //   store       — the customerNotesStore to query
  //   userStore   — used to derive the caller's profile_key
  //   caller      — the requesting user's principal
  //   customerId  — the customer whose notes to return
  //
  // RETURNS: [CustomerNotePublic] — array of notes, newest first. Empty if none found.
  //
  // TRAPS IF: caller is not in userStore.
  public func getNotesByCustomer(
    store : CustomerNotesStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    customerId : Nat,
  ) : [CustomerTypes.CustomerNotePublic] {
    let profileKey = callerProfileKey(userStore, caller);
    // Filter to only this customer's notes in the caller's profile, then sort newest-first
    let results = store.entries()
      .filter(func((_id, n) : (Nat, CustomerTypes.CustomerNoteV2)) : Bool {
        n.customer_id == customerId and n.profile_key == profileKey
      })
      .map(func((_id, n) : (Nat, CustomerTypes.CustomerNoteV2)) : CustomerTypes.CustomerNotePublic {
        toPublic(n)
      })
      .toArray();
    // Sort by creation_date descending — most recently created note appears first
    results.sort(func(a, b) {
      if (a.creation_date > b.creation_date) #less
      else if (a.creation_date < b.creation_date) #greater
      else #equal
    })
  };

  // ── getAllNotesForProfile ──────────────────────────────────────────────────
  // Returns ALL notes across all customers for a given profile.
  // Intended for Super Admin / Data Inspector use — allows browsing all notes.
  //
  // PARAMETERS:
  //   store      — the customerNotesStore to query
  //   userStore  — used to verify and derive the caller's profile_key
  //   caller     — the requesting user's principal
  //   profileKey — the profile whose notes to return
  //              (Super Admin may pass any profile key when impersonating)
  //
  // RETURNS: [CustomerNotePublic] — all notes for the profile, newest first.
  //
  // NOTE: The caller's own profile_key is used for regular users.
  //       Super Admin passes the target profile key explicitly via the mixin.
  public func getAllNotesForProfile(
    store : CustomerNotesStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    profileKey : Common.ProfileKey,
  ) : [CustomerTypes.CustomerNotePublic] {
    // Auth check — caller must be registered (traps if not)
    let _ = callerProfileKey(userStore, caller);
    let results = store.entries()
      .filter(func((_id, n) : (Nat, CustomerTypes.CustomerNoteV2)) : Bool {
        n.profile_key == profileKey
      })
      .map(func((_id, n) : (Nat, CustomerTypes.CustomerNoteV2)) : CustomerTypes.CustomerNotePublic {
        toPublic(n)
      })
      .toArray();
    results.sort(func(a, b) {
      if (a.creation_date > b.creation_date) #less
      else if (a.creation_date < b.creation_date) #greater
      else #equal
    })
  };

  // ── updateNote ────────────────────────────────────────────────────────────
  // Updates the note text of an existing note.
  // Only the note text can be updated — customer_id, date, and profile_key are immutable.
  //
  // PARAMETERS:
  //   store      — the customerNotesStore (mutated in place)
  //   userStore  — used to derive and verify the caller's profile_key
  //   caller     — the user making the update (recorded in last_updated_by)
  //   noteId     — ID of the note to update
  //   newText    — the new note text content
  //   profileKey — the profile the note should belong to (verified against store record)
  //
  // RETURNS: ?CustomerNotePublic — the updated note, or null if not found / access denied.
  //
  // Returns null (does NOT trap) on not-found or wrong-profile, so the mixin can
  // return a user-friendly error to the frontend without crashing the canister.
  public func updateNote(
    store : CustomerNotesStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    noteId : Nat,
    newText : Text,
    profileKey : Common.ProfileKey,
  ) : ?CustomerTypes.CustomerNotePublic {
    let callerKey = callerProfileKey(userStore, caller);
    // Verify the caller's profile matches the profileKey they claim
    if (callerKey != profileKey) return null;

    switch (store.get(noteId)) {
      case null null; // note not found — return null (frontend handles "not found" state)
      case (?existing) {
        // Verify the note belongs to the caller's profile — prevent cross-profile edits
        if (existing.profile_key != profileKey) return null;
        let updated : CustomerTypes.CustomerNoteV2 = {
          existing with
          note = newText;                    // only the text changes
          last_updated_by = caller;          // record who made this change
          last_updated_date = Time.now();    // record when the change was made
        };
        store.add(noteId, updated);
        ?toPublic(updated)
      };
    }
  };

  // ── deleteNote ────────────────────────────────────────────────────────────
  // Permanently removes a note from the customerNotesStore.
  // This is a hard delete — there is no soft-delete or archive.
  //
  // PARAMETERS:
  //   store      — the customerNotesStore (mutated in place)
  //   userStore  — used to derive the caller's profile_key
  //   caller     — the requesting user's principal
  //   noteId     — the ID of the note to delete
  //   profileKey — the profile the note must belong to (verified before deletion)
  //
  // RETURNS: Bool — true if deleted, false if not found or access denied.
  //
  // Design choice: returns false instead of trapping so the frontend can handle
  // "already deleted" gracefully without seeing a canister error.
  public func deleteNote(
    store : CustomerNotesStore,
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>,
    caller : Common.UserId,
    noteId : Nat,
    profileKey : Common.ProfileKey,
  ) : Bool {
    let callerKey = callerProfileKey(userStore, caller);
    if (callerKey != profileKey) return false; // profile mismatch — access denied

    switch (store.get(noteId)) {
      case null false; // note already gone — treat as success-ish, return false
      case (?existing) {
        if (existing.profile_key != profileKey) return false; // wrong profile — deny
        store.remove(noteId);
        true
      };
    }
  };

};
