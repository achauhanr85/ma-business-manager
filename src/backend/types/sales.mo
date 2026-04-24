import Common "common";

module {
  public type CartItem = {
    product_id : Common.ProductId;
    quantity : Nat;
    actual_sale_price : Float;
  };

  public type SaleItem = {
    sale_id : Common.SaleId;
    product_id : Common.ProductId;
    product_name_snapshot : Text;
    unit_cost_snapshot : Float;
    mrp_snapshot : Float;
    volume_points_snapshot : Float;
    quantity : Nat;
    actual_sale_price : Float;
  };

  public type Sale = {
    id : Common.SaleId;
    timestamp : Common.Timestamp;
    total_revenue : Float;
    total_volume_points : Float;
    total_profit : Float;
    owner : Common.UserId;
  };
};
