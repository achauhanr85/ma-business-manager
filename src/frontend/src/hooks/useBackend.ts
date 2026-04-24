import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import type {
  CartItem,
  CategoryInput,
  ProductInput,
  ProfileInput,
  PurchaseOrderInput,
} from "../backend";

function useBackendActor() {
  return useActor(createActor);
}

export function useGetProfile() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateProfile(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useGetCategories() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCategories();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateCategory() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createCategory(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useUpdateCategory() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: bigint; input: CategoryInput }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateCategory(id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useDeleteCategory() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteCategory(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

export function useGetProducts() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getProducts();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreateProduct() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProductInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createProduct(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: bigint; input: ProductInput }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateProduct(id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteProduct(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useGetInventoryLevels() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["inventory-levels"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getInventoryLevels();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetInventoryBatches(productId: bigint | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["inventory-batches", productId?.toString()],
    queryFn: async () => {
      if (!actor || !productId) return [];
      return actor.getInventoryBatches(productId);
    },
    enabled: !!actor && !isFetching && !!productId,
  });
}

export function useGetSales() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getSales();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetSaleItems(saleId: bigint | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["sale-items", saleId?.toString()],
    queryFn: async () => {
      if (!actor || !saleId) return [];
      return actor.getSaleItems(saleId);
    },
    enabled: !!actor && !isFetching && !!saleId,
  });
}

export function useCreateSale() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cartItems: CartItem[]) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createSale(cartItems);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

export function useGetPurchaseOrders() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getPurchaseOrders();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useCreatePurchaseOrder() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PurchaseOrderInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createPurchaseOrder(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });
}

export function useMarkPurchaseOrderReceived() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (poId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.markPurchaseOrderReceived(poId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
    },
  });
}

export function useGetDashboardStats() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getDashboardStats();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetMonthlySalesTrend() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["monthly-sales-trend"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getMonthlySalesTrend();
    },
    enabled: !!actor && !isFetching,
  });
}
