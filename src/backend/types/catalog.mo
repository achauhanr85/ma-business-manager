import Common "common";

module {
  // ── Category ──────────────────────────────────────────────────────────────────
  public type Category = {
    id : Common.CategoryId;
    name : Text;
    description : Text;
    profile_key : Common.ProfileKey;
    owner : Common.UserId;

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns
  public type CategoryInput = {
    name : Text;
    description : Text;
  };

  // ── Product ───────────────────────────────────────────────────────────────────
  public type Product = {
    id : Common.ProductId;
    sku : Text;
    name : Text;
    category_id : Common.CategoryId;
    volume_points : Float;
    earn_base : Float;
    mrp : Float;
    hsn_code : Text;
    profile_key : Common.ProfileKey;
    owner : Common.UserId;

    // Product-specific content
    instructions : ?Text;                // Usage/preparation instructions for the product
    serving_size : ?Text;                // e.g. "2 scoops (30g)" or "1 tablet"

    // Who-columns
    created_by : Common.UserId;
    last_updated_by : Common.UserId;
    creation_date : Common.Timestamp;
    last_update_date : Common.Timestamp;
  };

  // Input — no who-columns
  public type ProductInput = {
    sku : Text;
    name : Text;
    category_id : Common.CategoryId;
    volume_points : Float;
    earn_base : Float;
    mrp : Float;
    hsn_code : Text;
    instructions : ?Text;                // Product-specific instructions
    serving_size : ?Text;                // Serving size / count
  };
};
