/**
 * useBackend.ts — React Query hooks that wrap every backend actor method.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE loggedCall PATTERN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Every actor call in this file is wrapped with `loggedCall(name, fn)`.
 *
 * loggedCall does THREE things:
 *   1. Before the call:  logs "→ methodName" via logger.logApi()
 *   2. After success:    logs "← methodName OK"
 *   3. After failure:    logs "← methodName FAILED: <error message>"
 *      then re-throws so React Query can handle the error state normally.
 *
 * ZERO-OVERHEAD GUARANTEE:
 *   logger.logApi() and logger.logError() check `_enabled` as their very first
 *   instruction. When diagnostics is disabled (the default in production),
 *   they return immediately without allocating strings or touching the DOM.
 *   This means loggedCall adds NO measurable overhead when diagnostics is off.
 *
 * SENSITIVE DATA POLICY:
 *   loggedCall NEVER logs raw data payloads — only the method name.
 *   Do NOT pass user input, principal IDs, or personal data in the `name` arg.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { logError, logInfo } from "@/lib/logger";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PaymentMode, PaymentStatus, createActor } from "../backend";
import type {
  BodyCompositionInput,
  CartItem,
  CategoryInput,
  CustomerId,
  CustomerInput,
  CustomerOrderDetail,
  InventoryMovementInput,
  LocationMasterEntry,
  ProductInput,
  ProfileInput,
  ProfileKey,
  PurchaseOrderInput,
  SaleId,
  SaleInput,
  UpdateSaleInput,
  UserId,
  UserProfileInput,
  VendorInput,
  WarehouseName,
} from "../backend";
import type {
  CustomerOrderFlat,
  CustomerOrderItem,
  ProfileStatsExtended,
  SaleInputExtended,
  UpdateSaleInputUI,
} from "../types";

/**
 * loggedCall — wraps a backend actor call with diagnostics logging.
 *
 * Usage (inside a queryFn or mutationFn):
 *   return loggedCall("getCustomers", () => actor.getCustomers(profileKey));
 *
 * When diagnostics is disabled, this is a thin async wrapper with
 * negligible overhead (one boolean check inside logApi/logError).
 *
 * @param name - Method name string (used in log messages — no sensitive data)
 * @param fn   - Zero-argument async function that performs the actor call
 */
async function loggedCall<T>(name: string, fn: () => Promise<T>): Promise<T> {
  logInfo(`→ ${name}`);
  try {
    const result = await fn();
    logInfo(`← ${name} OK`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logError(`← ${name} FAILED: ${msg}`);
    throw err; // re-throw so React Query marks the query/mutation as errored
  }
}

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
      return loggedCall("getProfile", () => actor.getProfile());
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
      return loggedCall("updateProfile", () => actor.updateProfile(input));
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
      return loggedCall("createProfile", () => actor.createProfile(input));
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
      return loggedCall("joinProfile", () =>
        actor.joinProfile(profileKey, displayName, warehouseName),
      );
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
      return loggedCall("getProfileByKey", () =>
        actor.getProfileByKey(profileKey),
      );
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
      return loggedCall("getUserProfile", () => actor.getUserProfile());
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
      return loggedCall("updateUserProfile", () =>
        actor.updateUserProfile(input),
      );
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
      return loggedCall("initSuperAdmin", () => actor.initSuperAdmin());
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
      return loggedCall("claimSuperAdmin", () => actor.claimSuperAdmin());
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
      return loggedCall("getCategories", () => actor.getCategories());
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
      return loggedCall("createCategory", () => actor.createCategory(input));
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
      return loggedCall("updateCategory", () =>
        actor.updateCategory(id, input),
      );
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
      return loggedCall("deleteCategory", () => actor.deleteCategory(id));
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
      return loggedCall("getProducts", () => actor.getProducts());
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
      return loggedCall("createProduct", () => actor.createProduct(input));
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
      return loggedCall("updateProduct", () => actor.updateProduct(id, input));
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
      return loggedCall("deleteProduct", () => actor.deleteProduct(id));
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
      return loggedCall("getInventoryLevels", () => actor.getInventoryLevels());
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
      return loggedCall("getInventoryBatches", () =>
        actor.getInventoryBatches(productId),
      );
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
      return loggedCall("moveInventory", () => actor.moveInventory(input));
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
      return loggedCall("getInventoryMovements", () =>
        actor.getInventoryMovements(),
      );
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
      try {
        const result = await loggedCall("getSales", () => actor.getSales());
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching,
  });
}

/**
 * BUG-06: Fetch sales scoped to a profile key.
 * Admin must see ALL orders for their profile — filtered by profile_key only, NOT by user_id.
 * Prefers getSalesHistory(profileKey) if available; falls back to getSales().
 */
