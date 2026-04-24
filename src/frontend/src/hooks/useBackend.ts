import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createActor } from "../backend";
import { PaymentMode, PaymentStatus } from "../backend";
import type {
  BodyCompositionInput,
  CartItem,
  CategoryInput,
  CustomerId,
  CustomerInput,
  CustomerOrderDetail,
  InventoryMovementInput,
  ProductInput,
  ProfileInput,
  ProfileKey,
  PurchaseOrderInput,
  SaleId,
  SaleInput,
  UpdateSaleInput,
  UserProfileInput,
  WarehouseName,
} from "../backend";
import type {
  CustomerOrderFlat,
  CustomerOrderItem,
  ProfileStatsExtended,
  SaleInputExtended,
  UpdateSaleInputUI,
} from "../types";

function useBackendActor() {
  return useActor(createActor);
}

// ─── Profile ─────────────────────────────────────────────────────────────────

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

export function useCreateProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createProfile(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

export function useJoinProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      displayName,
      warehouseName,
    }: {
      profileKey: ProfileKey;
      displayName: string;
      warehouseName: WarehouseName;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.joinProfile(profileKey, displayName, warehouseName);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

export function useGetProfileByKey(profileKey: ProfileKey | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["profile-by-key", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return null;
      return actor.getProfileByKey(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export function useGetUserProfile() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getUserProfile();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useUpdateUserProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UserProfileInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateUserProfile(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

export function useInitSuperAdmin() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.initSuperAdmin();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

export function useClaimSuperAdmin() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.claimSuperAdmin();
    },
    onSuccess: (succeeded) => {
      if (succeeded) {
        // Role was promoted — refetch user profile so routing re-evaluates
        qc.invalidateQueries({ queryKey: ["user-profile"] });
      }
    },
  });
}

// ─── Categories ──────────────────────────────────────────────────────────────

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

// ─── Products ────────────────────────────────────────────────────────────────

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

// ─── Inventory ───────────────────────────────────────────────────────────────

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

export function useMoveInventory() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: InventoryMovementInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.moveInventory(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    },
  });
}

export function useGetInventoryMovements() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["inventory-movements"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getInventoryMovements();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Sales ───────────────────────────────────────────────────────────────────

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

export function useGetSalesByCustomer(customerId: bigint | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["sales-by-customer", customerId?.toString()],
    queryFn: async () => {
      if (!actor || !customerId) return [];
      return actor.getSalesByCustomer(customerId);
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

export function useCreateSale() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaleInputExtended) => {
      if (!actor) throw new Error("Actor not ready");
      // Include all payment fields — backend SaleInput now accepts them.
      // Map lowercase UI strings to backend PaymentMode/PaymentStatus enums.
      const PAYMENT_MODE_MAP: Record<string, PaymentMode> = {
        cash: PaymentMode.Cash,
        card: PaymentMode.Card,
        upi: PaymentMode.Other,
        bank_transfer: PaymentMode.BankTransfer,
        other: PaymentMode.Other,
        check: PaymentMode.Check,
      };
      const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
        paid: PaymentStatus.Paid,
        unpaid: PaymentStatus.Unpaid,
        partial: PaymentStatus.Partial_,
      };
      const saleInput: SaleInput = {
        cart_items: input.cart_items,
        customer_id: input.customer_id,
        ...(input.payment_mode !== undefined && {
          payment_mode:
            PAYMENT_MODE_MAP[input.payment_mode] ?? PaymentMode.Other,
        }),
        ...(input.payment_status !== undefined && {
          payment_status:
            PAYMENT_STATUS_MAP[input.payment_status] ?? PaymentStatus.Paid,
        }),
        ...(input.amount_paid !== undefined && {
          amount_paid: input.amount_paid,
        }),
      };
      return actor.createSale(saleInput);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["sales-by-customer"] });
    },
  });
}

// ─── Purchase Orders ─────────────────────────────────────────────────────────

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

// ─── Customers ───────────────────────────────────────────────────────────────

