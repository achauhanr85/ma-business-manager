import Common "common";

module {
  // ── Lead ─────────────────────────────────────────────────────────────────────
  // Represents a demo/inquiry lead submitted from the public Index/marketing page.
  // No auth required for creation. Super Admin only for reads and management.
  //
  // is_closed: true once Super Admin has actioned the lead (called, provided link etc.)
  // profile_link: optional onboarding link provided by Super Admin to the lead
  public type Lead = {
    id : Nat;
    name : Text;
    business_name : Text;
    phone : Text;
    email : Text;
    message : Text;
    created_at : Common.Timestamp;
    is_closed : Bool;
    profile_link : ?Text;
  };

  public type LeadInput = {
    name : Text;
    business_name : Text;
    phone : Text;
    email : Text;
    message : Text;
  };
};