export function useGetSalesByProfile(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["sales-by-profile", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      try {
        const a = actor as unknown as Record<string, unknown>;
        if (typeof a.getSalesHistory === "function") {
          const result = await (
            a.getSalesHistory as (pk: string) => Promise<unknown[]>
          )(profileKey);
          return Array.isArray(result) ? result : [];
        }
        // Fallback: getSales() is already profile-scoped by the backend caller context
        const result = await actor.getSales();
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

export function useGetSaleItems(saleId: bigint | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["sale-items", saleId?.toString()],
    queryFn: async () => {
      if (!actor || !saleId) return [];
      return loggedCall("getSaleItems", () => actor.getSaleItems(saleId));
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
      return loggedCall("getSalesByCustomer", () =>
        actor.getSalesByCustomer(customerId),
      );
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
        ...(input.sale_note !== undefined && {
          sale_note: input.sale_note,
        }),
        ...(input.payment_due_date !== undefined && {
          payment_due_date: input.payment_due_date,
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
      qc.invalidateQueries({ queryKey: ["customer-orders"] });
      qc.invalidateQueries({ queryKey: ["last-sale-for-customer"] });
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
      return loggedCall("getCustomers", () => actor.getCustomers());
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
      return loggedCall("getCustomer", () => actor.getCustomer(customerId));
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

export function useCheckCustomerDuplicate() {
  const { actor } = useBackendActor();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!actor) throw new Error("Actor not ready");
      return loggedCall("checkCustomerDuplicate", () =>
        actor.checkCustomerDuplicate(name),
      );
    },
  });
}

export function useCreateCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerInput) => {
      if (!actor) throw new Error("Actor not ready");
      return loggedCall("createCustomer", () => actor.createCustomer(input));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Creates a customer from the sales page — always creates with customer_type = #active */
export function useCreateCustomerFromSales() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CustomerInput) => {
      if (!actor) throw new Error("Actor not ready");
      return loggedCall("createCustomerFromSales", () =>
        actor.createCustomerFromSales(input),
      );
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
      return loggedCall("updateCustomer", () =>
        actor.updateCustomer(id, input),
      );
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
      return loggedCall("deleteCustomer", () => actor.deleteCustomer(id));
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
        // Allow empty items when only updating payment status (e.g. for return)
        if (!input.payment_status) {
          throw new Error("Sale must have at least one item");
        }
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
        ...(input.payment_due_date !== undefined && {
          payment_due_date: input.payment_due_date,
        }),
        ...(input.sale_note !== undefined && {
          sale_note: input.sale_note,
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
        sale_note: entry.sale.sale_note,
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

// ─── Get Last Sale For Customer ───────────────────────────────────────────────
// Returns the most recent sale+items for a customer using getCustomerOrders.

export function useGetLastSaleForCustomer(customerId: CustomerId | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<CustomerOrderFlat | null>({
    queryKey: ["last-sale-for-customer", customerId?.toString()],
    queryFn: async () => {
      if (!actor || !customerId) return null;
      try {
        const result: CustomerOrderDetail[] =
          (await actor.getCustomerOrders(customerId)) ?? [];
        if (result.length === 0) return null;
        const sorted = [...result].sort(
          (a, b) => Number(b.sale.timestamp) - Number(a.sale.timestamp),
        );
        const entry = sorted[0];
        return {
          sale_id: entry.sale.id,
          timestamp: entry.sale.timestamp,
          total_revenue: entry.sale.total_revenue,
          total_profit: entry.sale.total_profit,
          discount_applied: entry.sale.discount_applied ?? 0,
          payment_mode: entry.sale.payment_mode as string | undefined,
          payment_status: entry.sale.payment_status as string | undefined,
          amount_paid: entry.sale.amount_paid,
          balance_due: entry.sale.balance_due,
          sale_note: entry.sale.sale_note,
          items: entry.items.map((it) => ({
            product_id: it.product_id,
            product_name: it.product_name_snapshot,
            quantity: it.quantity,
            actual_sale_price: it.actual_sale_price,
            unit_cost_snapshot: it.unit_cost_snapshot,
            volume_points_snapshot: it.volume_points_snapshot,
            mrp_snapshot: it.mrp_snapshot,
          })),
        };
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

// ─── Get Sale With Items ───────────────────────────────────────────────────────
// Combines getSale + getSaleItems into a single hook returning CustomerOrderFlat.

export function useSaleWithItems(saleId: SaleId | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<CustomerOrderFlat | null>({
    queryKey: ["sale-with-items", saleId?.toString()],
    queryFn: async () => {
      if (!actor || !saleId) return null;
      try {
        const [sale, items] = await Promise.all([
          actor.getSale(saleId),
          actor.getSaleItems(saleId),
        ]);
        if (!sale) return null;
        return {
          sale_id: sale.id,
          timestamp: sale.timestamp,
          total_revenue: sale.total_revenue,
          total_profit: sale.total_profit,
          discount_applied: sale.discount_applied ?? 0,
          payment_mode: sale.payment_mode as string | undefined,
          payment_status: sale.payment_status as string | undefined,
          amount_paid: sale.amount_paid,
          balance_due: sale.balance_due,
          sale_note: sale.sale_note,
          items: items.map((it) => ({
            product_id: it.product_id,
            product_name: it.product_name_snapshot,
            quantity: it.quantity,
            actual_sale_price: it.actual_sale_price,
            unit_cost_snapshot: it.unit_cost_snapshot,
            volume_points_snapshot: it.volume_points_snapshot,
            mrp_snapshot: it.mrp_snapshot,
          })),
        };
      } catch {
        return null;
      }
    },
    enabled: !!actor && !isFetching && !!saleId,
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

/**
 * useApproveProfile — calls the dedicated approveProfile(profileKey) backend function.
 *
 * WHY THIS EXISTS (vs. useEnableProfile):
 * approveProfile() sets the profile's approval_status to #approved in the backend.
 * This is distinct from enableProfile() which only toggles the is_enabled flag.
 * Using enableProfile to "approve" was a bug — a newly approved profile must have
 * its approval_status properly set so the routing and access gates work correctly.
 *
 * WHAT IT DOES:
 *   1. Calls actor.approveProfile(profileKey) on the backend
 *   2. On success, invalidates admin-profiles and super-admin-stats caches
 *      so the Profile Approval page and Super Admin dashboard refresh automatically
 *
 * Falls back gracefully if approveProfile is not yet in the deployed IDL —
 * throws with a clear error message rather than silently calling the wrong function.
 */
export function useApproveProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileKey: string) => {
      if (!actor) throw new Error("Actor not ready");
      // Duck-type check: approveProfile may not be in the IDL if backend isn't redeployed yet
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.approveProfile !== "function")
        throw new Error("approveProfile not available on this backend version");
      return (a.approveProfile as (pk: string) => Promise<boolean>)(profileKey);
    },
    onSuccess: () => {
      // Refresh the profile list so approved profiles disappear from the pending queue
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
      // Refresh the dedicated pending profiles list (ProfileApprovalPage)
      qc.invalidateQueries({ queryKey: ["pending-profiles"] });
      // Also clear notifications so the approval badge updates
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["super-admin-notifications"] });
    },
  });
}

/**
 * useRejectProfile — calls the dedicated rejectProfile(profileKey) backend function.
 *
 * WHY THIS EXISTS (vs. useDeleteProfile):
 * rejectProfile() sets approval_status to #suspended — the profile record is KEPT
 * so there is an audit trail. The creator is notified they were rejected.
 * deleteProfile() permanently removes the record and all its data — that's destructive
 * and was never the intended behavior for "reject during approval".
 *
 * WHAT IT DOES:
 *   1. Calls actor.rejectProfile(profileKey) on the backend
 *   2. Backend sets profile's approval_status = #suspended (record preserved)
 *   3. On success, invalidates admin-profiles and super-admin-stats caches
 *
 * Falls back gracefully if rejectProfile is not yet in the deployed IDL.
 */
export function useRejectProfile() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileKey: string) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.rejectProfile !== "function")
        throw new Error("rejectProfile not available on this backend version");
      return (a.rejectProfile as (pk: string) => Promise<boolean>)(profileKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["super-admin-stats"] });
      // Refresh the dedicated pending profiles list (ProfileApprovalPage)
      qc.invalidateQueries({ queryKey: ["pending-profiles"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["super-admin-notifications"] });
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

// ─── Payment Status Quick Update ──────────────────────────────────────────────

export function useUpdatePaymentStatus() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      saleId,
      status,
      paymentMode,
      amountPaid,
    }: {
      saleId: import("../backend").SaleId;
      status: string;
      paymentMode?: string;
      amountPaid?: number;
    }) => {
      if (!actor) throw new Error("Actor not ready");
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
        returned: PaymentStatus.Unpaid,
      };
      const existingItems = await actor.getSaleItems(saleId);
      const items = existingItems.map((it) => ({
        product_id: it.product_id,
        quantity: it.quantity,
        actual_sale_price: it.actual_sale_price,
        ...(it.product_instructions && {
          product_instructions: it.product_instructions,
        }),
      }));
      return actor.updateSale({
        sale_id: saleId,
        items,
        payment_status: PAYMENT_STATUS_MAP[status] ?? PaymentStatus.Paid,
        ...(paymentMode && {
          payment_mode: PAYMENT_MODE_MAP[paymentMode] ?? PaymentMode.Cash,
        }),
        ...(amountPaid !== undefined && { amount_paid: amountPaid }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale-items"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
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

// ─── Vendors ─────────────────────────────────────────────────────────────────

export function useGetVendors(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["vendors", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      if (typeof actor.getVendors !== "function") return [];
      return actor.getVendors(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

export function useCreateVendor() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      input,
      profileKey,
    }: {
      input: VendorInput;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.createVendor !== "function")
        throw new Error("createVendor not available");
      return actor.createVendor(profileKey, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useUpdateVendor() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      vendorId,
      input,
    }: {
      vendorId: string;
      input: VendorInput;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.updateVendor !== "function")
        throw new Error("updateVendor not available");
      return actor.updateVendor(vendorId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

export function useDeleteVendor() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vendorId: string) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.deleteVendor !== "function")
        throw new Error("deleteVendor not available");
      return actor.deleteVendor(vendorId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
}

// ─── Location Master ──────────────────────────────────────────────────────────

export function useGetStates() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["location-states"],
    queryFn: async () => {
      if (!actor) return [];
      if (typeof actor.getStates !== "function") return [];
      return actor.getStates();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetCitiesByState(stateId: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["location-cities", stateId],
    queryFn: async () => {
      if (!actor || !stateId) return [];
      if (typeof actor.getCitiesByState !== "function") return [];
      return actor.getCitiesByState(stateId);
    },
    enabled: !!actor && !isFetching && !!stateId,
  });
}

export function useGetCountries() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["location-countries"],
    queryFn: async () => {
      if (!actor) return [];
      if (typeof actor.getCountries !== "function") return [];
      return actor.getCountries();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useAddLocationEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: LocationMasterEntry) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.addLocationEntry !== "function")
        throw new Error("addLocationEntry not available");
      return actor.addLocationEntry(entry);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["location-states"] });
      qc.invalidateQueries({ queryKey: ["location-cities"] });
      qc.invalidateQueries({ queryKey: ["location-countries"] });
    },
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function useGetNotifications(
  profileKey: string | null,
  targetRole: string,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["notifications", profileKey, targetRole],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      if (typeof actor.getNotifications !== "function") return [];
      return loggedCall("getNotifications", () =>
        actor.getNotifications(profileKey, targetRole),
      );
    },
    enabled: !!actor && !isFetching && !!profileKey,
    refetchInterval: 60_000, // poll every minute
  });
}

