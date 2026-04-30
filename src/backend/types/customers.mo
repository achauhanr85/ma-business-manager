/*
 * types/customers.mo — Customer Domain Type Definitions
 *
 * WHAT THIS FILE DOES:
 *   Defines all data shapes (types/records) for the customer domain, including:
 *     - Customer (main record with all profile, lifecycle, and reference fields)
 *     - CustomerNote / CustomerNoteV2 (embedded legacy and separate-store variants)
 *     - CustomerNoteInput / CustomerNoteV2Input (create inputs)
 *     - CustomerNotePublic (frontend-safe projection of CustomerNoteV2)
 *     - CustomerInput / CustomerPublic (create input and frontend projection)
 *     - BodyCompositionEntry / BodyCompositionInput
 *     - BodyInchesEntry / BodyInchesInput / BodyInchesPublic
 *
 * WHO USES IT:
 *   - lib/customers.mo          (customer business logic)
 *   - lib/customer-notes.mo     (separate notes store logic)
 *   - lib/customer-goals-medical.mo (body inches, goals, medical issues)
 *   - mixins/customers-api.mo
 *   - mixins/customer-notes-api.mo
 *   - mixins/customer-goals-medical-api.mo
 *
 * MIGRATION NOTE — CustomerNote vs CustomerNoteV2:
 *   The original CustomerNote type is embedded as an array on the Customer record
 *   (Customer.notes). This is the LEGACY approach — notes are part of the customer
 *   record and updated by re-writing the whole customer on every note change.
 *
 *   CustomerNoteV2 is the NEW approach — notes live in a separate dedicated store
 *   (customerNotesStore in main.mo), keyed by note ID. This allows independent
 *   CRUD without touching the customer record, and enables proper update/delete.
 *
 *   Both types co-exist. The Customer.notes array is kept for backward compatibility
 *   (existing data is preserved). All new notes are written to customerNotesStore
 *   using CustomerNoteV2 via the customer-notes-api.mo mixin.
 *
 * STATUS: Active. Do not remove or rename fields without updating all importers.
 */

import Common "common";