export function useGetCustomers() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCustomers();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetCustomer(customerId: bigint | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["customer", customerId?.toString()],
    queryFn: async () => {
      if (!actor || !customerId) return null;
      return actor.getCustomer(customerId);
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

export function useCheckCustomerDuplicate() {
  const { actor } = useBackendActor();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.checkCustomerDuplicate(name);
    },
  });
}

export function useCreateCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerInput) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.createCustomer(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useUpdateCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: bigint;
      input: CustomerInput;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.updateCustomer(id, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useDeleteCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.deleteCustomer(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

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

export function useGetSuperAdminStats() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["super-admin-stats"],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getSuperAdminStats();
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Update Sale ──────────────────────────────────────────────────────────────

export function useUpdateSale() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateSaleInputUI) => {
      if (!actor) throw new Error("Actor not ready");
      // Dry-run validation: ensure items list is non-empty before calling backend
      // This prevents sending empty cart edits that would clear a sale
      if (!input.items || input.items.length === 0) {
        throw new Error("Sale must have at least one item");
      }
      // Map lowercase UI payment strings to backend enums
      const PAYMENT_MODE_MAP: Record<string, PaymentMode> = {
        cash: PaymentMode.Cash,
        card: PaymentMode.Card,
        upi: PaymentMode.Other,
        bank_transfer: PaymentMode.BankTransfer,
        other: PaymentMode.Other,
        check: PaymentMode.Check,
      };
      const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
        paid: PaymentStatus.Paid,
        unpaid: PaymentStatus.Unpaid,
        partial: PaymentStatus.Partial_,
      };
      const backendInput: UpdateSaleInput = {
        sale_id: input.sale_id,
        items: input.items,
        ...(input.payment_mode !== undefined && {
          payment_mode:
            PAYMENT_MODE_MAP[input.payment_mode] ?? PaymentMode.Other,
        }),
        ...(input.payment_status !== undefined && {
          payment_status:
            PAYMENT_STATUS_MAP[input.payment_status] ?? PaymentStatus.Paid,
        }),
        ...(input.amount_paid !== undefined && {
          amount_paid: input.amount_paid,
        }),
      };
      return actor.updateSale(backendInput);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale-items"] });
      qc.invalidateQueries({ queryKey: ["sales-by-customer"] });
      qc.invalidateQueries({ queryKey: ["customer-orders"] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// ─── Get Customer Orders (rich history) ──────────────────────────────────────

export function useGetCustomerOrders(customerId: CustomerId | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<CustomerOrderFlat[]>({
    queryKey: ["customer-orders", customerId?.toString()],
    queryFn: async () => {
      if (!actor || !customerId) return [];
      // Backend returns Array<{ sale: Sale, items: SaleItem[] }>
      // Flatten to CustomerOrderFlat for the UI
      const result: CustomerOrderDetail[] =
        (await actor.getCustomerOrders(customerId)) ?? [];
      return result.map((entry) => ({
        sale_id: entry.sale.id,
        timestamp: entry.sale.timestamp,
        total_revenue: entry.sale.total_revenue,
        total_profit: entry.sale.total_profit,
        discount_applied: entry.sale.discount_applied ?? 0,
        payment_mode: entry.sale.payment_mode as string | undefined,
        payment_status: entry.sale.payment_status as string | undefined,
        amount_paid: entry.sale.amount_paid,
        balance_due: entry.sale.balance_due,
        items: entry.items.map(
          (it) =>
            ({
              product_id: it.product_id,
              product_name: it.product_name_snapshot,
              quantity: it.quantity,
              actual_sale_price: it.actual_sale_price,
              unit_cost_snapshot: it.unit_cost_snapshot,
              volume_points_snapshot: it.volume_points_snapshot,
              mrp_snapshot: it.mrp_snapshot,
            }) satisfies CustomerOrderItem,
        ),
      }));
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

// ─── Super Admin Governance ───────────────────────────────────────────────────
// These hooks call new backend methods: getAllProfilesForAdmin, enableProfile,
// setProfileWindow. If the backend method is not yet deployed, they degrade
// gracefully (return empty/null rather than crashing).

export function useGetAllProfilesForAdmin() {
  const { actor, isFetching } = useBackendActor();
  return useQuery<ProfileStatsExtended[]>({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      if (!actor) return [];
      // getAllProfilesForAdmin returns ProfilePublic[] which includes is_enabled/start_date/end_date
      // ProfileStatsExtended is now an alias for ProfileStats which has all governance fields
      if (typeof actor.getAllProfilesForAdmin !== "function") return [];
      const profiles = await actor.getAllProfilesForAdmin();
      // Map ProfilePublic to ProfileStatsExtended shape for the Super Admin UI
      return profiles.map((p) => ({
        profile_key: p.profile_key,
        business_name: p.business_name,
        owner_principal: p.owner,
        is_enabled: p.is_enabled,
        start_date: p.start_date ?? null,
        end_date: p.end_date ?? null,
        user_count: BigInt(0),
        storage_estimate_bytes: BigInt(0),
        last_activity: p.created_at,
        is_archived: p.is_archived,
      })) as ProfileStatsExtended[];
    },
    enabled: !!actor && !isFetching,
  });
}

export function useEnableProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      enabled,
    }: {
      profileKey: string;
      enabled: boolean;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      // DRY-RUN: enableProfile(profileKey, enabled) updates is_enabled flag
      // and blocks/allows login + transactions for the profile.
      return actor.enableProfile(profileKey, enabled);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
    },
  });
}

export function useSetProfileWindow() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      startDate,
      endDate,
    }: {
      profileKey: string;
      startDate: number | bigint | null;
      endDate: number | bigint | null;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      // Convert ms timestamps to nanoseconds (bigint) for backend
      // DRY-RUN: setProfileWindow stores the active window; middleware blocks
      // transactions when Date.now() is outside it and returns 403 Restricted.
      // Governance gatekeeper verified.
      const toNs = (v: number | bigint | null): bigint | null => {
        if (v === null) return null;
        if (typeof v === "bigint") return v;
        return BigInt(v) * BigInt(1_000_000);
      };
      return actor.setProfileWindow(profileKey, toNs(startDate), toNs(endDate));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
    },
  });
}