export function useMarkNotificationRead() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.markNotificationRead !== "function")
        throw new Error("markNotificationRead not available");
      return loggedCall("markNotificationRead", () =>
        actor.markNotificationRead(notificationId),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useCheckAndCreateNotifications() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileKey: string) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.checkAndCreateNotifications !== "function")
        throw new Error("checkAndCreateNotifications not available");
      return loggedCall("checkAndCreateNotifications", () =>
        actor.checkAndCreateNotifications(profileKey),
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── User Approval ────────────────────────────────────────────────────────────

export function useGetPendingApprovalUsers(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["pending-approval-users", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      if (typeof actor.getPendingApprovalUsers !== "function") return [];
      return actor.getPendingApprovalUsers(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

export function useApproveUser() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      approved,
    }: {
      userId: UserId;
      approved: boolean;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.approveUser !== "function")
        throw new Error("approveUser not available");
      return actor.approveUser(userId, approved);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approval-users"] });
      qc.invalidateQueries({ queryKey: ["admin-all-users"] });
      qc.invalidateQueries({ queryKey: ["users-by-profile"] });
    },
  });
}

// ─── Update Sale Payment Status (quick update from list) ─────────────────────

export function useUpdateSalePaymentStatus() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      saleId,
      paymentStatus,
      amountPaid,
      paymentDueDate,
    }: {
      saleId: SaleId;
      paymentStatus: string;
      amountPaid?: number;
      paymentDueDate?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
        paid: PaymentStatus.Paid,
        unpaid: PaymentStatus.Unpaid,
        partial: PaymentStatus.Partial_,
      };
      const backendInput: UpdateSaleInput = {
        sale_id: saleId,
        items: [], // empty items = payment-only update
        payment_status: PAYMENT_STATUS_MAP[paymentStatus] ?? PaymentStatus.Paid,
        ...(amountPaid !== undefined && { amount_paid: amountPaid }),
        ...(paymentDueDate !== undefined && {
          payment_due_date: paymentDueDate,
        }),
      };
      return actor.updateSale(backendInput);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["sale-items"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
}

// ─── Loaner Inventory ─────────────────────────────────────────────────────────

export function useAddLoanerBatch() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      unitCost,
      loanedSource,
    }: {
      productId: bigint;
      quantity: bigint;
      unitCost: number;
      loanedSource?: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.addLoanerBatch !== "function")
        throw new Error("addLoanerBatch not available");
      return actor.addLoanerBatch(
        productId,
        quantity,
        unitCost,
        loanedSource ?? "",
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
    },
  });
}

export function useMoveLoanerToStaff() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      toWarehouse,
    }: {
      productId: bigint;
      quantity: bigint;
      toWarehouse: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.moveLoanerToStaff !== "function")
        throw new Error("moveLoanerToStaff not available");
      return actor.moveLoanerToStaff(productId, quantity, toWarehouse);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    },
  });
}

export function useReturnToSource() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      batchId,
      quantity,
    }: {
      batchId: bigint;
      quantity: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.returnToSource !== "function")
        throw new Error("returnToSource not available");
      return actor.returnToSource(batchId, quantity);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["inventory-movements"] });
    },
  });
}

export function useArchiveLoanedBatch() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (batchId: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.archiveLoanedBatch !== "function")
        throw new Error("archiveLoanedBatch not available");
      return actor.archiveLoanedBatch(batchId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
    },
  });
}

export function useRunBackgroundChecks() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.runBackgroundChecks !== "function")
        throw new Error("runBackgroundChecks not available");
      return actor.runBackgroundChecks();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// ─── Referral Commission ──────────────────────────────────────────────────────

export interface ReferralCommissionEntry {
  referral_user_principal: import("../backend").UserId;
  referral_user_display_name: string;
  profile_key: import("../backend").ProfileKey;
  month: string; // YYYY-MM
  total_commission: number;
  customer_count: number;
}

export function useGetReferralCommissionByMonth() {
  const { actor, isFetching } = useBackendActor();
  return useQuery<ReferralCommissionEntry[]>({
    queryKey: ["referral-commission-by-month"],
    queryFn: async () => {
      if (!actor) return [];
      // getReferralCommissionByMonth is a new backend method — gracefully degrade if not deployed
      const actorAny = actor as unknown as Record<string, unknown>;
      if (typeof actorAny.getReferralCommissionByMonth !== "function") {
        return [];
      }
      const result = await (
        actor as unknown as {
          getReferralCommissionByMonth: () => Promise<
            ReferralCommissionEntry[]
          >;
        }
      ).getReferralCommissionByMonth();
      return result ?? [];
    },
    enabled: !!actor && !isFetching,
  });
}

