import Common "common";

module {
  // ── GoalMaster ────────────────────────────────────────────────────────────────
  // A primary goal a customer wants to achieve (e.g. Weight Loss, Muscle Gain).
  // Admins can define new goals; goals can have associated product bundles.
  public type GoalMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    product_bundle_ids : [Common.ProductId]; // products associated with this goal
    is_active : Bool;
    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  public type GoalMasterInput = {
    name : Text;
    description : Text;
    is_active : Bool;
  };

  public type GoalMasterPublic = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    product_bundle_ids : [Common.ProductId];
    is_active : Bool;
  };

  // ── MedicalIssueMaster ────────────────────────────────────────────────────────
  // A medical condition a customer may have (e.g. Diabetes, Hypertension).
  // Admins can define new medical issues; customers can have multiple.
  public type MedicalIssueMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    is_active : Bool;
    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  public type MedicalIssueMasterInput = {
    name : Text;
    description : Text;
    is_active : Bool;
  };

  public type MedicalIssueMasterPublic = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    is_active : Bool;
  };

  // ── CyclesInfo ────────────────────────────────────────────────────────────────
  // Canister cycle balance information returned to Super Admin.
  // Since all profiles share a single canister, per-profile cycles are always 0.
  public type CyclesInfo = {
    total_cycles : Nat;
    per_profile_cycles : [(Common.ProfileKey, Nat)]; // always 0 per profile (single canister)
  };

  // NOTE: CustomerNote, CustomerNoteInput, BodyInchesEntry, BodyInchesInput, and
  // BodyInchesPublic are already defined in types/customers.mo — use those directly.
};