export function useDeleteProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileKey: string) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.deleteProfile !== "function")
        throw new Error("deleteProfile not available");
      return actor.deleteProfile(profileKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

export function useUpdateProfileKey() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      oldKey,
      newKey,
    }: {
      oldKey: string;
      newKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.updateProfileKey !== "function")
        throw new Error("updateProfileKey not available");
      return actor.updateProfileKey(oldKey, newKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ─── User Management (Super Admin) ───────────────────────────────────────────

export function useGetAllUsersForAdmin() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["admin-all-users"],
    queryFn: async () => {
      if (!actor) return [];
      if (typeof actor.getAllUsersForAdmin !== "function") return [];
      return actor.getAllUsersForAdmin();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetUsersByProfile(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["users-by-profile", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      if (typeof actor.getUsersByProfile !== "function") return [];
      return actor.getUsersByProfile(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

export function useAssignUserRole() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetUserId,
      newRole,
      profileKey,
    }: {
      targetUserId: import("../backend").UserId;
      newRole: import("../backend").UserRole;
      profileKey: import("../backend").ProfileKey;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.assignUserRole(targetUserId, newRole, profileKey);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      qc.invalidateQueries({
        queryKey: ["users-by-profile", variables.profileKey],
      });
    },
  });
}

// ─── Body Composition ─────────────────────────────────────────────────────────

export function useCreateBodyCompositionEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      input,
    }: {
      customerId: bigint;
      input: BodyCompositionInput;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.createBodyCompositionEntry !== "function")
        throw new Error("createBodyCompositionEntry not available");
      return actor.createBodyCompositionEntry(customerId, input);
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["body-composition", variables.customerId.toString()],
      });
    },
  });
}

export function useGetBodyCompositionHistory(customerId: bigint | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["body-composition", customerId?.toString()],
    queryFn: async () => {
      if (!actor || !customerId) return [];
      if (typeof actor.getBodyCompositionHistory !== "function") return [];
      return actor.getBodyCompositionHistory(customerId);
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

export function useDeleteBodyCompositionEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.deleteBodyCompositionEntry !== "function")
        throw new Error("deleteBodyCompositionEntry not available");
      return actor.deleteBodyCompositionEntry(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["body-composition"] });
    },
  });
}
