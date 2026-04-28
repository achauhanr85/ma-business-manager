export interface HelpTopic {
  id: string;
  title: string;
  content: string;
  pageKey: string;
  navigationLink?: string;
}

export const helpContent: Record<string, HelpTopic[]> = {
  dashboard: [
    {
      id: "dashboard-overview",
      title: "Dashboard Overview",
      pageKey: "dashboard",
      navigationLink: "/dashboard",
      content: `The Dashboard is your business command center. It shows real-time key performance indicators (KPIs) for your current business profile.

**What you see here:**
- **Total Sales** — Count of all completed sales for your profile
- **Total Revenue** — Sum of all sale totals
- **Total Profit** — Revenue minus cost of goods sold
- **Inventory Value** — Current value of all stock on hand

**Recent Sales** — A list of the most recent transactions, so you can quickly spot any issues.

**Monthly Sales Trend** — A chart showing how your revenue has grown month by month.

**Tips:**
- If you're an Admin, use the Staff filter dropdown to see sales by a specific team member.
- Click "View All" on Recent Sales to go to the full Sales list.`,
    },
    {
      id: "dashboard-kpi",
      title: "Understanding KPI Cards",
      pageKey: "dashboard",
      navigationLink: "/dashboard",
      content: `Each KPI card shows a summary metric for your business.

**Total Sales** — Number of completed sale orders. Returns are excluded.

**Total Revenue** — The actual amount collected from customers (after discounts). This is what matters for cash flow.

**Total Profit** — Revenue minus the unit cost of goods sold. This is tracked internally for Admin visibility.

**Inventory Value** — The total cost value of all unsold stock across your assigned warehouse.

**How to improve your numbers:**
- Increase revenue by upselling or adding new products.
- Improve profit by negotiating better purchase prices.
- Keep inventory lean by reviewing slow-moving items regularly.`,
    },
    {
      id: "dashboard-chart",
      title: "Monthly Sales Trend Chart",
      pageKey: "dashboard",
      navigationLink: "/dashboard",
      content: `The Monthly Sales Trend chart displays your revenue over the past several months.

**Reading the chart:**
- The X-axis shows months (abbreviated).
- The Y-axis shows total revenue in your currency.
- Hover over any bar to see the exact figure for that month.

**What to watch for:**
- A consistent upward trend is a healthy sign.
- A sudden drop may indicate a stock-out, seasonal dip, or a missed follow-up with customers.
- Compare month-over-month to identify peak selling periods.

The chart is updated in real time whenever a new sale is confirmed.`,
    },
  ],

  sales: [
    {
      id: "sales-create",
      title: "Creating a New Sale",
      pageKey: "sales",
      navigationLink: "/sales",
      content: `The Sales screen lets you build and confirm a sale order for a customer.

**Step-by-step process:**
1. Click **New Sale** from the navigation.
2. **Select a Customer** — Search by name or phone. If the customer doesn't exist yet, click "Add Customer" to create one quickly.
3. **Add Products** — Search or browse products. Click a product to add it to the cart. Adjust quantity as needed.
4. **Review the Cart** — The cart on the right shows item totals and applies the customer's default discount automatically.
5. **Enter Payment Details** — Select Payment Mode (Cash/Card/UPI/Bank Transfer) and Payment Status (Paid/Unpaid/Partial). If Partial, enter the amount paid and optionally a due date.
6. **Add a Sale Note** — Optionally type a note that will appear on the receipt and in the WhatsApp message.
7. Click **Confirm Sale** to complete the order.

After confirming, you can print the receipt or share it via WhatsApp.`,
    },
    {
      id: "sales-copy-order",
      title: "Copying from a Previous Order",
      pageKey: "sales",
      navigationLink: "/sales",
      content: `If a customer typically orders the same items, you can pre-fill the cart with their last order.

**How to do it:**
1. Select the customer first.
2. Click the **Copy from Previous Order** button in the cart area.
3. The cart will be populated with the items and sale note from their most recent order.
4. Adjust quantities or prices as needed before confirming.

This is especially useful for repeat customers with regular orders, saving time on data entry.`,
    },
    {
      id: "sales-return",
      title: "Return Orders",
      pageKey: "sales",
      navigationLink: "/sales",
      content: `If a customer returns an item, you can process a Return Order linked to the original sale.

**How returns work:**
1. From the Sales list, find the original sale and open it.
2. Click **Create Return** (or set Order Type to "Return").
3. The system links the return to the original order number.
4. If the returned item is **usable**, it is added back to your inventory.
5. If the item is **not usable** (damaged/expired), it is written off — no inventory change.

**Note:** Returns are labeled clearly in the sales list. Payment adjustments (refunds) need to be handled separately based on your policy.`,
    },
    {
      id: "sales-payment",
      title: "Managing Payment Status",
      pageKey: "sales",
      navigationLink: "/sales",
      content: `You can track and update payment status directly from the Sales list without opening the full order.

**Quick status update from the list:**
1. Go to the Sales list page.
2. Find the sale you want to update.
3. Click the payment status badge or the quick-edit icon.
4. Select the new status (Paid / Partial / Unpaid) and save.

**Important rules:**
- Once a sale is marked as **Paid**, the status cannot be changed further. This prevents accidental reversals of completed transactions.
- For partial payments, record the amount paid and set a due date for the remainder.

Overdue payments will trigger automatic notifications to Admin and Staff.`,
    },
    {
      id: "sales-receipt",
      title: "Receipt & WhatsApp Sharing",
      pageKey: "sales",
      navigationLink: "/sales",
      content: `After a sale is confirmed, you can print a branded receipt or share it via WhatsApp.

**Receipt includes:**
- Business name, address, logo, FSSAI number, and Instagram handle
- Customer name, phone, address, and receipt number
- Item grid with quantities, prices, and product instructions
- Business notes (from your profile), sale note, and all customer notes
- Customer body composition history in a table
- Payment status and due date (if applicable)

**How to share:**
- Click **Print Receipt** to open the print dialog. Use your browser's print function or save as PDF.
- Click **Share via WhatsApp** to open a pre-filled WhatsApp message containing the order summary, including the sale note.

**Reprinting:** You can reprint any past receipt from the Sales list by clicking the receipt icon next to a sale.`,
    },
  ],

  customers: [
    {
      id: "customers-overview",
      title: "Customer Management Overview",
      pageKey: "customers",
      navigationLink: "/customers",
      content: `The Customers page is your complete customer database. It stores contact details, purchase history, body composition measurements, and notes for every customer.

**What you can do here:**
- **Add** new customers with full contact and address details
- **Search** customers by name or phone number
- **View** purchase history, body composition history, and all notes
- **Edit** customer details (Admin and Staff only; regular users have read-only access)
- **Delete** customers (Admin only)

All customer data is isolated to your business profile — other businesses cannot see your customers.`,
    },
    {
      id: "customers-create",
      title: "Creating a Customer",
      pageKey: "customers",
      navigationLink: "/customers",
      content: `**Fields you can fill when creating a customer:**

**Basic Info:**
- Name (required), Phone (required), Email
- Date of Birth — the app automatically calculates and displays current age
- Gender (Male/Female/Other), Height

**Address:**
- Address Line 1, Address Line 2
- State, City (select from dropdown or add a new location)
- Country, Pin Code

**Discount:**
- Discount Type (Percentage or Fixed amount)
- Discount Value — automatically applied during sales

**Notes:** Free-text notes about the customer. All notes print on the receipt.

**Body Composition:** Add the first body composition entry directly on the create form.

**Created By:** Defaults to the currently logged-in user. Admins can change this to attribute the customer to another team member.`,
    },
    {
      id: "customers-body-composition",
      title: "Body Composition Tracking",
      pageKey: "customers",
      navigationLink: "/customers",
      content: `Body composition tracking lets you record health metrics for each customer over time — essential for herbal wellness businesses.

**Fields per entry:**
- Date, Weight (kg), Body Fat (%), Visceral Fat, BMR, BMI, Body Age, Trunk Fat (%), Muscle Mass (kg)

**Note:** Muscle Mass can be negative (common for some bio-impedance readings).

**How to add an entry:**
1. Open a customer's detail view.
2. Click the **Body Composition** tab.
3. Click **Add Entry** and fill in the values.
4. Click Save. The new entry appears at the top (sorted latest-first).

**On receipts:** All body composition entries for a customer are printed in a table on the receipt PDF, giving your customers a progress snapshot with every purchase.`,
    },
    {
      id: "customers-history",
      title: "Customer Order History",
      pageKey: "customers",
      navigationLink: "/customers",
      content: `The Order History tab on a customer's detail view shows all past purchases.

**What you see:**
- Date of each order, items purchased, quantities, prices
- Total revenue per order
- Discount applied
- Payment mode and status
- Sale notes

**Use cases:**
- Review what products a customer regularly buys before suggesting a new purchase
- Check if a previous payment is still outstanding
- Use the "Copy from Previous Order" feature on the Sales screen to pre-fill the cart with their usual items

The history is sorted from newest to oldest so the most recent activity is always at the top.`,
    },
  ],

  products: [
    {
      id: "products-overview",
      title: "Products & Categories Overview",
      pageKey: "products",
      navigationLink: "/products",
      content: `The Products page is your product catalogue. It lists all products available for sale or purchase.

**What you can do:**
- Add, edit, and delete products
- Organise products by category
- Bulk upload products via CSV
- Export your product list as CSV

**Product fields:**
- Category (selected first — all products must belong to a category)
- Product Name, SKU (must be unique within your profile)
- MRP (Maximum Retail Price), Earn Base (unit cost), HSN Code
- Instructions (e.g. dosage, usage notes) — printed on receipts
- Serving Size / Count — printed on receipts
- Volume Points (internal tracking only)`,
    },
    {
      id: "products-categories",
      title: "Managing Categories",
      pageKey: "products",
      navigationLink: "/products",
      content: `Categories help you organise your products into logical groups (e.g. Protein Powders, Herbal Supplements, Vitamins).

**To create a category:**
1. Go to the Products page.
2. Switch to the **Categories** tab.
3. Click **Add Category**.
4. Enter a name and description, then save.

**To assign a product to a category:**
- When creating or editing a product, the Category field is shown first. Select the appropriate category.

**Deleting a category:**
- You can only delete a category if no products are currently assigned to it.
- Reassign products first, then delete the empty category.`,
    },
    {
      id: "products-bulk-upload",
      title: "Bulk Upload & CSV Export",
      pageKey: "products",
      navigationLink: "/products",
      content: `You can upload multiple products at once using a CSV file, saving time on data entry.

**To bulk upload products:**
1. Click **Bulk Upload**.
2. Download the **CSV Template** to see the required column format.
3. Fill in your product data in the template.
4. Upload the completed file.
5. Review any row-level errors reported — rows with errors are skipped; valid rows are saved.

**To export products:**
- Click **Export CSV** to download all current products as a spreadsheet.
- Use this for offline review, backup, or importing into another system.

**Tip:** Always download the latest template before uploading — column formats may change with new features.`,
    },
  ],

  inventory: [
    {
      id: "inventory-overview",
      title: "Inventory Overview",
      pageKey: "inventory",
      navigationLink: "/inventory",
      content: `The Inventory page shows the current stock levels across all warehouses you have access to.

**Key information displayed:**
- Product name and SKU
- Warehouse location
- Current quantity available
- Batch details: batch number, unit cost, date received
- Loaned item flag (if applicable)

**Who sees what:**
- **Regular Staff** see only their assigned warehouse.
- **Admin** can switch between all warehouses and see a consolidated view.
- **Loaned batches** are tagged and excluded from COGS calculations.

Stock levels decrease automatically when a sale is confirmed and increase when a Purchase Order is marked as received.`,
    },
    {
      id: "inventory-movement",
      title: "Moving Stock Between Warehouses",
      pageKey: "inventory",
      navigationLink: "/inventory-movement",
      content: `The Inventory Movement feature lets you transfer stock from one warehouse to another.

**Typical use case:**
Staff members receive stock into the Main warehouse (via a Purchase Order). Admin or Staff then moves the items to the staff member's personal warehouse for sale.

**How to move stock:**
1. Go to **Inventory Movement**.
2. Select the **From Warehouse** (source).
3. Select the **To Warehouse** (destination).
4. Select the **Product** and enter the **Quantity** to move.
5. Click **Move Stock**.

The quantity is immediately deducted from the source warehouse and added to the destination.

**Admin capability:** Admins can move stock between any two warehouses. Staff can only move stock from Main Warehouse to their own.`,
    },
    {
      id: "inventory-loaner",
      title: "Loaner (Third-Party) Inventory",
      pageKey: "inventory",
      navigationLink: "/loaner-inventory",
      content: `Loaner Inventory is a virtual warehouse for items borrowed from friends or third parties that you want to track and sell without affecting your own cost of goods.

**Workflow:**
1. **Receive:** Admin logs loaned items into the Loaner Inventory with the source name.
2. **Move:** Use "Move to Staff Inventory" to transfer loaned items to a staff member for sale. Items retain the "Loaned" tag.
3. **Sell:** Staff toggles "Temporary Item" during sale to mark the item as loaned stock. Admin receives a notification that a payout is owed.
4. **Return:** If unsold, use "Return to Source" to remove items from staff inventory and close the loop.
5. **Archive:** Admin archives returned batches to confirm they've been physically returned.

Loaned items are excluded from COGS and main inventory valuation reports.`,
    },
  ],

  purchaseOrders: [
    {
      id: "po-overview",
      title: "Purchase Orders Overview",
      pageKey: "purchaseOrders",
      navigationLink: "/purchase-orders",
      content: `The Purchase Orders (PO) page tracks all stock you have ordered from vendors.

**Key concepts:**
- A **PO** is created when you order goods from a vendor.
- Once goods are physically received, you mark the PO as **Received**, which automatically updates your inventory.

**PO fields:**
- PO Number (auto-generated with "PO-" prefix, but editable)
- Vendor (select from your vendor list; defaults to the only vendor if just one exists)
- Warehouse (where stock will be received into)
- Line items: Product, Quantity, Unit Cost

**Who can create POs:** Admin and Staff.
**Who can mark received:** Admin and Staff.`,
    },
    {
      id: "po-create",
      title: "Creating a Purchase Order",
      pageKey: "purchaseOrders",
      navigationLink: "/purchase-orders",
      content: `**Step-by-step:**
1. Click **Create Purchase Order**.
2. Enter or confirm the **PO Number** (auto-filled as PO-XXXX, but you can type your own).
3. **Select a Vendor** from the dropdown. If only one vendor exists, it is auto-selected.
4. Choose the **Warehouse** where goods will be received.
5. Add line items: select a product, enter quantity and unit cost.
6. Click **Save Purchase Order**.

The PO appears in the list with "Pending" status.

**When goods arrive:**
1. Open the PO from the list.
2. Verify the items match what was delivered.
3. Click **Mark as Received**.
4. Inventory batches are created automatically at the specified warehouse.`,
    },
    {
      id: "po-vendors",
      title: "Managing Vendors",
      pageKey: "purchaseOrders",
      navigationLink: "/purchase-orders",
      content: `Vendors are suppliers you purchase goods from. Managing them here lets you quickly select the right supplier when creating a PO.

**To add a vendor:**
1. Go to the PO page and click **Add Vendor** (or navigate to vendor settings).
2. Enter the vendor's name, contact details, phone, and address.
3. Mark as **Default** if this is your primary supplier — it will be auto-selected on new POs.

**If only one vendor exists**, it is automatically selected when you create a new PO, saving an extra click.

**Best practice:** Keep vendor details up to date so your purchase records are accurate for reconciliation.`,
    },
  ],

  profile: [
    {
      id: "profile-setup",
      title: "Setting Up Your Business Profile",
      pageKey: "profile",
      navigationLink: "/profile",
      content: `The Business Profile page stores your business information that appears on receipts, invoices, and throughout the app.

**Fields you can set:**
- **Business Name** — appears on all receipts
- **Phone Number**, **Email**, **Business Address** — contact details on receipts
- **FSSAI Number** — must be exactly 14 digits; displayed on receipts
- **Logo** — uploaded image used on receipts and the app header
- **Theme Color** — brand color applied throughout the app UI
- **Receipt Notes** — rich text that appears as "Business Notes" on every receipt PDF
- **Instagram Account** — displayed on receipts for social media visibility

**Saving your profile:**
Click **Save Profile**. Changes to the logo and theme color take effect immediately across the app.`,
    },
    {
      id: "profile-theme",
      title: "Logo & Theme Color",
      pageKey: "profile",
      navigationLink: "/profile",
      content: `Your logo and theme color personalise the app experience for your business.

**Logo:**
- Upload a PNG or JPG image (ideally square, at least 200×200px).
- The logo appears in the app header, on receipt PDFs, and in the login screen.
- To change it, click "Change Logo" and upload a new file.

**Theme Color:**
- Use the color picker to select your brand color.
- The color is applied to buttons, highlights, navigation indicators, and accent elements throughout the app.
- If you change the color, refresh the page if you don't see the update immediately.

**Important:** Make sure to click **Save Profile** after changing either setting.`,
    },
    {
      id: "profile-receipt-notes",
      title: "Receipt Notes",
      pageKey: "profile",
      navigationLink: "/profile",
      content: `The Receipt Notes field lets you add a rich-text message that prints on every receipt as "Business Notes."

**Common uses:**
- Return policy ("No returns after 7 days")
- A thank-you message for customers
- Contact details or support instructions
- Important product disclaimers

**How to edit:**
Use the rich text editor — you can bold text, add bullet points, and format the message clearly.

**Where it appears on the receipt:**
The business notes are printed in the first section below the item grid on the receipt PDF, clearly separated from the sales note and customer notes.`,
    },
  ],

  userManagement: [
    {
      id: "user-mgmt-overview",
      title: "User Management Overview",
      pageKey: "userManagement",
      navigationLink: "/user-management",
      content: `The User Management page lets Admin manage everyone who has access to your business profile.

**What you can do:**
- View all users registered in your profile
- Enable or disable access for any user
- Approve or reject new staff join requests
- Assign or change user roles (Admin / Staff)
- Set module-level permissions per user (PO, Customer, Product, Sales)

**Access levels:**
- **Admin** — full access to all features
- **Staff** — limited access; only enabled modules are visible
- **Pending** — cannot use the app until approved by Admin

New users who join your profile via the profile key are added with a "Pending" status by default and cannot use the app until you approve them.`,
    },
    {
      id: "user-mgmt-approve",
      title: "Approving New Staff",
      pageKey: "userManagement",
      navigationLink: "/user-management",
      content: `When a new user joins your profile, they start in **Pending Approval** status. They will see a "Pending Approval" screen when they log in.

**To approve a user:**
1. Go to User Management.
2. You'll see a notification badge if there are pending approvals.
3. Find the user in the pending list.
4. Click **Approve** to grant them access, or **Reject** to deny entry.

**After approval:**
- The user's status changes to Active.
- They can now log in and access the modules you've enabled for them.

**Notifications:**
Admin receives an automatic notification whenever a new staff member joins, so you don't have to check manually.`,
    },
    {
      id: "user-mgmt-permissions",
      title: "Module-Level Permissions",
      pageKey: "userManagement",
      navigationLink: "/user-management",
      content: `You can control which parts of the app each staff member can access.

**Available modules:**
- **PO** — Purchase Orders (create and manage)
- **Customer** — Customer management (add, edit, view)
- **Product** — Product and category management
- **Sales** — Create and view sales

**How to set permissions:**
1. Open the user from the user list.
2. Toggle the modules on or off.
3. Save changes.

The staff member's navigation sidebar will update immediately on their next login — they'll only see icons for modules they're allowed to use.

**Best practice:** Give each staff member only the access they need to do their job. This reduces errors and keeps your data secure.`,
    },
  ],

  superAdmin: [
    {
      id: "super-admin-overview",
      title: "Super Admin Dashboard Overview",
      pageKey: "superAdmin",
      navigationLink: "/super-admin",
      content: `The Super Admin Dashboard gives you global oversight of all business profiles registered in the app.

**What you can see:**
- All registered business profiles with their status, owner, user count, and storage usage
- Global metrics: total users, total profiles, platform-wide activity

**What you can do:**
- Enable or disable any profile
- Update a profile's active date window (start and end dates)
- Update the profile key for any profile
- Delete a profile and all its associated data
- Impersonate any profile as Admin or Staff to review issues first-hand

**Important:** The Inventory and Sales links in the sidebar are disabled for Super Admin unless you are actively impersonating a profile.`,
    },
    {
      id: "super-admin-impersonation",
      title: "Impersonating a Profile",
      pageKey: "superAdmin",
      navigationLink: "/super-admin",
      content: `Impersonation lets you browse the app exactly as a specific profile's Admin or Staff member would see it — without needing their credentials.

**How to impersonate:**
1. On the Super Admin Dashboard, find the profile you want to review.
2. Click the **Impersonate** button next to it.
3. Select whether to impersonate as **Admin** or **Staff**.
4. You'll see an orange banner at the top confirming you're in impersonation mode.

**What you can do while impersonating:**
- View the dashboard, inventory, sales, customers, and profile pages for that business
- Diagnose issues reported by the profile owner

**How to exit:**
Click the **Exit** button in the orange impersonation banner to return to the Super Admin Dashboard.

No changes you make while impersonating will be attributed to the profile's actual users.`,
    },
    {
      id: "super-admin-profile-management",
      title: "Managing Business Profiles",
      pageKey: "superAdmin",
      navigationLink: "/super-admin",
      content: `Super Admin has full control over all business profiles.

**Enable / Disable:**
Toggle a profile's enabled status. Disabled profiles block all users from logging in and transacting.

**Active Date Window:**
Set a start and end date for a profile's active period. Useful for trial or subscription-based access. After the end date, the profile is automatically blocked.

**Update Profile Key:**
Each profile has a unique key that users enter to join. You can update this key if it has been compromised.

**Delete Profile:**
Permanently deletes the profile and ALL associated data (customers, products, inventory, sales, users). This action is irreversible. Use with caution.

**Selecting a profile:**
Use the profile selector dropdown to load any profile's details into the edit form.`,
    },
  ],

  notifications: [
    {
      id: "notifications-overview",
      title: "Notifications Overview",
      pageKey: "notifications",
      navigationLink: "/dashboard",
      content: `The Notifications panel keeps Admin and Staff informed of important events that need attention.

**Types of notifications:**
- **New User Request** — A new staff member has joined and is awaiting approval
- **Overdue Payment** — A sale with a payment due date has passed without full payment
- **Customer Follow-up** — A customer has not placed an order in 20+ days

**How to access:**
Click the notification bell icon in the top bar. A badge shows the count of unread notifications.

**Marking as read:**
Click a notification to view it and mark it as read. Use "Mark All Read" to clear all unread badges at once.

Notifications are generated automatically by background jobs that run every 6 hours. You can also trigger a manual check from the notification panel.`,
    },
    {
      id: "notifications-payments",
      title: "Overdue Payment Alerts",
      pageKey: "notifications",
      navigationLink: "/sales",
      content: `When a sale has a payment due date and the payment hasn't been received in full, an overdue alert is generated automatically.

**What the notification shows:**
- Customer name and sale reference
- Amount still outstanding
- How many days overdue

**What you can do from the notification:**
- Click **View Sale** to open the sale directly
- Update the payment status (mark as Paid or change amount)
- Set a new due date if you've agreed to an extension

**Background automation:**
These alerts are checked every 6 hours by the backend. You don't need to be logged in for them to be created — they'll be waiting when you next open the app.`,
    },
    {
      id: "notifications-followup",
      title: "Customer Follow-up Reminders",
      pageKey: "notifications",
      navigationLink: "/customers",
      content: `To help you stay connected with your customer base, the system generates follow-up reminders for customers who haven't ordered in 20 days.

**Why this matters:**
Many health and wellness products need to be replenished regularly. Proactive follow-up helps maintain customer retention and increases repeat sales.

**What you see:**
- Customer name
- Days since their last order
- Quick link to their profile

**What to do:**
- Contact the customer using the phone number in their profile
- Use the WhatsApp number stored in their record (if mapped) to send a personalised message

These reminders are automatically cleared once the customer places a new order.`,
    },
  ],

  warehouse: [
    {
      id: "warehouse-overview",
      title: "Warehouse Management Overview",
      pageKey: "warehouse",
      navigationLink: "/inventory",
      content: `Warehouses (also called Inventory Locations) are how the app tracks where physical stock is held.

**How warehouses work:**
- Each user is assigned to one warehouse — their "home" location for sales and stock.
- When products are received (via a Purchase Order), they arrive at the warehouse specified on the PO.
- Stock can be moved between warehouses using the Inventory Movement feature.

**Warehouse types:**
- **Main Warehouse** — usually where bulk stock is received first
- **Staff Warehouses** — personal inventory locations for each staff member
- **Loaner / Friend Inventory** — virtual warehouse for third-party borrowed stock

**Admin access:**
Admin users can view and manage stock across all warehouses. They can also share a warehouse between two staff members.`,
    },
    {
      id: "warehouse-sharing",
      title: "Sharing a Warehouse",
      pageKey: "warehouse",
      navigationLink: "/user-management",
      content: `A warehouse can be assigned to two staff members who work together in the same physical location.

**How to share a warehouse:**
1. Go to User Management.
2. Select the second staff member.
3. Assign them the same warehouse name as the first.

Both staff members will then see and manage the same stock pool. Sales made by either staff member will deduct from the shared warehouse.

**Important:** Ensure both staff members coordinate to avoid overselling. The system does not lock individual items for concurrent transactions — the FIFO batch system resolves availability in the order transactions are processed.`,
    },
  ],

  analytics: [
    {
      id: "analytics-overview",
      title: "Analytics Overview",
      pageKey: "analytics",
      navigationLink: "/analytics",
      content: `The Analytics page provides detailed reporting on your business performance.

**What's available:**
- Revenue trends over time
- Top-selling products by revenue and volume
- Customer purchase frequency
- Payment status summary (Paid vs. Pending vs. Partial)
- Staff performance (Admin view)

**Filters:**
- Date range selector to zoom into specific periods
- Staff filter (Admin only) to view performance by team member

**Exporting data:**
Use the CSV Export button to download sales data for offline analysis in spreadsheet tools.

Keep an eye on your top customers and top products — these are your most important relationships and SKUs to protect.`,
    },
  ],

  referralUser: [
    {
      id: "referral-user-overview",
      title: "Referral User Overview",
      pageKey: "referralUser",
      navigationLink: "/customers",
      content: `As a Referral User, your role is to bring in new customers to the business and earn a commission on their purchases.

**What you can do:**
- **Create Customers** — Add new customers to the system. The "Referred By" field defaults to your name.
- **View Customers** — Browse the customer list to see who you have referred.

**What you cannot do:**
- Create or view sales, products, inventory, or purchase orders
- Access admin or staff features

**Commissions:**
- For every sale made to a customer you referred, a referral commission is recorded.
- Your accrued commissions are summarised on the Admin dashboard.
- Speak to your Admin to find out your commission rate and payment schedule.

**Referred By field:**
When adding a new customer, the "Referred By" field is automatically set to your name. This links the customer to you for commission tracking purposes.`,
    },
    {
      id: "referral-user-add-customer",
      title: "Adding a Referred Customer",
      pageKey: "referralUser",
      navigationLink: "/customers",
      content: `**Step-by-step to add a new customer:**

1. Click **Add Customer** from the Customers page.
2. Fill in the customer's **Name** and **Phone** (required).
3. Optionally add email, address, date of birth, and other details.
4. The **Referred By** field defaults to your name — leave it as-is to ensure your commission is tracked.
5. Click **Save Customer**.

The customer is now in the system. When the business makes a sale to this customer, your referral commission will be recorded automatically.

**Tips:**
- Always verify the customer's phone number — it is used for WhatsApp communication.
- Add any relevant notes about the customer's health goals or preferences in the Notes field.`,
    },
  ],

  customerGoals: [
    {
      id: "customer-goals-overview",
      title: "Customer Primary Goals",
      pageKey: "customerGoals",
      navigationLink: "/customer-goals",
      content: `The Customer Primary Goals page lets you define health and wellness goals that customers can work towards. These goals can be linked to specific product bundles so that when a customer's goal is selected during a sale, the relevant products are automatically suggested.

**What goals are:**
Goals represent the health objectives a customer wants to achieve — for example: "Weight Loss", "Muscle Gain", "Detox", "Energy Boost", or "Immunity Support".

**How to add a goal:**
1. Navigate to **Customer Goals** from the main menu.
2. Click **Add Goal**.
3. Enter a descriptive **Goal Name** (e.g. "Weight Management").
4. Optionally attach a **Product Bundle** — a list of products that are typically sold together for this goal.
5. Click **Save Goal**.

**How to edit or delete a goal:**
- Click the edit icon next to any goal in the list.
- Make your changes and save.
- To delete, click the delete icon and confirm. Deleted goals are removed from all customer records.

**Product bundling:**
When you associate a product bundle with a goal, the app can pre-populate the sales cart with those products when a customer with that goal is selected. This speeds up order entry for repeat customers.

**Export / Import:**
- Use **Export CSV** to download all goals and their product bundles for backup or migration.
- Use **Import CSV** to bulk-upload goals from a spreadsheet.`,
    },
  ],

  customerMedicalIssues: [
    {
      id: "medical-issues-overview",
      title: "Customer Medical Issues",
      pageKey: "customerMedicalIssues",
      navigationLink: "/customer-medical-issues",
      content: `The Customer Medical Issues page lets you define a master list of health conditions that can be assigned to customers. This helps your team understand customer health contexts and provide appropriate product recommendations.

**What medical issue tracking is for:**
Tracking medical issues (e.g. "Diabetes", "High Blood Pressure", "Thyroid", "PCOD", "Joint Pain") allows your team to note relevant health conditions for each customer. This information can guide product recommendations and flag any products that may not be suitable.

**How to add a medical issue:**
1. Navigate to **Medical Issues** from the main menu.
2. Click **Add Medical Issue**.
3. Enter the **Issue Name** (e.g. "Type 2 Diabetes").
4. Click **Save Issue**.

**Assigning issues to customers:**
- When viewing or editing a customer record, you'll find a **Medical Issues** section.
- Select one or more issues from the master list to assign them to that customer.
- Multiple issues can be assigned simultaneously.

**How to edit or delete an issue:**
- Click the edit icon next to any issue in the list.
- To delete, click the delete icon. Note: if the issue is assigned to customers, you'll be asked to confirm removal.

**Export / Import:**
- Use **Export CSV** to download the full list of defined medical issues.
- Use **Import CSV** to bulk-add medical issues from a spreadsheet.`,
    },
  ],

  bodyInches: [
    {
      id: "body-inches-overview",
      title: "Body Inches Tracking",
      pageKey: "bodyInches",
      navigationLink: "/customers",
      content: `Body Inches tracking lets you record physical body measurements for each customer over time. This is especially useful for monitoring progress in fitness and weight management programs.

**The 6 measurements tracked:**
- **Chest** — circumference of the chest at its widest point
- **Biceps** — circumference of the upper arm (flexed)
- **Waist** — circumference at the narrowest point of the torso
- **Hips** — circumference at the widest point of the hips
- **Thighs** — circumference of the upper leg at its widest
- **Calves** — circumference of the lower leg at its widest

All measurements are recorded in centimetres (cm) or inches depending on your preference.

**How to add an entry:**
1. Open a customer's detail view.
2. Click the **Body Inches** tab.
3. Click **Add Measurement**.
4. Enter the date and fill in any or all of the 6 measurements.
5. Click Save. The new entry is added to the history.

**Viewing history:**
- Entries are sorted with the most recent at the top.
- You can compare entries over time to track progress.
- All body inches entries are included on the customer's receipt PDF alongside body composition data.

**On receipts:**
Body inches measurements are shown in the customer data section of the receipt PDF, giving a complete health snapshot for each visit.`,
    },
  ],

  preferences: [
    {
      id: "preferences-overview",
      title: "User Preferences",
      pageKey: "preferences",
      navigationLink: "/user-preferences",
      content: `The User Preferences page lets you personalise how the app looks and behaves for your account. Settings saved here apply only to your login — other users have their own preferences.

**Language:**
Choose the display language for all UI text in the app:
- **English** (default)
- **Gujarati** (ગુજરાતી)
- **Hindi** (हिंदी)

Your selected language is saved to your account and applied on every login.

**Date Format:**
Choose how dates are displayed throughout the app:
- DD/MM/YYYY (e.g. 27/04/2026) — common in India
- MM/DD/YYYY (e.g. 04/27/2026) — US format
- YYYY-MM-DD (e.g. 2026-04-27) — ISO format

**Default Receipt Language:**
Choose which language is used for receipt PDFs by default. This can also be overridden at the time of printing a specific receipt — useful if you have customers who prefer different languages.

**Saving preferences:**
Click the **Save** button (at the bottom of the form) to save all preferences at once. After saving, you will be automatically logged out and prompted to log in again — this ensures your new language and format settings are applied correctly across the entire app.

**Important:** Do not use the "Apply Changes" button if it appears — always use **Save** to ensure all preferences are persisted and your session is refreshed properly.`,
    },
  ],

  adminTests: [
    {
      id: "admin-tests-overview",
      title: "Admin Regression Tests",
      pageKey: "adminTests",
      navigationLink: "/admin/tests",
      content: `The Admin Regression Test Suite is a built-in automated testing page available only to Super Admins. It runs a comprehensive set of checks against the backend and frontend to verify that all core features are working correctly after each build or update.

**What the test suite covers:**
- Backend API methods (actor methods exist and return expected types)
- Role and access control logic
- Data model field verification
- Notification and background job wiring
- UI element presence (help buttons, header icons, etc.)
- Route definitions

**How to run tests:**
1. Log in as Super Admin.
2. Navigate to **/admin/tests** (accessible from the Super Admin Dashboard or directly via URL).
3. Click **Run All Tests** to execute all 155+ checks at once.
4. Or click **Run** next to any individual section to test that module only.

**Reading the results:**
- **PASS** (green) — the check succeeded.
- **FAIL** (red) — the check failed. The reason is shown below the test item. This indicates a regression or missing implementation.
- **PENDING** — the test has not yet been run.

**Summary bar:**
The top bar shows total, passed, and failed counts. A red "X failing" badge means there are regressions to investigate.

**What to do if a test fails:**
Note the test ID and description, and report it. Most failures indicate that a backend method is missing or a field name has changed. Do not attempt to modify the backend directly — report it for a targeted fix.`,
    },
  ],
};