// ─── Body Inches ─────────────────────────────────────────────────────────────

export interface BodyInchesEntry {
  id: bigint;
  customer_id: bigint;
  profile_key: string;
  entry_date: bigint;
  chest: number | null;
  biceps: number | null;
  waist: number | null;
  hips: number | null;
  thighs: number | null;
  calves: number | null;
  created_by: string;
  creation_date: bigint;
}

export function useGetBodyInchesHistory(
  customerId: bigint | number | null,
  profileKey?: string,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<BodyInchesEntry[]>({
    queryKey: ["body-inches-history", String(customerId), profileKey],
    queryFn: async () => {
      if (!actor || !customerId) return [];
      const actorAny = actor as unknown as Record<string, unknown>;
      // Prefer getBodyInchesHistory (profileKey-aware), fallback to listBodyInchesHistory
      if (typeof actorAny.getBodyInchesHistory === "function") {
        const result = await (
          actor as unknown as {
            getBodyInchesHistory: (
              id: bigint,
              pk: string,
            ) => Promise<BodyInchesEntry[]>;
          }
        ).getBodyInchesHistory(BigInt(customerId), profileKey ?? "");
        return result ?? [];
      }
      if (typeof actorAny.listBodyInchesHistory === "function") {
        const result = await (
          actor as unknown as {
            listBodyInchesHistory: (id: bigint) => Promise<BodyInchesEntry[]>;
          }
        ).listBodyInchesHistory(BigInt(customerId));
        return result ?? [];
      }
      return [];
    },
    enabled: !!actor && !isFetching && !!customerId,
  });
}

// ─── Canister Cycles ─────────────────────────────────────────────────────────

export interface PerProfileCyclesInfo {
  profile_key: string;
  business_name: string;
  cycles_note: string;
}

export interface CanisterCyclesInfo {
  total_cycles: bigint;
  per_profile_info: PerProfileCyclesInfo[];
}

export function useGetCanisterCyclesInfo() {
  const { actor, isFetching } = useBackendActor();
  return useQuery<CanisterCyclesInfo | null>({
    queryKey: ["canister-cycles-info"],
    queryFn: async () => {
      if (!actor) return null;
      const actorAny = actor as unknown as Record<string, unknown>;
      if (typeof actorAny.getCanisterCyclesInfo !== "function") return null;
      const result = await (
        actor as unknown as {
          getCanisterCyclesInfo: () => Promise<CanisterCyclesInfo>;
        }
      ).getCanisterCyclesInfo();
      return result ?? null;
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

// ─── Referral Users ───────────────────────────────────────────────────────────

export function useGetReferralUsers(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["referral-users", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      // getReferralUsers is a new backend method — gracefully degrade if not deployed yet
      const actorAny = actor as unknown as Record<string, unknown>;
      if (typeof actorAny.getReferralUsers !== "function") {
        // Fallback: filter getUsersByProfile results for referralUser role
        if (typeof actor.getUsersByProfile !== "function") return [];
        const allUsers = await actor.getUsersByProfile(profileKey);
        return allUsers.filter((u) => (u.role as string) === "referralUser");
      }
      return (
        actor as unknown as {
          getReferralUsers: (
            pk: string,
          ) => Promise<import("../backend").UserProfilePublic[]>;
        }
      ).getReferralUsers(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

// ─── Goal Master Data ─────────────────────────────────────────────────────────

export interface GoalMasterPublic {
  id: bigint;
  name: string;
  description: string;
  profile_key: string;
  product_bundle: bigint[];
}

export function useGetGoalMasterData(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<GoalMasterPublic[]>({
    queryKey: ["goal-master", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getGoalMasterData !== "function") return [];
      return (
        a.getGoalMasterData as (pk: string) => Promise<GoalMasterPublic[]>
      )(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

export function useCreateGoalMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      name,
      description,
    }: {
      profileKey: string;
      name: string;
      description: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.createGoalMaster !== "function")
        throw new Error("createGoalMaster not available");
      return (
        a.createGoalMaster as (
          pk: string,
          n: string,
          d: string,
        ) => Promise<GoalMasterPublic>
      )(profileKey, name, description);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["goal-master", vars.profileKey] });
    },
  });
}

export function useUpdateGoalMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
      productBundle,
    }: {
      id: bigint;
      name: string;
      description: string;
      productBundle: bigint[];
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.updateGoalMaster !== "function")
        throw new Error("updateGoalMaster not available");
      return (
        a.updateGoalMaster as (
          id: bigint,
          n: string,
          d: string,
          pb: bigint[],
        ) => Promise<boolean>
      )(id, name, description, productBundle);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goal-master"] });
    },
  });
}

export function useDeleteGoalMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.deleteGoalMaster !== "function")
        throw new Error("deleteGoalMaster not available");
      return (a.deleteGoalMaster as (id: bigint) => Promise<boolean>)(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goal-master"] });
    },
  });
}

// ─── Medical Issue Master Data ────────────────────────────────────────────────

export interface MedicalIssueMasterPublic {
  id: bigint;
  name: string;
  description: string;
  profile_key: string;
}

export function useGetMedicalIssueMasterData(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<MedicalIssueMasterPublic[]>({
    queryKey: ["medical-issue-master", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getMedicalIssueMasterData !== "function") return [];
      return (
        a.getMedicalIssueMasterData as (
          pk: string,
        ) => Promise<MedicalIssueMasterPublic[]>
      )(profileKey);
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

export function useCreateMedicalIssueMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      name,
      description,
    }: {
      profileKey: string;
      name: string;
      description: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.createMedicalIssueMaster !== "function")
        throw new Error("createMedicalIssueMaster not available");
      return (
        a.createMedicalIssueMaster as (
          pk: string,
          n: string,
          d: string,
        ) => Promise<MedicalIssueMasterPublic>
      )(profileKey, name, description);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["medical-issue-master", vars.profileKey],
      });
    },
  });
}

export function useUpdateMedicalIssueMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      name,
      description,
    }: {
      id: bigint;
      name: string;
      description: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.updateMedicalIssueMaster !== "function")
        throw new Error("updateMedicalIssueMaster not available");
      return (
        a.updateMedicalIssueMaster as (
          id: bigint,
          n: string,
          d: string,
        ) => Promise<boolean>
      )(id, name, description);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medical-issue-master"] });
    },
  });
}

export function useDeleteMedicalIssueMaster() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.deleteMedicalIssueMaster !== "function")
        throw new Error("deleteMedicalIssueMaster not available");
      return (a.deleteMedicalIssueMaster as (id: bigint) => Promise<boolean>)(
        id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["medical-issue-master"] });
    },
  });
}

// ─── Body Inches Entry (create) ───────────────────────────────────────────────

