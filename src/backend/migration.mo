/*
 * FILE: migration.mo
 * MODULE: migration
 * ─────────────────────────────────────────────────────────────────────
 * PURPOSE:
 *   Migrates canister state from the previous version to the current version.
 *   This migration adds the `diagnostics_level` field (Nat, default 2 = INFO)
 *   to every existing UserProfile record in userStore.
 *
 * CHANGE:
 *   UserProfile gained a new required field: diagnostics_level : Nat
 *   All existing records default to 2 (INFO level).
 *   Valid values: 0=TRACE, 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR
 *
 * HOW IT WORKS:
 *   1. OldActor mirrors the previous state shape (userStore with old UserProfile type)
 *   2. NewActor mirrors the new state shape (userStore with new UserProfile type)
 *   3. run(old) maps every OldUserProfile → NewUserProfile by adding diagnostics_level=2
 *   4. All other stores are passed through unchanged (not declared in migration input/output,
 *      so they are inherited from the old actor as-is)
 *
 * DEPLOYMENT:
 *   This file is referenced from main.mo via (with migration = Migration.run)
 *   The migration runs exactly once at upgrade time; fresh installs skip it.
 * ─────────────────────────────────────────────────────────────────────
 */

import Map "mo:core/Map";
import UserTypes "types/users";

module {

  // ── Old types (copied from .old/src/backend/types/users.mo) ──────────────────
  // These mirror the previous version's UserProfile exactly.
  // They are defined inline here (NOT imported from .old/) because the compilation
  // environment does not resolve relative paths into the .old/ backup directory.

  type OldUserId = Principal;
  type OldProfileKey = Text;
  type OldUserRole = { #superAdmin; #admin; #staff; #referralUser; #regularUser };
  type OldWarehouseName = Text;
  type OldTimestamp = Int;

  type OldUserProfile = {
    principal : OldUserId;
    profile_key : OldProfileKey;
    role : OldUserRole;
    warehouse_name : OldWarehouseName;
    display_name : Text;
    email : ?Text;
    joined_at : OldTimestamp;
    approval_status : ?Text;
    module_access : ?Text;
    language_preference : Text;
    date_format : Text;
    default_receipt_language : Text;
    theme : Text;
    created_by : OldUserId;
    last_updated_by : OldUserId;
    creation_date : OldTimestamp;
    last_update_date : OldTimestamp;
  };

  // ── State shapes ──────────────────────────────────────────────────────────────

  // OldActor: only the fields we need to transform (userStore).
  // All other stores are inherited automatically by the runtime.
  type OldActor = {
    userStore : Map.Map<OldUserId, OldUserProfile>;
  };

  // NewActor: the post-migration state shape for the fields we transform.
  type NewActor = {
    userStore : Map.Map<OldUserId, UserTypes.UserProfile>;
  };

  // ── Migration function ────────────────────────────────────────────────────────

  /// Transforms the old userStore by adding diagnostics_level = 2 (INFO) to every record.
  /// All other fields are preserved exactly as stored.
  public func run(old : OldActor) : NewActor {
    // Map each OldUserProfile to the new UserProfile by adding diagnostics_level = 2
    let userStore = old.userStore.map<OldUserId, OldUserProfile, UserTypes.UserProfile>(
      func(_principal, oldUp) {
        {
          principal = oldUp.principal;
          profile_key = oldUp.profile_key;
          role = oldUp.role;
          warehouse_name = oldUp.warehouse_name;
          display_name = oldUp.display_name;
          email = oldUp.email;
          joined_at = oldUp.joined_at;
          approval_status = oldUp.approval_status;
          module_access = oldUp.module_access;
          language_preference = oldUp.language_preference;
          date_format = oldUp.date_format;
          default_receipt_language = oldUp.default_receipt_language;
          theme = oldUp.theme;
          // NEW FIELD: default to 2 (INFO) for all existing users
          diagnostics_level = 2;
          created_by = oldUp.created_by;
          last_updated_by = oldUp.last_updated_by;
          creation_date = oldUp.creation_date;
          last_update_date = oldUp.last_update_date;
        }
      }
    );
    { userStore }
  };

};
