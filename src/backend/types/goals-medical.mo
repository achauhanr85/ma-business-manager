import Common "common";

module {
  // ── GoalMaster ────────────────────────────────────────────────────────────────
  // Primary goals master data — shared across the profile.
  // product_bundle holds product IDs associated with this goal.
  public type GoalMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId];
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  public type GoalMasterInput = {
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId];
  };

  public type GoalMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId];
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── MedicalIssueMaster ────────────────────────────────────────────────────────
  // Medical issues master data — shared across the profile.
  public type MedicalIssueMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  public type MedicalIssueMasterInput = {
    name : Text;
    description : Text;
  };

  public type MedicalIssueMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── CyclesInfo ────────────────────────────────────────────────────────────────
  // Canister cycle balance info — exposed to Super Admin only.
  public type ProfileCyclesEntry = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    estimated_cycles : Nat;
  };

  public type CyclesInfo = {
    total_cycles : Nat;
    profiles_cycles : [ProfileCyclesEntry];
  };
};
