import Common "common";

module {
  // ── ProfileApprovalStatus ─────────────────────────────────────────────────────
  // Controls whether a new profile is accessible after setup.
  //   #pending_super_admin_approval — default for newly registered profiles;
  //                                   all transactions blocked until Super Admin approves.
  //   #approved                     — profile is active and fully operational.
  //   #suspended                    — Super Admin has explicitly suspended the profile.
  public type ProfileApprovalStatus = {
    #pending_super_admin_approval;
    #approved;
    #suspended;
  };

  // ── Profile (internal, with var fields for mutability) ───────────────────────
  // Governance fields:
  //   is_enabled              — Super Admin can disable a profile; disabled profiles block login.
  //   start_date              — Optional activation window start. Transactions blocked before this.
  //   end_date                — Optional activation window end.
  //   profile_approval_status — New profiles start as #pending_super_admin_approval.
  //                             Super Admin must approve before profile becomes active.
  //
  // Dry-run: Governance Gatekeeper
  //   Before any transaction (sale, PO, stock move), middleware checks:
  //     1. profile_approval_status == #approved       → else 403 PendingApproval
  //     2. profile.is_enabled == true                 → else 403 Disabled
  //     3. start_date == null OR now >= start_date    → else 403 NotYetActive
  //     4. end_date   == null OR now <= end_date      → else 403 Expired
  //   If end_date is yesterday (now > end_date), step 4 returns 403 Expired.
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
    receipt_notes : Text;        // Rich-text notes printed on customer receipts
    instagram_handle : Text;     // Instagram account handle (without @), shown on receipts
    created_at : Common.Timestamp;
    is_archived : Bool;

    // Governance window
    is_enabled : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;

    // Approval status — new profiles require Super Admin approval before becoming active
    profile_approval_status : ProfileApprovalStatus;

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
    receipt_notes : Text;        // Rich-text notes printed on customer receipts
    instagram_handle : Text;     // Instagram account handle (without @)
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
    receipt_notes : Text;        // Rich-text notes printed on customer receipts
    instagram_handle : Text;     // Instagram account handle (without @)
    created_at : Common.Timestamp;
    is_archived : Bool;
    is_enabled : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;
    profile_approval_status : ProfileApprovalStatus;
  };

  /// Returned by getProfileStatus — governance snapshot for a profile
  public type ProfileStatus = {
    is_enabled : Bool;
    is_within_window : Bool;
    start_date : ?Common.Timestamp;
    end_date : ?Common.Timestamp;
    profile_approval_status : ProfileApprovalStatus;
  };

  /// Result type for checkProfileAccess — used before any transaction
  public type ProfileAccessError = {
    #ProfileDisabled;
    #OutsideActiveWindow;
    #PendingSuperAdminApproval;
    #ProfileSuspended;
  };
};