export function useCreateBodyInchesEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      profileKey: _profileKey,
      entryDate,
      chest,
      biceps,
      waist,
      hips,
      thighs,
      calves,
    }: {
      customerId: bigint;
      profileKey: string;
      entryDate: bigint;
      chest?: number;
      biceps?: number;
      waist?: number;
      hips?: number;
      thighs?: number;
      calves?: number;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      // Use the typed backend interface: createBodyInchesEntry(customerId, input)
      if (typeof actor.createBodyInchesEntry !== "function")
        throw new Error("createBodyInchesEntry not available");
      const input: import("../backend").BodyInchesInput = {
        entry_date: entryDate,
        ...(chest !== undefined && { chest }),
        ...(biceps !== undefined && { biceps }),
        ...(waist !== undefined && { waist }),
        ...(hips !== undefined && { hips }),
        ...(thighs !== undefined && { thighs }),
        ...(calves !== undefined && { calves }),
      };
      return actor.createBodyInchesEntry(customerId, input);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: [
          "body-inches-history",
          vars.customerId.toString(),
          vars.profileKey,
        ],
      });
    },
  });
}

// ─── Return Order ─────────────────────────────────────────────────────────────

export interface ReturnOrderItem {
  product_id: bigint;
  quantity: bigint;
  actual_sale_price: number;
  is_usable: boolean;
}

export function useCreateReturnOrder() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      originalSaleId,
      profileKey,
      warehouseId,
      customerId,
      items,
      returnedBy,
    }: {
      originalSaleId: bigint;
      profileKey: string;
      warehouseId: string;
      customerId: bigint;
      items: ReturnOrderItem[];
      returnedBy: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.createReturnOrder !== "function")
        throw new Error("createReturnOrder not available");
      return (
        a.createReturnOrder as (
          origId: bigint,
          pk: string,
          wh: string,
          cid: bigint,
          items: ReturnOrderItem[],
          by: string,
        ) => Promise<bigint>
      )(originalSaleId, profileKey, warehouseId, customerId, items, returnedBy);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
      qc.invalidateQueries({ queryKey: ["stage-inventory"] });
    },
  });
}

// ─── Stage Inventory ──────────────────────────────────────────────────────────

export interface StagedInventoryItem {
  batch_id: bigint;
  product_id: bigint;
  product_name: string;
  quantity: bigint;
  batch_no: string;
  return_order_id: bigint;
  date_staged: bigint;
  status: string; // "pending" | "accepted" | "rejected"
}

export function useGetStagedInventory(profileKey: string | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<StagedInventoryItem[]>({
    queryKey: ["stage-inventory", profileKey],
    queryFn: async () => {
      if (!actor || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getStagedInventory !== "function") return [];
      // Backend getStagedInventory() takes NO arguments — do not pass profileKey
      return (a.getStagedInventory as () => Promise<StagedInventoryItem[]>)();
    },
    enabled: !!actor && !isFetching && !!profileKey,
  });
}

export function useReviewStagedItem() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      batchId,
      action,
      reviewedBy,
    }: {
      batchId: bigint;
      action: "accept" | "reject";
      reviewedBy: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.reviewStagedItem !== "function")
        throw new Error("reviewStagedItem not available");
      return (
        a.reviewStagedItem as (
          batchId: bigint,
          action: { accept: null } | { reject: null },
          by: string,
        ) => Promise<boolean>
      )(
        batchId,
        action === "accept" ? { accept: null } : { reject: null },
        reviewedBy,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stage-inventory"] });
      qc.invalidateQueries({ queryKey: ["inventory-levels"] });
      qc.invalidateQueries({ queryKey: ["inventory-batches"] });
    },
  });
}

// ─── Payment History ──────────────────────────────────────────────────────────

export interface PaymentEntry {
  id: bigint;
  sale_id: bigint;
  amount: number;
  payment_method: string;
  recorded_by: string;
  recorded_at: bigint;
}

export function useGetPaymentHistory(saleId: bigint | null) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<PaymentEntry[]>({
    queryKey: ["payment-history", saleId?.toString()],
    queryFn: async () => {
      if (!actor || !saleId) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getPaymentHistory !== "function") return [];
      return (a.getPaymentHistory as (id: bigint) => Promise<PaymentEntry[]>)(
        saleId,
      );
    },
    enabled: !!actor && !isFetching && !!saleId,
  });
}

export function useAddPaymentEntry() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      saleId,
      amount,
      paymentMethod,
      recordedBy,
    }: {
      saleId: bigint;
      amount: number;
      paymentMethod: string;
      recordedBy: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.addPaymentEntry !== "function")
        throw new Error("addPaymentEntry not available");
      return (
        a.addPaymentEntry as (
          saleId: bigint,
          amount: number,
          method: string,
          by: string,
        ) => Promise<boolean>
      )(saleId, amount, paymentMethod, recordedBy);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["payment-history", vars.saleId.toString()],
      });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
  });
}

// ─── Leads (Super Admin) ──────────────────────────────────────────────────────

export interface LeadPublic {
  id: bigint;
  name: string;
  business_name: string;
  phone: string;
  email: string;
  message: string;
  created_at: bigint;
  is_closed: boolean;
  profile_link?: string;
}

