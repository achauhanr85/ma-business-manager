/*
 * types/core-bug-fixes-profile-sales-notifications.mo — ARCHIVED TYPE DEFINITIONS
 *
 * STATUS: *** ARCHIVED — No longer used in active code paths ***
 *
 * WHAT THIS FILE DID:
 *   Defined an alternative set of Goal, MedicalIssue, and CyclesInfo types that
 *   were introduced during a targeted bug-fix build. These types added an
 *   `is_active: Bool` flag and `product_bundle_ids` (plural) that differed from
 *   both the legacy (types/goals.mo) and active (types/goals-medical.mo) types.
 *
 * WHY IT IS ARCHIVED:
 *   lib/core-bug-fixes-profile-sales-notifications.mo imports this file but its
 *   functions are stub/reference implementations that are NOT wired into main.mo
 *   as a mixin. The active goals/medical system uses types/goals-medical.mo.
 *   The CyclesInfo type here uses a different shape (per_profile_cycles as tuple
 *   array) than the active CyclesInfo in goals-medical.mo.
 *
 * WHY WE KEEP THIS FILE:
 *   lib/core-bug-fixes-profile-sales-notifications.mo still imports it. If we
 *   delete this file, the project will fail to compile. Once that lib file is
 *   also confirmed unused and removed, this file can be deleted too.
 *
 * DO NOT add new types here. Use types/goals-medical.mo for goals/medical types.
 */

import Common "common";

module {

  // ── GoalMaster (archived — has is_active flag not present in active system) ──
  // A primary goal a customer wants to achieve.
  // NOTE: product_bundle_ids here (plural, different from product_bundle in active).
  public type GoalMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    product_bundle_ids : [Common.ProductId]; // NOTE: differs from active system's product_bundle
    is_active : Bool;                        // NOTE: not present in active GoalMaster type
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input type for creating/updating a goal in the archived system
  public type GoalMasterInput = {
    name : Text;
    description : Text;
    is_active : Bool; // not in active system
  };

  // Public projection — includes is_active and product_bundle_ids (different from active)
  public type GoalMasterPublic = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    product_bundle_ids : [Common.ProductId];
    is_active : Bool;
  };

  // ── MedicalIssueMaster (archived — has is_active flag) ────────────────────
  public type MedicalIssueMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    is_active : Bool;
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

  // ── CyclesInfo (archived — different shape from active CyclesInfo) ─────────
  // NOTE: active system uses profiles_cycles : [ProfileCyclesEntry]
  //       This archived version uses per_profile_cycles : [(ProfileKey, Nat)] — a tuple array
  // NOTE: CustomerNote, CustomerNoteInput, BodyInchesEntry, BodyInchesInput, and
  //       BodyInchesPublic are defined in types/customers.mo — use those directly.
  public type CyclesInfo = {
    total_cycles : Nat;
    per_profile_cycles : [(Common.ProfileKey, Nat)]; // tuple format, always 0 (single canister)
  };
};