module {
  // ── Customer ─────────────────────────────────────────────────────────────────
  // discount_applicable / discount_value define the customer's default discount.
  // When a sale is created for this customer the sales engine reads these fields
  // and applies the discount automatically to the subtotal.
  //
  // Dry-run: Discount/Order Edit Collision
  //   Customer has discount_applicable = #Percentage, discount_value = 10.0
  //   New sale item costs $100 → subtotal = $100
  //   Applied discount = 100 * (10/100) = $10
  //   Final sale price = $90.  balance_due updated on the Sale record accordingly.
  //
  // notes: append-only log of LEGACY CustomerNote entries (embedded on customer record).
  //        New notes go to customerNotesStore via CustomerNoteV2 — see migration note above.
  //
  // Referral fields:
  //   referred_by               — display name or principal text of the Referral User
  //                               who referred this customer. Null if walk-in.
  //   referral_commission_amount — commission amount accrued for this customer's sales
  //                                to the referring Referral User. Null if not referred.
  //
  // primary_goal_ids  — IDs from GoalMaster referencing the customer's primary goals
  // medical_issue_ids — IDs from MedicalIssueMaster referencing the customer's conditions
  // lead_to_active_datetime — timestamp when customer status changed from #lead to #active

  // ── CustomerNote (LEGACY — embedded on Customer record) ───────────────────────
  // MIGRATION NOTE: This type is kept for backward compatibility only.
  //   Existing notes stored in Customer.notes use this type.
  //   All NEW notes should be created via addCustomerNoteV2() which uses the
  //   separate customerNotesStore (CustomerNoteV2 type below).
  //   Do not add new fields here — extend CustomerNoteV2 instead.
  public type CustomerNote = {
    id : Nat;
    text : Text;
    note_date : Common.Timestamp;
    created_by : Text;
    creation_date : Common.Timestamp;
  };

  // ── CustomerNoteInput (LEGACY — for embedded note append) ─────────────────────
  // Used only by the legacy addCustomerNote() path that appends to Customer.notes.
  // New code should use CustomerNoteV2Input instead.
  public type CustomerNoteInput = {
    text : Text;
    note_date : Common.Timestamp;
  };

  // ── CustomerNoteV2 (ACTIVE — stored in separate customerNotesStore) ────────────
  // This is the authoritative type for the new notes system.
  //   id           — auto-incremented unique note ID (from customerNoteIdCounter in main.mo)
  //   customer_id  — FK to the Customer record this note belongs to
  //   profile_key  — which business profile owns this note (for data isolation)
  //   note         — the note text content
  //   date         — human-readable date string (e.g. "2025-04-29") set by the user
  //   created_by   — Principal of the user who created the note (audit trail)
  //   creation_date — server timestamp (nanoseconds) when the note was created
  //   last_updated_by  — Principal of the user who last updated the note text
  //   last_updated_date — server timestamp of the last update
  public type CustomerNoteV2 = {
    id : Nat;
    customer_id : Nat;
    profile_key : Text;
    note : Text;
    date : Text;
    created_by : Principal;
    creation_date : Common.Timestamp;
    last_updated_by : Principal;
    last_updated_date : Common.Timestamp;
  };

  // ── CustomerNoteV2Input (ACTIVE — create/update input for separate store) ─────
  // What the frontend sends when creating or updating a note.
  //   customer_id — which customer this note is for
  //   profile_key — must match the caller's active profile (verified on backend)
  //   note        — the text content of the note
  //   date        — date string (e.g. "2025-04-29") entered by the user
  public type CustomerNoteV2Input = {
    customer_id : Nat;
    profile_key : Text;
    note : Text;
    date : Text;
  };

  // ── CustomerNotePublic (ACTIVE — frontend-safe projection of CustomerNoteV2) ──
  // Returned to the frontend from getCustomerNotes / addCustomerNoteV2 etc.
  // Converts Principal fields to Text so they are JSON-serialisable.
  // All other fields are identical to CustomerNoteV2.
  public type CustomerNotePublic = {
    id : Nat;
    customer_id : Nat;
    profile_key : Text;
    note : Text;
    date : Text;
    created_by : Text;              // Principal.toText() — readable in frontend
    creation_date : Common.Timestamp;
    last_updated_by : Text;         // Principal.toText()
    last_updated_date : Common.Timestamp;
  };

  public type Customer = {
    id : Common.CustomerId;
    profile_key : Common.ProfileKey;
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    created_at : Common.Timestamp;
    total_sales : Nat;
    last_purchase_at : Common.Timestamp;
    lifetime_revenue : Float;

    // Discount fields
    discount_applicable : ?Common.DiscountType;
    discount_value : ?Float;             // Percentage (0-100) or fixed amount

    // Structured notes (append-only, multi-note with date)
    notes : [CustomerNote];

    // Personal info
    date_of_birth : ?Text;               // Optional ISO date YYYY-MM-DD
    gender : ?Text;                      // "Male" | "Female" | "Other"
    height : ?Text;                      // e.g. "5'10" or "178 cm"
    age : ?Nat;                          // Computed from date_of_birth; stored as cache

    // Structured address fields (kept alongside legacy `address` for backward compat)
    address_line1 : ?Text;
    address_line2 : ?Text;
    state : ?Text;
    city : ?Text;
    country : ?Text;
    pin_code : ?Text;

    // Created-by override — allows Admin/Staff to assign a specific creator
    customer_created_by : ?Common.UserId;

    // Referral tracking
    referred_by : ?Text;
    referral_commission_amount : ?Float;

    // Customer lifecycle — Lead/Active/Inactive classification
    customer_type : { #lead; #active; #inactive };

    // Lead follow-up scheduling
    lead_follow_up_date : ?Int;
    lead_notes : ?Text;

    // Goal and medical issue links (IDs referencing master data)
    primary_goal_ids : [Nat];
    medical_issue_ids : [Nat];

    // Lifecycle state change datetime
    lead_to_active_datetime : ?Common.Timestamp;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns, no computed aggregates
  public type CustomerInput = {
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    discount_applicable : ?Common.DiscountType;
    discount_value : ?Float;
    note : ?Text;                        // Legacy single-note append (kept for backward compat)
    notes : ?[CustomerNoteInput];        // Optional structured notes to append
    date_of_birth : ?Text;
    gender : ?Text;
    height : ?Text;
    age : ?Nat;
    address_line1 : ?Text;
    address_line2 : ?Text;
    state : ?Text;
    city : ?Text;
    country : ?Text;
    pin_code : ?Text;
    body_composition : ?[BodyCompositionInput];

    customer_created_by : ?Common.UserId;

    // Referral fields (optional)
    referred_by : ?Text;
    referral_commission_amount : ?Float;

    // Customer lifecycle
    customer_type : ?{ #lead; #active; #inactive };
    lead_follow_up_date : ?Int;
    lead_notes : ?Text;

    // Goal and medical issue links
    primary_goal_ids : ?[Nat];
    medical_issue_ids : ?[Nat];

    // Lifecycle state change datetime
    lead_to_active_datetime : ?Common.Timestamp;
  };

  // Public projection
  public type CustomerPublic = {
    id : Common.CustomerId;
    profile_key : Common.ProfileKey;
    name : Text;
    phone : Text;
    email : Text;
    address : Text;
    created_at : Common.Timestamp;
    total_sales : Nat;
    last_purchase_at : Common.Timestamp;
    lifetime_revenue : Float;
    discount_applicable : ?Common.DiscountType;
    discount_value : ?Float;
    notes : [CustomerNote];
    date_of_birth : ?Text;
    gender : ?Text;
    height : ?Text;
    age : ?Nat;
    address_line1 : ?Text;
    address_line2 : ?Text;
    state : ?Text;
    city : ?Text;
    country : ?Text;
    pin_code : ?Text;

    customer_created_by : ?Common.UserId;

    // Referral fields
    referred_by : ?Text;
    referral_commission_amount : ?Float;

    // Customer lifecycle
    customer_type : { #lead; #active; #inactive };
    lead_follow_up_date : ?Int;
    lead_notes : ?Text;

    // Goal and medical issue links
    primary_goal_ids : [Nat];
    medical_issue_ids : [Nat];

    // Lifecycle state change datetime
    lead_to_active_datetime : ?Common.Timestamp;
  };

  // Result for fuzzy duplicate detection
  public type DuplicateCheckResult = {
    has_similar : Bool;
    similar_customers : [CustomerPublic];
  };

  // ── BodyCompositionEntry ──────────────────────────────────────────────────────
  public type BodyCompositionEntry = {
    id : Text;
    customer_id : Text;
    profile_key : Common.ProfileKey;
    date : Text;                         // ISO date YYYY-MM-DD
    weight : ?Float;
    body_fat : ?Float;
    visceral_fat : ?Float;
    bmr : ?Float;
    bmi : ?Float;
    body_age : ?Nat;
    trunk_fat : ?Float;
    muscle_mass : ?Float;                // kg — negative values allowed
    created_by : Text;
    creation_date : Common.Timestamp;
  };

  public type BodyCompositionInput = {
    date : Text;
    weight : ?Float;
    body_fat : ?Float;
    visceral_fat : ?Float;
    bmr : ?Float;
    bmi : ?Float;
    body_age : ?Nat;
    trunk_fat : ?Float;
    muscle_mass : ?Float;
  };

  // ── BodyInchesEntry ───────────────────────────────────────────────────────────
  // Tracks body-measurement inches at a point in time.
  // All measurement fields are optional — only captured fields are stored.
  public type BodyInchesEntry = {
    id : Nat;
    customer_id : Nat;
    profile_key : Common.ProfileKey;
    entry_date : Common.Timestamp;
    chest : ?Float;
    biceps : ?Float;
    waist : ?Float;
    hips : ?Float;
    thighs : ?Float;
    calves : ?Float;
    created_by : Text;
    creation_date : Common.Timestamp;
  };

  public type BodyInchesInput = {
    entry_date : Common.Timestamp;
    chest : ?Float;
    biceps : ?Float;
    waist : ?Float;
    hips : ?Float;
    thighs : ?Float;
    calves : ?Float;
  };

  // BodyInchesPublic mirrors BodyInchesEntry (all fields are already shared types)
  public type BodyInchesPublic = BodyInchesEntry;
};