/**
 * Returns a flat list of all help topics across all pages.
 */
export function getAllHelpTopics(): HelpTopic[] {
  return Object.values(helpContent).flat();
}

/**
 * Returns help topics for a specific page key.
 */
export function getHelpTopicsForPage(pageKey: string): HelpTopic[] {
  // Direct lookup first
  if (helpContent[pageKey]) return helpContent[pageKey];
  // Fallback: try matching by navigationLink route
  const all = getAllHelpTopics();
  const matched = all.filter((t) => t.navigationLink === pageKey);
  return matched.length > 0 ? matched : [];
}

/**
 * Maps route paths to page keys for the help system.
 */
export const routeToPageKey: Record<string, string> = {
  "/dashboard": "dashboard",
  "/sales": "sales",
  "/customers": "customers",
  "/products": "products",
  "/inventory": "inventory",
  "/inventory-movement": "inventory",
  "/purchase-orders": "purchaseOrders",
  "/profile": "profile",
  "/user-management": "userManagement",
  "/super-admin": "superAdmin",
  "/analytics": "analytics",
  "/loaner-inventory": "inventory",
  "/user-preferences": "preferences",
  "/customer-goals": "customerGoals",
  "/customer-medical-issues": "customerMedicalIssues",
  "/admin/tests": "adminTests",
};
