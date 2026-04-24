import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCreateSale,
  useGetInventoryLevels,
  useGetProducts,
} from "@/hooks/useBackend";
import type { CartItem, InventoryLevel, Product } from "@/types";
import {
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

interface SalesPageProps {
  onNavigate: (path: string, saleId?: bigint) => void;
}

interface CartEntry {
  product: Product;
  quantity: number;
  salePrice: number;
}

function getStockQty(productId: bigint, levels: InventoryLevel[]): bigint {
  const level = levels.find(
    (l) => l.product_id.toString() === productId.toString(),
  );
  return level?.total_qty ?? BigInt(0);
}

function ProductSearchPanel({
  products,
  inventoryLevels,
  onAddToCart,
  cartEntries,
}: {
  products: Product[];
  inventoryLevels: InventoryLevel[];
  onAddToCart: (product: Product) => void;
  cartEntries: CartEntry[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 20);
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, query]);

  const cartProductIds = new Set(
    cartEntries.map((e) => e.product.id.toString()),
  );

  return (
    <div className="flex flex-col h-full">
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-ocid="sales.search_input"
        />
        {query && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setQuery("")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1 space-y-2 pr-1">
        {filtered.length === 0 && (
          <div
            className="text-center py-10 text-muted-foreground text-sm"
            data-ocid="sales.products.empty_state"
          >
            <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
            No products found
          </div>
        )}
        {filtered.map((product, idx) => {
          const stock = getStockQty(product.id, inventoryLevels);
          const inCart = cartProductIds.has(product.id.toString());
          const outOfStock = stock <= BigInt(0);

          return (
            <button
              type="button"
              key={product.id.toString()}
              className={`w-full text-left rounded-lg border p-3 transition-smooth hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                inCart
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-card"
              } ${outOfStock ? "opacity-50 cursor-not-allowed" : ""}`}
              onClick={() => !outOfStock && onAddToCart(product)}
              disabled={outOfStock}
              data-ocid={`sales.product.item.${idx + 1}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    SKU: {product.sku}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-foreground">
                    ₹{product.mrp.toFixed(2)}
                  </p>
                  <Badge
                    variant={outOfStock ? "destructive" : "secondary"}
                    className="text-xs mt-1"
                  >
                    {outOfStock ? "Out of stock" : `${stock.toString()} units`}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-muted-foreground">
                  {product.volume_points} VP
                </span>
                {inCart && (
                  <Badge
                    variant="outline"
                    className="text-xs text-primary border-primary/40"
                  >
                    In cart
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CartPanel({
  entries,
  onUpdateQty,
  onUpdatePrice,
  onRemove,
  onClear,
  onConfirm,
  isConfirming,
  inventoryLevels,
}: {
  entries: CartEntry[];
  onUpdateQty: (id: bigint, qty: number) => void;
  onUpdatePrice: (id: bigint, price: number) => void;
  onRemove: (id: bigint) => void;
  onClear: () => void;
  onConfirm: () => void;
  isConfirming: boolean;
  inventoryLevels: InventoryLevel[];
}) {
  const totalRevenue = entries.reduce(
    (sum, e) => sum + e.salePrice * e.quantity,
    0,
  );
  const totalVP = entries.reduce(
    (sum, e) => sum + e.product.volume_points * e.quantity,
    0,
  );
  const totalProfit = entries.reduce((sum, e) => {
    const stock = inventoryLevels.find(
      (l) => l.product_id.toString() === e.product.id.toString(),
    );
    const avgCost =
      stock && stock.batches.length > 0
        ? stock.batches[0].unit_cost
        : e.product.earn_base;
    return sum + (e.salePrice - avgCost) * e.quantity;
  }, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">
            Cart ({entries.length} items)
          </span>
        </div>
        {entries.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-muted-foreground hover:text-destructive text-xs h-7"
            data-ocid="sales.cart.clear_button"
          >
            Clear all
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <div
          className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground py-8"
          data-ocid="sales.cart.empty_state"
        >
          <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">Cart is empty</p>
          <p className="text-xs mt-1">Search and click products to add them</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {entries.map((entry, idx) => {
              const qtyInputId = `cart-qty-${entry.product.id.toString()}`;
              const priceInputId = `cart-price-${entry.product.id.toString()}`;
              return (
                <div
                  key={entry.product.id.toString()}
                  className="rounded-lg border border-border bg-card p-3 space-y-2"
                  data-ocid={`sales.cart.item.${idx + 1}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {entry.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.product.volume_points * entry.quantity} VP ·{" "}
                        <span className="text-primary">
                          ₹{(entry.salePrice * entry.quantity).toFixed(2)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(entry.product.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      aria-label="Remove item"
                      data-ocid={`sales.cart.delete_button.${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Quantity */}
                    <div>
                      <label
                        htmlFor={qtyInputId}
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        Qty
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() =>
                            onUpdateQty(
                              entry.product.id,
                              Math.max(1, entry.quantity - 1),
                            )
                          }
                          aria-label="Decrease quantity"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <Input
                          id={qtyInputId}
                          type="number"
                          min={1}
                          value={entry.quantity}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value, 10);
                            if (!Number.isNaN(v) && v > 0)
                              onUpdateQty(entry.product.id, v);
                          }}
                          className="h-6 text-center text-xs w-12 px-1"
                          data-ocid={`sales.cart.qty_input.${idx + 1}`}
                        />
                        <button
                          type="button"
                          className="w-6 h-6 rounded border border-border flex items-center justify-center hover:bg-muted transition-colors"
                          onClick={() =>
                            onUpdateQty(entry.product.id, entry.quantity + 1)
                          }
                          aria-label="Increase quantity"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Price */}
                    <div>
                      <label
                        htmlFor={priceInputId}
                        className="text-xs text-muted-foreground mb-1 block"
                      >
                        Price (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          ₹
                        </span>
                        <Input
                          id={priceInputId}
                          type="number"
                          min={0}
                          step={0.01}
                          value={entry.salePrice}
                          onChange={(e) => {
                            const v = Number.parseFloat(e.target.value);
                            if (!Number.isNaN(v) && v >= 0)
                              onUpdatePrice(entry.product.id, v);
                          }}
                          className="h-6 text-xs pl-5"
                          data-ocid={`sales.cart.price_input.${idx + 1}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Revenue</span>
              <span className="font-semibold text-foreground">
                ₹{totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Volume Points</span>
              <span className="font-semibold text-foreground">
                {totalVP} VP
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Profit</span>
              <span
                className={`font-semibold ${totalProfit >= 0 ? "text-primary" : "text-destructive"}`}
              >
                ₹{totalProfit.toFixed(2)}
              </span>
            </div>

            <Separator className="my-2" />

            <Button
              type="button"
              className="w-full"
              onClick={onConfirm}
              disabled={entries.length === 0 || isConfirming}
              data-ocid="sales.confirm_button"
            >
              {isConfirming ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Processing…
                </span>
              ) : (
                `Confirm Sale · ₹${totalRevenue.toFixed(2)}`
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function SalesPage({ onNavigate }: SalesPageProps) {
  const { data: products = [], isLoading: loadingProducts } = useGetProducts();
  const { data: inventoryLevels = [], isLoading: loadingInventory } =
    useGetInventoryLevels();
  const createSale = useCreateSale();

  const [cart, setCart] = useState<CartEntry[]>([]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find(
        (e) => e.product.id.toString() === product.id.toString(),
      );
      if (existing) return prev;
      return [...prev, { product, quantity: 1, salePrice: product.mrp }];
    });
  };

  const updateQty = (id: bigint, qty: number) => {
    const stock = getStockQty(id, inventoryLevels);
    const cappedQty = Math.min(qty, Number(stock));
    if (cappedQty <= 0) {
      toast.warning("Insufficient stock for that quantity");
      return;
    }
    setCart((prev) =>
      prev.map((e) =>
        e.product.id.toString() === id.toString()
          ? { ...e, quantity: cappedQty }
          : e,
      ),
    );
  };

  const updatePrice = (id: bigint, price: number) => {
    setCart((prev) =>
      prev.map((e) =>
        e.product.id.toString() === id.toString()
          ? { ...e, salePrice: price }
          : e,
      ),
    );
  };

  const removeFromCart = (id: bigint) => {
    setCart((prev) =>
      prev.filter((e) => e.product.id.toString() !== id.toString()),
    );
  };

  const clearCart = () => setCart([]);

  const confirmSale = async () => {
    // Validate stock
    for (const entry of cart) {
      const stock = getStockQty(entry.product.id, inventoryLevels);
      if (BigInt(entry.quantity) > stock) {
        toast.error(
          `Insufficient stock for "${entry.product.name}". Only ${stock.toString()} units available.`,
        );
        return;
      }
    }

    const cartItems: CartItem[] = cart.map((e) => ({
      product_id: e.product.id,
      quantity: BigInt(e.quantity),
      actual_sale_price: e.salePrice,
    }));

    try {
      const saleId = await createSale.mutateAsync(cartItems);
      if (saleId === null || saleId === undefined) {
        toast.error("Sale failed — insufficient inventory");
        return;
      }
      clearCart();
      toast.success("Sale confirmed!");
      onNavigate("/receipt", saleId as bigint);
    } catch {
      toast.error("Failed to create sale. Please try again.");
    }
  };

  const isLoading = loadingProducts || loadingInventory;

  return (
    <div className="space-y-4" data-ocid="sales.page">
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-[500px] rounded-lg" />
          </div>
          <Skeleton className="h-[540px] rounded-lg" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Product Search */}
          <Card
            className="lg:col-span-2 card-elevated"
            data-ocid="sales.products.panel"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Products
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] flex flex-col">
              <ProductSearchPanel
                products={products}
                inventoryLevels={inventoryLevels}
                onAddToCart={addToCart}
                cartEntries={cart}
              />
            </CardContent>
          </Card>

          {/* Cart */}
          <Card className="card-elevated" data-ocid="sales.cart.panel">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[500px] flex flex-col">
              <CartPanel
                entries={cart}
                onUpdateQty={updateQty}
                onUpdatePrice={updatePrice}
                onRemove={removeFromCart}
                onClear={clearCart}
                onConfirm={confirmSale}
                isConfirming={createSale.isPending}
                inventoryLevels={inventoryLevels}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
