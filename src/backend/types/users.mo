/*
 * FILE: types/users.mo
 * MODULE: type
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Defines the data shapes for user records in the system:
 *     - UserProfile: full internal record for a user (includes who-columns)
 *     - UserProfileInput: what the frontend sends when updating a user
 *     - UserProfilePublic: what gets returned to the frontend (no who-columns)
 *     - UserPreferences: fast pre-render query result for language/theme/format/diagnostics settings
 *     - ApprovalStatus: typed variant for pending/approved/rejected states
 *
 * FLOW:
 *   On every authenticated call: mixin reads userStore.get(caller) → UserProfile
 *   On login: getUserPreferences() → UserPreferences (pre-render, no flash-to-English)
 *   On preference save: updateUserPreferences() → persists language/theme/diagnosticsLevel
 *
 * DEPENDENCIES:
 *   imports: types/common.mo
 *   called by: lib/profile.mo, mixins/profile-api.mo, lib/sales.mo, lib/customers.mo,
 *              lib/catalog.mo, lib/inventory.mo, lib/purchases.mo, lib/vendors.mo,
 *              lib/customer-goals-medical.mo, lib/customer-notes.mo
 *   calls: types/common.mo (UserId, ProfileKey, etc.)
 *
 * KEY TYPES:
 *   UserProfile       — full internal record per user principal (stored in userStore)
 *   UserProfilePublic — public projection (no who-columns, returned to frontend)
 *   UserProfileInput  — input accepted from frontend for updates
 *   UserPreferences   — fast pre-render query (language, theme, dateFormat, diagnosticsLevel)
 *
 * IMPORTANT — Language Loading:
 *   getUserPreferences() (in lib/profile.mo) returns the stored language BEFORE
 *   the app renders anything. The frontend must call this on login to avoid
 *   the "flash to English" bug where the default "en" shows briefly before the
 *   saved preference loads.
 *
 * IMPORTANT — Approval:
 *   New Staff and Referral Users start with approval_status = "pending".
 *   They are blocked from accessing the app until Admin approves them.
 *   The blocking is done in lib/profile.mo getRoutingStatus() → returns #pending_approval.
 *
 * IMPORTANT — Diagnostics Level:
 *   diagnosticsLevel is a Nat (0-4) controlling the log verbosity in the frontend:
 *     0 = TRACE (most verbose), 1 = DEBUG, 2 = INFO (default), 3 = WARN, 4 = ERROR
 *   Only stored and returned when diagnostics is enabled in preferences.
 * ─────────────────────────────────────────────────────────────────────
 */

import Common "common";

module {
  // ── ApprovalStatus ────────────────────────────────────────────────────────────
  // Typed variant for user approval state.
  //   #pending  — new staff/referral user awaiting Admin approval
  //   #approved — access granted by Admin
  //   #rejected — access denied by Admin
  public type ApprovalStatus = { #pending; #approved; #rejected };

  // ── UserProfile ───────────────────────────────────────────────────────────────
  public type UserProfile = {
    principal : Common.UserId;
    profile_key : Common.ProfileKey;
    role : Common.UserRole;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
    email : ?Text;                           // Email address associated with Internet Identity
    joined_at : Common.Timestamp;

    // Approval workflow — new Staff and Referral Users start as #pending.
    // An Admin must approve them before they can access the app.
    approval_status : ?Text;

    // Module-level access permissions (comma-separated or JSON-encoded)
    // e.g. "po,customer,product,sales" — Admin can toggle per user
    module_access : ?Text;

    // User preferences — persisted per user, applied on login
    language_preference : Text;              // BCP-47 language code, default "en"
    date_format : Text;                      // e.g. "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"
    default_receipt_language : Text;         // BCP-47 language code for generated receipts, default "en"
    theme : Text;                            // UI theme name: "dark" | "minimalist" | "herbal" | "punk", default "dark"
    // Diagnostics level: 0=TRACE, 1=DEBUG, 2=INFO (default), 3=WARN, 4=ERROR
    // Only used when diagnostics is enabled in preferences. Valid range: 0-4.
    diagnostics_level : Nat;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns
  public type UserProfileInput = {
    profile_key : Common.ProfileKey;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
    email : ?Text;                       // Optional email address
    approval_status : ?Text;             // "pending" | "approved" | "rejected"
    module_access : ?Text;               // comma-separated module permissions

    // User preferences (optional — backend defaults to "en" / "DD/MM/YYYY" if null)
    language_preference : ?Text;
    date_format : ?Text;
    default_receipt_language : ?Text;
    theme : ?Text;                       // UI theme: "dark" | "minimalist" | "herbal" | "punk"
    // Diagnostics level 0-4 (0=TRACE,1=DEBUG,2=INFO,3=WARN,4=ERROR). null = use default (2)
    diagnostics_level : ?Nat;
  };

  // Public projection
  public type UserProfilePublic = {
    principal : Common.UserId;
    profile_key : Common.ProfileKey;
    role : Common.UserRole;
    warehouse_name : Common.WarehouseName;
    display_name : Text;
    email : ?Text;                       // Email address associated with Internet Identity
    joined_at : Common.Timestamp;
    approval_status : ?Text;
    module_access : ?Text;

    // User preferences
    language_preference : Text;
    date_format : Text;
    default_receipt_language : Text;
    theme : Text;                        // UI theme name
    // Diagnostics level 0-4 (0=TRACE,1=DEBUG,2=INFO,3=WARN,4=ERROR). Default=2 (INFO).
    diagnostics_level : Nat;
  };

  // ── UserPreferences ───────────────────────────────────────────────────────────
  // Returned by getUserPreferences() — a fast, pre-render query so the frontend
  // never falls back to "en" after a user has explicitly saved a different language.
  // Also returns diagnosticsLevel so the frontend diagnostics panel can apply the
  // user's saved log verbosity level immediately on load.
  public type UserPreferences = {
    language : Text;               // BCP-47 language code, e.g. "en", "hi", "gu"
    dateFormat : Text;             // e.g. "DD/MM/YYYY"
    defaultReceiptLanguage : Text; // BCP-47 language code for generated receipts
    whatsappNumber : Text;         // WhatsApp number mapped to this user
    theme : Text;                  // UI theme: "dark" | "minimalist" | "herbal" | "punk"
    // Diagnostics level: 0=TRACE, 1=DEBUG, 2=INFO (default), 3=WARN, 4=ERROR
    // The frontend diagnostics panel respects this value to filter log output.
    diagnosticsLevel : Nat;
  };
};
