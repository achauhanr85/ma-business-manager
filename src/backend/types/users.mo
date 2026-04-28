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
  };

  // ── UserPreferences ───────────────────────────────────────────────────────────
  // Returned by getUserPreferences() — a fast, pre-render query so the frontend
  // never falls back to "en" after a user has explicitly saved a different language.
  public type UserPreferences = {
    language : Text;               // BCP-47 language code, e.g. "en", "hi", "gu"
    dateFormat : Text;             // e.g. "DD/MM/YYYY"
    defaultReceiptLanguage : Text; // BCP-47 language code for generated receipts
    whatsappNumber : Text;         // WhatsApp number mapped to this user
    theme : Text;                  // UI theme: "dark" | "minimalist" | "herbal" | "punk"
  };
};
