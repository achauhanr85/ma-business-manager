import Common "common";

module {
  // ── GoalMaster ────────────────────────────────────────────────────────────────
  // Defines a reusable primary goal for customers within a business profile.
  // product_bundle contains ProductIds that are suggested when this goal is set.
  public type GoalMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId];
    created_by : Text;
    last_updated_by : Text;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  public type GoalMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId];
  };

  // ── MedicalIssueMaster ────────────────────────────────────────────────────────
  // Defines a reusable medical issue / condition for customers within a profile.
  public type MedicalIssueMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    created_by : Text;
    last_updated_by : Text;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  public type MedicalIssueMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
  };
};
