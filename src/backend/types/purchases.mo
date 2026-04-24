import Common "common";

module {
  public type POStatus = { #Pending; #Received };

  public type PurchaseOrderItem = {
    po_id : Common.PurchaseOrderId;
    product_id : Common.ProductId;
    quantity : Nat;
    unit_cost : Float;
  };

  public type PurchaseOrderItemInput = {
    product_id : Common.ProductId;
    quantity : Nat;
    unit_cost : Float;
  };

  public type PurchaseOrder = {
    id : Common.PurchaseOrderId;
    vendor : Text;
    timestamp : Common.Timestamp;
    status : POStatus;
    owner : Common.UserId;
  };

  public type PurchaseOrderInput = {
    vendor : Text;
    items : [PurchaseOrderItemInput];
  };
};
