/// Migration: upgrade from previous version
///
/// Changes handled:
/// 1. userStore   — UserRole `#subAdmin` renamed to `#staff`
/// 2. customerStore — Customer gains two optional fields: `date_of_birth` and `gender`
///
/// The bodyCompositionStore is new (not in old actor) — it will be auto-initialized
/// as an empty Map by the actor's own field declaration.
import Map "mo:core/Map";
import CustomerId "mo:core/Nat";
import Principal "mo:core/Principal";

module {
  // ── Old types (inlined from .old/src/backend/types/) ────────────────────────

  type OldUserId    = Principal;
  type OldTimestamp = Int;
  type OldProfileKey = Text;
  type OldWarehouseName = Text;
  type OldCustomerId = Nat;

  type OldUserRole = { #superAdmin; #admin; #subAdmin };

  type OldUserProfile = {
    principal       : OldUserId;
    profile_key     : OldProfileKey;
    role            : OldUserRole;
    warehouse_name  : OldWarehouseName;
    display_name    : Text;
    joined_at       : OldTimestamp;
    created_by      : OldUserId;
    last_updated_by : OldUserId;
    creation_date   : OldTimestamp;
    last_update_date : OldTimestamp;
  };

  type OldDiscountType = { #Percentage; #Fixed };

  type OldCustomer = {
    id               : OldCustomerId;
    profile_key      : OldProfileKey;
    name             : Text;
    phone            : Text;
    email            : Text;
    address          : Text;
    created_at       : OldTimestamp;
    total_sales      : Nat;
    last_purchase_at : OldTimestamp;
    lifetime_revenue : Float;
    discount_applicable : ?OldDiscountType;
    discount_value   : ?Float;
    notes            : [Text];
    created_by       : OldUserId;
    last_updated_by  : OldUserId;
    creation_date    : OldTimestamp;
    last_update_date : OldTimestamp;
  };

  // ── New types (from current types/) ─────────────────────────────────────────

  type NewUserRole = { #superAdmin; #admin; #staff };

  type NewUserProfile = {
    principal       : OldUserId;
    profile_key     : OldProfileKey;
    role            : NewUserRole;
    warehouse_name  : OldWarehouseName;
    display_name    : Text;
    joined_at       : OldTimestamp;
    created_by      : OldUserId;
    last_updated_by : OldUserId;
    creation_date   : OldTimestamp;
    last_update_date : OldTimestamp;
  };

  type NewDiscountType = { #Percentage; #Fixed };

  type NewCustomer = {
    id               : OldCustomerId;
    profile_key      : OldProfileKey;
    name             : Text;
    phone            : Text;
    email            : Text;
    address          : Text;
    created_at       : OldTimestamp;
    total_sales      : Nat;
    last_purchase_at : OldTimestamp;
    lifetime_revenue : Float;
    discount_applicable : ?NewDiscountType;
    discount_value   : ?Float;
    notes            : [Text];
    date_of_birth    : ?Text;
    gender           : ?Text;
    created_by       : OldUserId;
    last_updated_by  : OldUserId;
    creation_date    : OldTimestamp;
    last_update_date : OldTimestamp;
  };

  // ── Migration input/output ────────────────────────────────────────────────────

  type OldActor = {
    userStore     : Map.Map<OldUserId, OldUserProfile>;
    customerStore : Map.Map<OldCustomerId, OldCustomer>;
  };

  type NewActor = {
    userStore     : Map.Map<OldUserId, NewUserProfile>;
    customerStore : Map.Map<OldCustomerId, NewCustomer>;
  };

  // ── Run ───────────────────────────────────────────────────────────────────────

  public func run(old : OldActor) : NewActor {
    // 1. Migrate userStore — remap #subAdmin → #staff
    let userStore = old.userStore.map<OldUserId, OldUserProfile, NewUserProfile>(
      func(_uid, up) {
        let newRole : NewUserRole = switch (up.role) {
          case (#superAdmin) #superAdmin;
          case (#admin)      #admin;
          case (#subAdmin)   #staff;
        };
        { up with role = newRole }
      }
    );

    // 2. Migrate customerStore — add date_of_birth and gender as null
    let customerStore = old.customerStore.map<OldCustomerId, OldCustomer, NewCustomer>(
      func(_id, c) {
        {
          c with
          date_of_birth = null : ?Text;
          gender = null : ?Text;
        }
      }
    );

    { userStore; customerStore }
  };
};
