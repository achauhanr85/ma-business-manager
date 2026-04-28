/*
 * types/goals.mo — LEGACY Goal and Medical Issue Type Definitions
 *
 * STATUS: *** DEPRECATED — DO NOT USE FOR NEW FEATURES ***
 *
 * WHAT THIS FILE DOES:
 *   Defines the internal and public record shapes for the OLD goals and medical
 *   issues master data system. These types are used only by:
 *     - lib/goals.mo       (LEGACY logic module)
 *     - mixins/goals-api.mo (LEGACY public API)
 *
 * WHY IT IS DEPRECATED:
 *   A newer, cleaner goals/medical system was built in:
 *     - types/goals-medical.mo          (ACTIVE — use this)
 *     - lib/customer-goals-medical.mo   (ACTIVE logic)
 *     - mixins/customer-goals-medical-api.mo (ACTIVE API)
 *   The active system adds timestamps to the public types, uses Principal for
 *   created_by (instead of Text), and uses structured Input types for create/update.
 *
 * WHY WE KEEP THIS FILE:
 *   The legacy types are still referenced by GoalsLib and GoalsApi which are still
 *   included in main.mo for backwards compatibility. Deleting this file would break
 *   compilation. Once the frontend is confirmed to only call the active API functions
 *   (listGoals, createGoal, etc.) and the legacy stores are confirmed empty, both
 *   this file and goals.mo / goals-api.mo can be safely removed.
 *
 * WHO USES IT:
 *   lib/goals.mo, mixins/goals-api.mo
 */

import Common "common";

module {

  // ── GoalMaster (legacy internal record) ──────────────────────────────────
  // Represents a reusable primary goal that can be assigned to customers.
  // (e.g. "Weight Loss", "Muscle Gain")
  // NOTE: created_by and last_updated_by are stored as Text here.
  //       The active system (goals-medical.mo) stores them as Principal — better practice.
  public type GoalMaster = {
    id : Nat;
    profile_key : Common.ProfileKey; // which profile this goal belongs to
    name : Text;                     // display name of the goal
    description : Text;              // optional longer description
    product_bundle : [Common.ProductId]; // product IDs suggested when this goal is set
    // Who-columns (stored as Text in legacy; Principal in active system)
    created_by : Text;
    last_updated_by : Text;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── GoalMasterPublic (legacy API response shape) ──────────────────────────
  // Stripped version returned to the frontend — no who-columns.
  // NOTE: The active GoalMasterPublic (in goals-medical.mo) also includes
  //       creation_date and last_update_date — this one does not.
  public type GoalMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
    product_bundle : [Common.ProductId];
  };

  // ── MedicalIssueMaster (legacy internal record) ───────────────────────────
  // Represents a reusable medical condition that can be assigned to customers.
  // (e.g. "Diabetes", "Hypertension", "Thyroid")
  public type MedicalIssueMaster = {
    id : Nat;
    profile_key : Common.ProfileKey;
    name : Text;
    description : Text;
    // Who-columns (stored as Text in legacy)
    created_by : Text;
    last_updated_by : Text;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // ── MedicalIssueMasterPublic (legacy API response shape) ──────────────────
  // Stripped version returned to the frontend — no who-columns.
  public type MedicalIssueMasterPublic = {
    id : Nat;
    name : Text;
    description : Text;
  };
};
