/**
 * routes.ts — Central route path constants for the entire application.
 *
 * WHY THIS FILE EXISTS:
 * Route strings like "/dashboard" or "/customer-goals" were scattered as raw
 * string literals throughout App.tsx, Sidebar.tsx, and Header.tsx. If a route
 * ever needs to change, you'd have to hunt for every occurrence. This file
 * defines them ONCE so every other file imports from here instead.
 *
 * HOW TO USE:
 *   import { ROUTES } from "@/lib/routes";
 *   navigate(ROUTES.dashboard);   // instead of navigate("/dashboard")
 *
 * WHO IMPORTS THIS:
 *   App.tsx — for the page-rendering switch statement
 *   Sidebar.tsx — for nav item path definitions
 *   Header.tsx — for quick-action icon navigation targets
 */

/** All application route path strings, defined in one place */
export const ROUTES = {
  // ── Public ──────────────────────────────────────────────────────────────────
  /** Public marketing/landing page — no login required */
  index: "/",

  // ── Main ────────────────────────────────────────────────────────────────────
  /** Main dashboard — first page after login for Admin/Staff */
  dashboard: "/dashboard",
  /** Business profile settings (name, logo, Instagram, etc.) */
  profile: "/profile",

  // ── Sales ───────────────────────────────────────────────────────────────────
  /** New sale / cart page */
  sales: "/sales",
  /** Purchase orders list and creation */
  purchaseOrders: "/purchase-orders",
  /** Vendor management (suppliers for purchase orders) */
  vendors: "/vendors",
  /** View receipt for a completed sale */
  receipt: "/receipt",

  // ── Customers ───────────────────────────────────────────────────────────────
  /** Customer list, create, edit */
  customers: "/customers",
  /** Master list of primary goals that can be assigned to customers */
  customerGoals: "/customer-goals",
  /** Master list of medical issues that can be assigned to customers */
  customerMedicalIssues: "/customer-medical-issues",

  // ── Inventory ───────────────────────────────────────────────────────────────
  /** Inventory levels across all warehouses */
  inventory: "/inventory",
  /** Move stock between warehouses */
  inventoryMovement: "/inventory-movement",
  /** Loaner / friend inventory — items borrowed from external sources */
  loanerInventory: "/loaner-inventory",
  /** Stage inventory — returned items pending Admin review */
  stageInventory: "/stage-inventory",

  // ── Catalog ─────────────────────────────────────────────────────────────────
  /** Product and category management */
  products: "/products",
  /**
   * Category management — categories live on the products page as a tab.
   * Navigating to this route opens /products with the categories tab pre-selected
   * via the URL query param ?tab=categories.
   */
  categories: "/products?tab=categories",
  /** Sales analytics, KPI charts, referral commission */
  analytics: "/analytics",

  // ── Admin ───────────────────────────────────────────────────────────────────
  /** Team member list, role assignment, module access control */
  userManagement: "/user-management",
  /** Language, theme, date format preferences */
  userPreferences: "/user-preferences",

  // ── Super Admin only ─────────────────────────────────────────────────────────
  /** Super Admin dashboard — profile governance, impersonation */
  superAdmin: "/super-admin",
  /** Automated regression test suite (Super Admin only) */
  adminTests: "/admin/tests",
  /** Raw backend data browser (Super Admin only) */
  dataInspector: "/data-inspector",
  /** Profile approval queue — Super Admin approves or rejects new profiles */
  profileApprovals: "/profile-approvals",
} as const;

/** Union type of all valid route path strings */
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
