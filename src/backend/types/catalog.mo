import Common "common";

module {
  public type Category = {
    id : Common.CategoryId;
    name : Text;
    description : Text;
    profile_key : Common.ProfileKey;
    owner : Common.UserId;
  };

  public type CategoryInput = {
    name : Text;
    description : Text;
  };

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
  };

  public type ProductInput = {
    sku : Text;
    name : Text;
    category_id : Common.CategoryId;
    volume_points : Float;
    earn_base : Float;
    mrp : Float;
    hsn_code : Text;
  };
};