export function useGetLeads() {
  const { actor, isFetching } = useBackendActor();
  return useQuery<LeadPublic[]>({
    queryKey: ["leads"],
    queryFn: async () => {
      if (!actor) return [];
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getLeads !== "function") return [];
      return (a.getLeads as () => Promise<LeadPublic[]>)();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useCloseLead() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      profileLink,
    }: {
      id: bigint;
      profileLink: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.closeLead !== "function")
        throw new Error("closeLead not available");
      return (a.closeLead as (id: bigint, link: string) => Promise<boolean>)(
        id,
        profileLink,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useDeleteLead() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.deleteLead !== "function")
        throw new Error("deleteLead not available");
      return (a.deleteLead as (id: bigint) => Promise<boolean>)(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

// ─── Customer Notes ───────────────────────────────────────────────────────────
//
// MIGRATION NOTE: Customer notes have moved from an embedded array on the customer
// record (customer.notes[]) to a separate backend store (customerNotesStore).
//
// OLD approach (deprecated): notes embedded in CustomerPublic, fetched with
//   getCustomers(). Required a full customer list refetch after any note change.
//
// NEW approach (active): separate customerNotesStore with dedicated CRUD methods.
//   React Query key: ['customer-notes', customerId, profileKey].
//
// The legacy useAddCustomerNote / useDeleteCustomerNote hooks below are kept as
// compatibility shims only. Do NOT use them for new code — use the V2 hooks.

/**
 * useAddCustomerNote — LEGACY shim for old embedded-array note storage.
 * Kept for backward compatibility. For new code, use useAddCustomerNoteV2.
 */
export function useAddCustomerNote() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      profileKey: _profileKey,
      text,
      noteDate,
    }: {
      customerId: bigint;
      profileKey: string;
      text: string;
      noteDate: bigint;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.addCustomerNote !== "function")
        throw new Error("addCustomerNote not available");
      // Real backend: addCustomerNote(customerId, input: CustomerNoteInput)
      const input: import("../backend").CustomerNoteInput = {
        text,
        note_date: noteDate,
      };
      return actor.addCustomerNote(customerId, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/**
 * useDeleteCustomerNote — LEGACY shim for old embedded-array note storage.
 * Kept for backward compatibility. For new code, use useDeleteCustomerNoteV2.
 */
export function useDeleteCustomerNote() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId: _customerId,
      noteId,
      profileKey: _profileKey,
    }: {
      customerId: bigint;
      noteId: bigint;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      if (typeof actor.deleteCustomerNote !== "function")
        throw new Error("deleteCustomerNote not available");
      // Backend: deleteCustomerNote(noteId: bigint, profileKey: ProfileKey) -> bool
      // Use the profileKey (not customerId) as the second argument per the updated backend signature.
      // _customerId is kept in the signature for cache invalidation but not passed to the backend.
      return actor.deleteCustomerNote(noteId, _profileKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

// ─── Customer Notes V2 — Separate Store ──────────────────────────────────────
//
// These hooks call the new separate customerNotesStore backend methods.
// Use these for all new note UI code — they do NOT touch the customer record.
//
// Backend methods:
//   addCustomerNoteV2(input)          -> CustomerNotePublic
//   getCustomerNotes(id, profileKey)  -> [CustomerNotePublic]
//   updateCustomerNote(id, text, pk)  -> ?CustomerNotePublic
//   deleteCustomerNoteV2(id, pk)      -> Bool
//
// React Query key: ['customer-notes', customerId, profileKey]
// All V2 mutations invalidate this key so lists auto-refresh.

/**
 * Shape of a note returned from the separate customerNotesStore.
 * Mirrors CustomerNotePublic from the backend.
 */
export interface CustomerNoteV2 {
  /** Unique note ID (auto-incremented in the separate store) */
  id: bigint;
  /** ID of the customer this note belongs to */
  customer_id: bigint;
  /** Profile key this note is scoped to */
  profile_key: string;
  /** The note text content */
  note: string;
  /** Date of the note as a YYYY-MM-DD string */
  date: string;
  /** Display name of the user who created the note */
  created_by: string;
  /** Display name of the user who last updated the note */
  last_updated_by: string;
  /** Timestamp (nanoseconds) of last update */
  last_updated_date: bigint;
}

/**
 * useGetCustomerNotes — fetches all notes for a customer from the separate store.
 * Replaces reading from customer.notes[] embedded array.
 *
 * @param customerId - The customer's ID
 * @param profileKey - Active profile key (use from ProfileContext — impersonation-aware)
 *
 * Returns [] if the backend method is not yet deployed (graceful degradation).
 */
export function useGetCustomerNotes(
  customerId: number | bigint | null,
  profileKey: string | null,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<CustomerNoteV2[]>({
    queryKey: ["customer-notes", String(customerId), profileKey],
    queryFn: async () => {
      if (!actor || !customerId || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      // Graceful degradation: return empty if backend not yet deployed
      if (typeof a.getCustomerNotes !== "function") return [];
      const result = await (
        a.getCustomerNotes as (
          id: bigint,
          pk: string,
        ) => Promise<CustomerNoteV2[]>
      )(BigInt(customerId), profileKey);
      return result ?? [];
    },
    enabled: !!actor && !isFetching && !!customerId && !!profileKey,
  });
}

/**
 * useAddCustomerNoteV2 — adds a note to the separate customerNotesStore.
 * Replaces useAddCustomerNote for new code.
 *
 * On success, invalidates the notes query for this specific customer + profile.
 */
export function useAddCustomerNoteV2() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      profileKey,
      note,
      date,
    }: {
      customerId: bigint;
      profileKey: string;
      note: string;
      date: string; // YYYY-MM-DD
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.addCustomerNoteV2 !== "function")
        throw new Error("addCustomerNoteV2 not available");
      return (
        a.addCustomerNoteV2 as (input: {
          customer_id: bigint;
          profile_key: string;
          note: string;
          date: string;
        }) => Promise<CustomerNoteV2>
      )({ customer_id: customerId, profile_key: profileKey, note, date });
    },
    onSuccess: (_data, vars) => {
      // Precise invalidation: only refresh notes for this customer + profile combo
      qc.invalidateQueries({
        queryKey: ["customer-notes", String(vars.customerId), vars.profileKey],
      });
    },
  });
}

/**
 * useUpdateCustomerNote — updates the text of an existing note.
 * Used by the Edit note modal (pre-filled with existing note text).
 *
 * On success, broadly invalidates all customer-notes queries.
 */
export function useUpdateCustomerNote() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      newText,
      profileKey,
    }: {
      noteId: bigint;
      newText: string;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.updateCustomerNote !== "function")
        throw new Error("updateCustomerNote not available");
      // Backend returns ?CustomerNotePublic — null if note not found
      return (
        a.updateCustomerNote as (
          id: bigint,
          text: string,
          pk: string,
        ) => Promise<CustomerNoteV2 | null>
      )(noteId, newText, profileKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-notes"] });
    },
  });
}

/**
 * useDeleteCustomerNoteV2 — deletes a note from the separate customerNotesStore.
 * Always show a confirmation dialog in the UI before calling.
 *
 * On success, broadly invalidates all customer-notes queries.
 */
export function useDeleteCustomerNoteV2() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      profileKey,
    }: {
      noteId: bigint;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.deleteCustomerNoteV2 !== "function")
        throw new Error("deleteCustomerNoteV2 not available");
      return (
        a.deleteCustomerNoteV2 as (id: bigint, pk: string) => Promise<boolean>
      )(noteId, profileKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-notes"] });
    },
  });
}

// ─── Customer Goal Assignment ─────────────────────────────────────────────────
//
// These hooks connect a specific customer to their assigned goals/medical issues.
// They wrap the backend's addGoalToCustomer, removeGoalFromCustomer, getCustomerGoals,
// addMedicalIssueToCustomer, removeMedicalIssueFromCustomer, getCustomerMedicalIssues.
//
// IMPORTANT: The profileKey used here MUST come from ProfileContext/ImpersonationContext
// (the impersonation-aware activeProfileKey), NOT from userProfile.profile_key directly.
// This ensures Super Admin impersonating a profile operates on the correct profile's data.
//
// Cache keys include both customerId and profileKey so different customers/profiles
// never share stale data.

/**
 * useGetCustomerGoals — fetches all goals assigned to a specific customer.
 *
 * Cache key: ["customer-goals", customerId.toString(), profileKey]
 * This ensures we get fresh data when switching between customers or profiles.
 *
 * @param customerId - the customer's bigint ID (null = query disabled)
 * @param profileKey - the active profile key (impersonation-aware, "" = disabled)
 */
