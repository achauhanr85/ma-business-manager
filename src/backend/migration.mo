import Map "mo:core/Map";
import List "mo:core/List";
import Array "mo:core/Array";

import CatalogTypes "types/catalog";
import InventoryTypes "types/inventory";
import SalesTypes "types/sales";
import PurchaseTypes "types/purchases";
import ProfileTypes "types/profile";
import UserTypes "types/users";
import Common "types/common";

module {
  // ── Old inline types (from .old/src/backend) ──────────────────────────────

  type OldUserId = Principal;
  type OldCategoryId = Nat;
  type OldProductId = Nat;
  type OldBatchId = Nat;
  type OldSaleId = Nat;
  type OldPurchaseOrderId = Nat;
  type OldTimestamp = Int;

  type OldProfile = {
    business_name : Text;
    phone_number : Text;
    business_address : Text;
    fssai_number : Text;
    email : Text;
    owner : OldUserId;
  };

  type OldCategory = {
    id : OldCategoryId;
    name : Text;
    description : Text;
    owner : OldUserId;
  };

  type OldProduct = {
    id : OldProductId;
    sku : Text;
    name : Text;
    category_id : OldCategoryId;
    volume_points : Float;
    earn_base : Float;
    mrp : Float;
    hsn_code : Text;
    owner : OldUserId;
  };

  type OldInventoryBatch = {
    id : OldBatchId;
    product_id : OldProductId;
    var quantity_remaining : Nat;
    unit_cost : Float;
    date_received : OldTimestamp;
    owner : OldUserId;
  };

  type OldSale = {
    id : OldSaleId;
    timestamp : OldTimestamp;
    total_revenue : Float;
    total_volume_points : Float;
    total_profit : Float;
    owner : OldUserId;
  };

  type OldSaleItem = {
    sale_id : OldSaleId;
    product_id : OldProductId;
    product_name_snapshot : Text;
    unit_cost_snapshot : Float;
    mrp_snapshot : Float;
    volume_points_snapshot : Float;
    quantity : Nat;
    actual_sale_price : Float;
  };

  type OldPOStatus = { #Pending; #Received };

  type OldPurchaseOrder = {
    id : OldPurchaseOrderId;
    vendor : Text;
    timestamp : OldTimestamp;
    status : OldPOStatus;
    owner : OldUserId;
  };

  type OldPurchaseOrderItem = {
    po_id : OldPurchaseOrderId;
    product_id : OldProductId;
    quantity : Nat;
    unit_cost : Float;
  };

  // ── OldActor / NewActor ───────────────────────────────────────────────────

  type OldActor = {
    profileStore : Map.Map<OldUserId, OldProfile>;
    categoryStore : Map.Map<OldCategoryId, OldCategory>;
    productStore : Map.Map<OldProductId, OldProduct>;
    batchStore : Map.Map<OldBatchId, OldInventoryBatch>;
    saleStore : Map.Map<OldSaleId, OldSale>;
    saleItemStore : List.List<OldSaleItem>;
    poStore : Map.Map<OldPurchaseOrderId, OldPurchaseOrder>;
    poItemStore : List.List<OldPurchaseOrderItem>;
  };

  type NewActor = {
    profileStore : Map.Map<Common.ProfileKey, ProfileTypes.Profile>;
    userStore : Map.Map<Common.UserId, UserTypes.UserProfile>;
    categoryStore : Map.Map<Common.CategoryId, CatalogTypes.Category>;
    productStore : Map.Map<Common.ProductId, CatalogTypes.Product>;
    batchStore : Map.Map<Common.BatchId, InventoryTypes.InventoryBatch>;
    movementStore : Map.Map<Common.MovementId, InventoryTypes.InventoryMovement>;
    saleStore : Map.Map<Common.SaleId, SalesTypes.Sale>;
    saleItemStore : Map.Map<Common.SaleId, [SalesTypes.SaleItem]>;
    poStore : Map.Map<Common.PurchaseOrderId, PurchaseTypes.PurchaseOrder>;
    poItemStore : Map.Map<Common.PurchaseOrderId, [PurchaseTypes.PurchaseOrderItem]>;
  };

  // Default profile key used when migrating single-tenant data to multi-tenant
  let DEFAULT_PROFILE_KEY : Text = "default";
  let DEFAULT_WAREHOUSE : Text = "Main";

  public func run(old : OldActor) : NewActor {
    // Migrate profileStore: key changes from UserId (Principal) to ProfileKey (Text)
    // Each old profile gets its owner's principal.toText() as the profile key
    let profileStore = Map.empty<Common.ProfileKey, ProfileTypes.Profile>();
    for ((userId, oldProfile) in old.profileStore.entries()) {
      let profile : ProfileTypes.Profile = {
        profile_key = DEFAULT_PROFILE_KEY;
        business_name = oldProfile.business_name;
        phone_number = oldProfile.phone_number;
        business_address = oldProfile.business_address;
        fssai_number = oldProfile.fssai_number;
        email = oldProfile.email;
        owner = oldProfile.owner;
        logo_url = "";
        theme_color = "#16a34a";
        created_at = 0;
        is_archived = false;
      };
      profileStore.add(DEFAULT_PROFILE_KEY, profile);
    };

    // Migrate userStore: new field, build from profileStore owners
    let userStore = Map.empty<Common.UserId, UserTypes.UserProfile>();
    for ((_profileKey, oldProfile) in old.profileStore.entries()) {
      let userProfile : UserTypes.UserProfile = {
        principal = oldProfile.owner;
        profile_key = DEFAULT_PROFILE_KEY;
        role = #admin;
        warehouse_name = DEFAULT_WAREHOUSE;
        display_name = oldProfile.business_name;
        joined_at = 0;
      };
      userStore.add(oldProfile.owner, userProfile);
    };

    // Migrate categoryStore: add profile_key field
    let categoryStore = old.categoryStore.map<OldCategoryId, OldCategory, CatalogTypes.Category>(
      func(_id, oldCat) {
        {
          oldCat with
          profile_key = DEFAULT_PROFILE_KEY;
        }
      }
    );

    // Migrate productStore: add profile_key field
    let productStore = old.productStore.map<OldProductId, OldProduct, CatalogTypes.Product>(
      func(_id, oldProd) {
        {
          oldProd with
          profile_key = DEFAULT_PROFILE_KEY;
        }
      }
    );

    // Migrate batchStore: add profile_key + warehouse_name fields
    let batchStore = old.batchStore.map<OldBatchId, OldInventoryBatch, InventoryTypes.InventoryBatch>(
      func(_id, oldBatch) {
        {
          id = oldBatch.id;
          product_id = oldBatch.product_id;
          var quantity_remaining = oldBatch.quantity_remaining;
          unit_cost = oldBatch.unit_cost;
          date_received = oldBatch.date_received;
          owner = oldBatch.owner;
          profile_key = DEFAULT_PROFILE_KEY;
          warehouse_name = DEFAULT_WAREHOUSE;
        }
      }
    );

    // movementStore: new field, starts empty
    let movementStore = Map.empty<Common.MovementId, InventoryTypes.InventoryMovement>();

    // Migrate saleStore: add profile_key, customer_id, customer_name, sold_by; rename owner
    let saleStore = old.saleStore.map<OldSaleId, OldSale, SalesTypes.Sale>(
      func(_id, oldSale) {
        {
          oldSale with
          profile_key = DEFAULT_PROFILE_KEY;
          customer_id = 0;
          customer_name = "";
          sold_by = oldSale.owner;
        }
      }
    );

    // Migrate saleItemStore: List → Map<SaleId, [SaleItem]>
    // Group sale items by sale_id
    let saleItemStore = Map.empty<Common.SaleId, [SalesTypes.SaleItem]>();
    for (oldItem in old.saleItemStore.values()) {
      let existing : [SalesTypes.SaleItem] = switch (saleItemStore.get(oldItem.sale_id)) {
        case (?items) items;
        case null [];
      };
      saleItemStore.add(oldItem.sale_id, existing.concat([oldItem]));
    };

    // Migrate poStore: add profile_key + warehouse_name
    let poStore = old.poStore.map<OldPurchaseOrderId, OldPurchaseOrder, PurchaseTypes.PurchaseOrder>(
      func(_id, oldPO) {
        {
          oldPO with
          profile_key = DEFAULT_PROFILE_KEY;
          warehouse_name = DEFAULT_WAREHOUSE;
        }
      }
    );

    // Migrate poItemStore: List → Map<PurchaseOrderId, [PurchaseOrderItem]>
    let poItemStore = Map.empty<Common.PurchaseOrderId, [PurchaseTypes.PurchaseOrderItem]>();
    for (oldItem in old.poItemStore.values()) {
      let existing : [PurchaseTypes.PurchaseOrderItem] = switch (poItemStore.get(oldItem.po_id)) {
        case (?items) items;
        case null [];
      };
      poItemStore.add(oldItem.po_id, existing.concat([oldItem]));
    };

    {
      profileStore;
      userStore;
      categoryStore;
      productStore;
      batchStore;
      movementStore;
      saleStore;
      saleItemStore;
      poStore;
      poItemStore;
    };
  };
};
