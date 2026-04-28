/*
 * types/goals-medical.mo — ACTIVE Goal, Medical Issue and Cycles Type Definitions
 *
 * STATUS: Active — all new goal/medical/cycles features use these types.
 *
 * WHAT THIS FILE DOES:
 *   Defines the data shapes for the current (active) goals and medical issues
 *   master data system, as well as the canister cycles info type returned to
 *   Super Admin.
 *
 * WHO USES IT:
 *   - lib/customer-goals-medical.mo   (logic module)
 *   - mixins/customer-goals-medical-api.mo (public API)
 *
 * DIFFERENCE FROM THE LEGACY types/goals.mo:
 *   - GoalMasterPublic and MedicalIssueMasterPublic now include creation/update timestamps
 *   - created_by / last_updated_by are stored as Principal (not Text)
 *   - Separate GoalMasterInput and MedicalIssueMasterInput types for create/update calls
 *   - CyclesInfo type lives here (not in the legacy goals types)
 */

import Common "common";

module {

  // ── GoalMaster (active internal record) ──────────────────────────────────
  // Represents a profile-level goal definition that Admin creates.
  // Customers can have multiple goals assigned by selecting from this master list.
  // product_bundle: product IDs that will pre-fill the sales cart when this goal is selected.
  public type GoalMaster = {
    id : Nat;
    profile_key : Common.ProfileKey; // which profile this goal belongs to
    name : Text;                     // e.g. "Weight Loss", "Muscle Gain"
    description : Text;              // optional longer description
    product_bundle : [Common.ProductId]; // suggested products for this goal
    // Who-columns — stored as Principal (modern approach)
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── GoalMasterInput ───────────────────────────────────────────────────────
  // Shape of the data sent from the frontend when creating or updating a goal.
  // No id, profile_key, or who-columns — those are assigned by the backend.
  public type GoalMasterInput = {
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId]; // can be empty array if no bundle yet
  };

  // ── GoalMasterPublic (active API response shape) ──────────────────────────
  // Returned to the frontend — includes timestamps so the UI can show
  // "Created on" and "Last updated" in the goal list.
  public type GoalMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId];
    creation_date : Common.Timestamp;    // when this goal was first created
    last_update_date : Common.Timestamp; // when it was most recently changed
  };

  // ── MedicalIssueMaster (active internal record) ───────────────────────────
  // Represents a profile-level medical issue definition that Admin creates.
  // Customers can have multiple medical issues assigned by selecting from this list.
  public type MedicalIssueMaster = {
    id : Nat;
    profile_key : Common.ProfileKey; // which profile this issue belongs to
    name : Text;                     // e.g. "Diabetes", "Hypertension"
    description : Text;              // optional description or notes
    // Who-columns — stored as Principal
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── MedicalIssueMasterInput ────────────────────────────────────────────────
  // Shape of the data sent from the frontend when creating or updating a medical issue.
  public type MedicalIssueMasterInput = {
    name : Text;
    description : Text;
  };

  // ── MedicalIssueMasterPublic (active API response shape) ──────────────────
  // Returned to the frontend — includes timestamps.
  public type MedicalIssueMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── CyclesInfo ────────────────────────────────────────────────────────────
  // Returned by getCyclesInfo() to the Super Admin dashboard.
  // Shows total canister cycles (compute budget) and a fair-share estimate
  // per active profile.
  //
  //   total_cycles:     current canister cycle balance (from Cycles.balance())
  //   profiles_cycles:  estimated per-profile usage — calculated as total/numProfiles
  //                     (all profiles share one canister so this is an approximation)
  public type ProfileCyclesEntry = {
    profile_key : Common.ProfileKey;
    business_name : Text;
    estimated_cycles : Nat; // estimated fair-share cycles for this profile
  };

  public type CyclesInfo = {
    total_cycles : Nat;
    profiles_cycles : [ProfileCyclesEntry]; // one entry per active profile
  };
};