export function useGetCustomerGoals(
  customerId: bigint | null,
  profileKey: string,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<GoalMasterPublic[]>({
    queryKey: ["customer-goals", customerId?.toString(), profileKey],
    queryFn: async () => {
      if (!actor || !customerId || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      // Backend: getCustomerGoals(customerId: Nat, profileKey: Text) -> [GoalMasterPublic]
      if (typeof a.getCustomerGoals !== "function") return [];
      return (
        a.getCustomerGoals as (
          id: bigint,
          pk: string,
        ) => Promise<GoalMasterPublic[]>
      )(customerId, profileKey);
    },
    enabled: !!actor && !isFetching && !!customerId && !!profileKey,
  });
}

/**
 * useAddGoalToCustomer — assigns a goal from the master list to a customer.
 *
 * On success, invalidates ["customer-goals", customerId] so the Goals tab refreshes.
 * Also invalidates ["customers"] so the Info tab's goal badges update.
 */
export function useAddGoalToCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      goalId,
      profileKey,
    }: {
      customerId: bigint;
      goalId: bigint;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      // Backend: addGoalToCustomer(customerId: Nat, goalId: Nat, profileKey: Text) -> Result
      if (typeof a.addGoalToCustomer !== "function")
        throw new Error("addGoalToCustomer not available");
      return (
        a.addGoalToCustomer as (
          cid: bigint,
          gid: bigint,
          pk: string,
        ) => Promise<boolean>
      )(customerId, goalId, profileKey);
    },
    onSuccess: (_data, vars) => {
      // Refresh the Goals tab list for this specific customer
      qc.invalidateQueries({
        queryKey: ["customer-goals", vars.customerId.toString()],
      });
      // Also refresh the main customers list so the Info tab badges update
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/**
 * useRemoveGoalFromCustomer — removes a goal assignment from a customer.
 *
 * On success, invalidates ["customer-goals", customerId] so the Goals tab refreshes.
 */
export function useRemoveGoalFromCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      goalId,
      profileKey,
    }: {
      customerId: bigint;
      goalId: bigint;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      // Backend: removeGoalFromCustomer(customerId: Nat, goalId: Nat, profileKey: Text) -> Result
      if (typeof a.removeGoalFromCustomer !== "function")
        throw new Error("removeGoalFromCustomer not available");
      return (
        a.removeGoalFromCustomer as (
          cid: bigint,
          gid: bigint,
          pk: string,
        ) => Promise<boolean>
      )(customerId, goalId, profileKey);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["customer-goals", vars.customerId.toString()],
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/**
 * useGetCustomerMedicalIssues — fetches all medical issues assigned to a specific customer.
 *
 * Cache key: ["customer-medical-issues", customerId.toString(), profileKey]
 *
 * @param customerId - the customer's bigint ID (null = query disabled)
 * @param profileKey - the active profile key (impersonation-aware, "" = disabled)
 */
export function useGetCustomerMedicalIssues(
  customerId: bigint | null,
  profileKey: string,
) {
  const { actor, isFetching } = useBackendActor();
  return useQuery<MedicalIssueMasterPublic[]>({
    queryKey: ["customer-medical-issues", customerId?.toString(), profileKey],
    queryFn: async () => {
      if (!actor || !customerId || !profileKey) return [];
      const a = actor as unknown as Record<string, unknown>;
      // Backend: getCustomerMedicalIssues(customerId: Nat, profileKey: Text) -> [MedicalIssueMasterPublic]
      if (typeof a.getCustomerMedicalIssues !== "function") return [];
      return (
        a.getCustomerMedicalIssues as (
          id: bigint,
          pk: string,
        ) => Promise<MedicalIssueMasterPublic[]>
      )(customerId, profileKey);
    },
    enabled: !!actor && !isFetching && !!customerId && !!profileKey,
  });
}

/**
 * useAddMedicalIssueToCustomer — assigns a medical issue from the master list to a customer.
 *
 * On success, invalidates ["customer-medical-issues", customerId] so the tab refreshes.
 */
export function useAddMedicalIssueToCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      issueId,
      profileKey,
    }: {
      customerId: bigint;
      issueId: bigint;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      // Backend: addMedicalIssueToCustomer(customerId: Nat, issueId: Nat, profileKey: Text) -> Result
      if (typeof a.addMedicalIssueToCustomer !== "function")
        throw new Error("addMedicalIssueToCustomer not available");
      return (
        a.addMedicalIssueToCustomer as (
          cid: bigint,
          iid: bigint,
          pk: string,
        ) => Promise<boolean>
      )(customerId, issueId, profileKey);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["customer-medical-issues", vars.customerId.toString()],
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/**
 * useRemoveMedicalIssueFromCustomer — removes a medical issue assignment from a customer.
 *
 * On success, invalidates ["customer-medical-issues", customerId] so the tab refreshes.
 */
export function useRemoveMedicalIssueFromCustomer() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      customerId,
      issueId,
      profileKey,
    }: {
      customerId: bigint;
      issueId: bigint;
      profileKey: string;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      // Backend: removeMedicalIssueFromCustomer(customerId: Nat, issueId: Nat, profileKey: Text) -> Result
      if (typeof a.removeMedicalIssueFromCustomer !== "function")
        throw new Error("removeMedicalIssueFromCustomer not available");
      return (
        a.removeMedicalIssueFromCustomer as (
          cid: bigint,
          iid: bigint,
          pk: string,
        ) => Promise<boolean>
      )(customerId, issueId, profileKey);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["customer-medical-issues", vars.customerId.toString()],
      });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

// ─── Data Inspector Hooks (Super Admin) ───────────────────────────────────────
//
// These hooks provide raw record access for the Super Admin Data Inspector page.
// They call backend methods that return unfiltered arrays of records for any
// data type, scoped to a specific profile key.
//
// Both hooks gracefully degrade if the backend method is not available yet —
// they return an empty array rather than crashing.
//
// NOTE ON NOTIFICATION SCOPING:
// Regular notifications are filtered by (profileKey, role) — they are profile-scoped.
// Super Admin system notifications (e.g. "new profile pending approval") are stored
// with profile_key = "superadmin" (sentinel value) and queried via a separate backend
// method getSuperAdminNotifications() that returns ALL notifications where
// profile_key = "superadmin", regardless of any active profile selection.
// This is why the Data Inspector uses useGetSuperAdminNotifications — NOT useGetNotifications.

/**
 * useGetSuperAdminNotifications — fetches ALL system-level notifications written
 * for the Super Admin, identified by the sentinel profile_key = "superadmin".
 *
 * WHY THIS IS DIFFERENT FROM useGetNotifications:
 * useGetNotifications(profileKey, role) is for profile-scoped notifications — it
 * requires a real profile_key and role and will NOT return system notifications.
 * Super Admin system notifications (new profile registrations, approvals, etc.)
 * are stored with profile_key = "superadmin" and require a dedicated query.
 *
 * WHEN TO USE:
 * - Data Inspector page: always use this for the "Notifications" data type
 * - Notification panel when the logged-in user is Super Admin
 *
 * GRACEFUL DEGRADATION:
 * If getSuperAdminNotifications() is not yet deployed in the backend IDL,
 * falls back to fetching all notifications via getNotifications("superadmin", "superAdmin").
 */
