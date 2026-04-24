import Common "common";

module {
  // ── Profile (internal, with var fields for mutability) ───────────────────────
  // Governance fields:
  //   is_enabled  — Super Admin can disable a profile; disabled profiles block login.
  //   start_date  — Optional activation window start. Transactions blocked before this.
  //   end_date    — Optional activation window end.
  //
  // Dry-run: Governance Gatekeeper
  //   Before any transaction (sale, PO, stock move), middleware checks:
  //     1. profile.is_enabled == true            → else 403 Disabled
  //     2. start_date == null OR now >= start_date → else 403 NotYetActive
  //     3. end_date   == null OR now <= end_date   → else 403 Expired
  //   If end_date is yesterday (now > end_date), step 3 returns 403 Expired.
  //   Owner is shown a "Contact Super Admin to reactivate" message on login.
  public type Profile = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;         // Must be exactly 14 digits
    email : Text;
    owner : Common.UserId;
    logo_url : Text;
    theme_color : Text;
    created_at : Common.Timestamp;
    is_archived : Bool;

    // Governance window
    is_enabled : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;

    // Who-columns (server-side, auto-populated)
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input accepted from clients — no who-columns, no governance fields
  // (Super Admin uses enableProfile / setProfileWindow for governance changes)
  public type ProfileInput = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
    logo_url : Text;
    theme_color : Text;
  };

  // Public projection — never exposes internal who-columns to untrusted callers
  public type ProfilePublic = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
    owner : Common.UserId;
    logo_url : Text;
    theme_color : Text;
    created_at : Common.Timestamp;
    is_archived : Bool;
    is_enabled : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;
  };

  /// Returned by getProfileStatus — governance snapshot for a profile
  public type ProfileStatus = {
    is_enabled : Bool;
    is_within_window : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;
  };

  /// Result type for checkProfileAccess — used before any transaction
  public type ProfileAccessError = { #ProfileDisabled; #OutsideActiveWindow };
};
