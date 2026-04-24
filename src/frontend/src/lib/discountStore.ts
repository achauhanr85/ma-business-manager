/**
 * discountStore.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Temporary local bridge for storing customer discount preferences
 * until the backend schema is updated to persist discount fields natively.
 *
 * DRY-RUN NOTE:
 *  - Data is stored in localStorage keyed by customer ID.
 *  - On backend schema update, this can be replaced by reading discount fields
 *    directly from the CustomerPublic response without any UI changes.
 */

import type { DiscountType } from "@/types";

export interface StoredDiscountData {
  discount_applicable?: DiscountType;
  discount_value?: number;
  notes?: string;
}

const DISCOUNT_STORE_KEY = "customer_discounts_v1";

function readStore(): Record<string, StoredDiscountData> {
  try {
    const raw = localStorage.getItem(DISCOUNT_STORE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredDiscountData>;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, StoredDiscountData>): void {
  try {
    localStorage.setItem(DISCOUNT_STORE_KEY, JSON.stringify(store));
  } catch {
    // silently ignore storage errors
  }
}

/** Read stored discount data for a customer (by string ID). */
export function getStoredCustomerDiscount(id: string): StoredDiscountData {
  return readStore()[id] ?? {};
}

/** Persist discount data for a customer (by string ID). */
export function saveStoredCustomerDiscount(
  id: string,
  data: StoredDiscountData,
): void {
  const store = readStore();
  store[id] = data;
  writeStore(store);
}

/** Remove stored discount data for a deleted customer. */
export function clearStoredCustomerDiscount(id: string): void {
  const store = readStore();
  delete store[id];
  writeStore(store);
}

/**
 * Calculate the discount amount from a subtotal.
 *
 * Dry-run: Discount/Order Edit Collision scenario
 *  - Customer has 10% discount, adds $100 item → subtotal = $100.
 *  - discountAmount = 10/100 * 100 = $10. finalTotal = $90.
 *  - If order is later edited (item removed + new item added), this function is
 *    called again with the new subtotal, producing the correct new discount.
 */
export function calcDiscount(
  subtotal: number,
  discountType?: DiscountType,
  discountValue?: number,
): { discountAmount: number; finalTotal: number } {
  const val = discountValue ?? 0;
  let discountAmount = 0;
  if (discountType === "Percentage") {
    discountAmount = (val / 100) * subtotal;
  } else if (discountType === "Fixed") {
    discountAmount = Math.min(val, subtotal);
  }
  return { discountAmount, finalTotal: subtotal - discountAmount };
}