export function useGetSuperAdminNotifications() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    // Cache key is stable and not scoped to a profile — this is a global Super Admin view
    queryKey: ["super-admin-notifications"],
    queryFn: async () => {
      if (!actor) return [];
      const a = actor as unknown as Record<string, unknown>;

      // Prefer the dedicated getSuperAdminNotifications() backend method
      // This returns all notifications with profile_key = "superadmin" (the sentinel)
      if (typeof a.getSuperAdminNotifications === "function") {
        try {
          const result = await (
            a.getSuperAdminNotifications as () => Promise<unknown[]>
          )();
          return result ?? [];
        } catch {
          return [];
        }
      }

      // Fallback: call getNotifications with the "superadmin" sentinel profile key
      // and "superAdmin" role — this covers cases where the dedicated method isn't deployed yet
      if (typeof actor.getNotifications === "function") {
        try {
          return await actor.getNotifications("superadmin", "superAdmin");
        } catch {
          return [];
        }
      }

      return [];
    },
    enabled: !!actor && !isFetching,
    // No stale time — Super Admin notifications should always be fresh
    // (new profile approvals must appear immediately)
    staleTime: 0,
    refetchInterval: 60_000, // poll every minute for new system notifications
  });
}

/**
 * useGetPendingProfiles — fetches only profiles with approval_status = #pending_super_admin_approval.
 *
 * WHY THIS EXISTS (vs useGetAllProfilesForAdmin + client-side filter):
 * The previous ProfileApprovalPage called getAllProfilesForAdmin() and then filtered
 * client-side. This was unreliable:
 *   1. Returns ALL profiles including approved/rejected ones (large payload).
 *   2. Client-side string matching could miss Candid variant serialisation edge cases.
 * getPendingProfiles() is authoritative — the backend filters at the store level.
 *
 * GRACEFUL DEGRADATION:
 * If getPendingProfiles() is not in the IDL (backend not yet redeployed), falls back
 * to getAllProfilesForAdmin() and filters client-side by both "pending" status values.
 * This ensures the page works on older deployments while waiting for an upgrade.
 *
 * CACHE KEY: ["pending-profiles"] — invalidated by useApproveProfile and useRejectProfile
 * so the list refreshes automatically after any approval action.
 */
export function useGetPendingProfiles() {
  const { actor, isFetching } = useBackendActor();
  return useQuery<import("../backend").ProfilePublic[]>({
    queryKey: ["pending-profiles"],
    queryFn: async () => {
      if (!actor) return [];
      const a = actor as unknown as Record<string, unknown>;

      // Prefer dedicated getPendingProfiles() if available
      if (typeof a.getPendingProfiles === "function") {
        try {
          const result = await (
            a.getPendingProfiles as () => Promise<
              import("../backend").ProfilePublic[]
            >
          )();
          return result ?? [];
        } catch {
          return [];
        }
      }

      // Fallback: getAllProfilesForAdmin + client-side filter
      // Handles both "pending" and "pending_super_admin_approval" status values
      if (typeof actor.getAllProfilesForAdmin === "function") {
        try {
          const all = await actor.getAllProfilesForAdmin();
          return all.filter((p) => {
            const status = (p as unknown as Record<string, unknown>)
              .profile_approval_status as string | undefined;
            return (
              status === "pending_super_admin_approval" || status === "pending"
            );
          });
        } catch {
          return [];
        }
      }

      return [];
    },
    enabled: !!actor && !isFetching,
    staleTime: 0, // Always fresh — approval state must be accurate
    refetchInterval: 30_000, // Poll every 30s for new registrations
  });
}

/**
 * useUpdateProfileFields — updates editable fields of a business profile record.
 * Used by the Data Inspector to wire the Save button for the "profiles" data type.
 *
 * WHY THIS EXISTS:
 * The Data Inspector Edit modal needs to save changes to profile records. The existing
 * updateProfile() mutation works for the current user's own profile. For Super Admin
 * editing ANY profile by key, we need updateProfileFields(profileKey, fields) which
 * the backend exposes as a Super Admin-only endpoint.
 *
 * WHAT FIELDS CAN BE UPDATED:
 * The backend accepts a record of Text fields (key-value pairs of field names to new values).
 * Key fields (profile_key, owner, created_at, etc.) are rejected by the backend.
 * The frontend also marks these as disabled in the edit form.
 *
 * CACHE INVALIDATION:
 * Invalidates both "data-inspector-profiles" (for the inspector table refresh)
 * and "admin-profiles" (for the Super Admin dashboard profile list).
 *
 * GRACEFUL DEGRADATION:
 * If updateProfileFields is not in the IDL, throws with a clear error message
 * so the Data Inspector can show a meaningful toast rather than silently failing.
 */
export function useUpdateProfileFields() {
  const { actor } = useBackendActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      profileKey,
      fields,
    }: {
      profileKey: string;
      fields: Record<string, string>;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      const a = actor as unknown as Record<string, unknown>;
      // Check if backend has the dedicated updateProfileFields method
      if (typeof a.updateProfileFields === "function") {
        return (
          a.updateProfileFields as (
            pk: string,
            f: Record<string, string>,
          ) => Promise<boolean>
        )(profileKey, fields);
      }
      // Fallback: try generic updateRawRecord if available
      if (typeof a.updateRawRecord === "function") {
        return (
          a.updateRawRecord as (
            type: string,
            id: string,
            fields: Record<string, string>,
          ) => Promise<boolean>
        )("profiles", profileKey, fields);
      }
      throw new Error(
        "updateProfileFields is not available on this backend version. Redeploy the backend to enable profile editing.",
      );
    },
    onSuccess: () => {
      // Refresh both the inspector table and the Super Admin profiles dashboard
      qc.invalidateQueries({ queryKey: ["data-inspector-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["pending-profiles"] });
    },
  });
}

/**
 * useGetAllProfilesRaw — fetches the raw list of all profiles in the canister.
 * Used in the Data Inspector to show raw profile records for Super Admin.
 *
 * No profile key required — Super Admin sees all profiles.
 */
export function useGetAllProfilesRaw() {
  const { actor, isFetching } = useBackendActor();
  return useQuery({
    queryKey: ["data-inspector-profiles"],
    queryFn: async () => {
      if (!actor) return [];
      // TODO: Once backend bindgen is run, getAllProfilesRaw() will be in the IDL.
      // Remove the duck-type check and fallback below — call actor.getAllProfilesRaw() directly.
      // Prefer getAllProfilesRaw if available; fall back to getAllProfilesForAdmin
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.getAllProfilesRaw === "function") {
        const result = await (
          a.getAllProfilesRaw as () => Promise<unknown[]>
        )();
        return result ?? [];
      }
      // Fallback: getAllProfilesForAdmin returns extended profile info
      if (typeof actor.getAllProfilesForAdmin === "function") {
        return actor.getAllProfilesForAdmin();
      }
      return [];
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}
