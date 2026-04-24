# Design Brief: MA Herb Business Manager

## Tone & Direction
Premium, natural, professional. A trustworthy business tool for herbal product distributors that reflects the category's natural, organic essence. Information-dense but never cluttered. Emerald green signals health/natural products; neutrals maximize readability. Multi-tenant branding: each profile can customize theme color while preserving design system structure.

## Color Palette

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| Primary | `0.55 0.15 142` (emerald) | `0.70 0.18 140` | CTA, active states, navigation highlights. Fresh, natural, trusted. **Dynamic:** profile theme color overrides this. |
| Secondary | `0.93 0.06 130` (soft sage) | `0.24 0 0` | Tertiary actions, muted backgrounds, form section wash (0.15 opacity). |
| Accent | `0.62 0.12 120` (teal-green) | `0.72 0.16 135` | Highlights, badges, accents, status indicators. |
| Destructive | `0.58 0.18 28` (coral-red) | `0.65 0.18 28` | Delete, alert, warning states. |
| Success | Chart-1 (emerald) | Chart-1 (emerald) | Used via chart colors in Recharts. |
| Neutral | Background `0.98 0 0` | Background `0.14 0 0` | Clean, minimal, readable hierarchy. |

## Typography

| Layer | Font | Usage | Weight | Size |
|-------|------|-------|--------|------|
| Display | General Sans | Page titles, section headers, CTA text, form headings | 600–700 | 20px–32px |
| Body | DM Sans | Paragraph text, form labels, card content, table rows | 400–500 | 14px–16px |
| Mono | Geist Mono | Inventory SKUs, order IDs, warehouse codes, profile keys | 500 | 13px–14px |

## Structural Zones

| Zone | Treatment | Purpose |
|------|-----------|---------|
| Sidebar | `--sidebar` background with `border-r`. Profile dropdown at top. Fixed on desktop, collapsible hamburger on mobile. | Navigation anchor, persistent profile context. |
| Header | `--background` with `border-b`. Page title, breadcrumbs, action buttons (+ Add, Import). | Page context, quick actions. |
| Content | `--background` base. Card-based sections with `border` and subtle shadow. Form sections use `secondary/10` wash. | Data presentation, modular layout. |
| Modal/Drawer | `popover` background with `border`. Form overlays (Business Setup, Quick-Add Customer). Smooth slide-in animation. | Focused input, interruption-driven flows. |
| Footer | Light `--muted/20` background with `border-t`. Optional legal/support links. | Utility, not prominent. |

## Spacing & Rhythm
- Padding: 16px (sections), 12px (cards), 8px (component internals)
- Gap: 16px (vertical), 12px (horizontal grids)
- Border-radius: 10px (`var(--radius)`) for cards, 6px for inputs/buttons
- Mobile: Stack vertically, 8px internal padding. Desktop: 16px minimum gutters.

## Component Patterns
- **Buttons**: Primary (emerald bg, dynamic profile theme), secondary (outline), destructive (coral). No custom color per button.
- **Cards**: White background, 1px border `border-border/50`, subtle shadow `shadow-sm`. Section dividers via border-t.
- **Forms**: Input borders in `--input` color, focus ring in `--ring`, label text in `--foreground`. Section backgrounds use `secondary/10` wash.
- **Badges**: Warehouse location badges (`badge-location`) in secondary color. Status badges (`badge-status`) in accent color.
- **Tables**: Alternating row background `--muted/30` for readability. Sticky header with `--card` background.
- **Charts**: Recharts using chart color palette (1–5). No overlays or decorative gradients.
- **Theme Color Picker**: Live preview swatch showing selected profile color. Smooth transition on change.

## Motion & Interaction
- **Transitions**: `transition-smooth` (0.3s cubic-bezier) for all interactive elements. Hover, focus, active states.
- **Form animations**: Modal/drawer slide-in from bottom (`slide-in-from-bottom` 0.3s). Fade-in for lists.
- **Sidebar collapse**: Smooth slide-out on mobile, no animation glitch.
- **Stagger animation**: List items fade-in with 0.1s delay per row (customer table, profile grid).
- **Loading states**: Skeleton loaders for list/table views. Spinner for form submission.
- **Toast notifications**: Sonner toast at bottom-right. Success (green), error (coral), info (neutral).

## New Screens
1. **Business Setup Onboarding**: Full-page form. Title, business name input, profile key input, setup/join logic, CTA button.
2. **Customer Management**: Table of customers with name, contact, last sale date. Quick-add button triggers modal. Fuzzy duplicate detection on save.
3. **Inventory Movement**: Transfer form (from warehouse, to warehouse, product, quantity). Warehouse badges show location context.
4. **Super-Admin Dashboard**: Grid of profile cards (name, user count, storage bar). Monitoring view (view-only).
5. **Updated Business Profile**: Logo upload zone, theme color picker with swatch preview, FSSAI field, address, email. Dynamic CSS variable update on save.

## Constraints & Anti-Patterns
- **No decorative gradients**: Colors are solid OKLCH values. Gradients only in charts (Recharts handles this).
- **No random border-radius**: All radii use `var(--radius)` (10px) or calculated variants (md: 8px, sm: 6px).
- **No arbitrary colors**: Every color resolves to a design token. No hex, no rgb, no inline styles. Profile theme color is set via CSS variable injection.
- **No generic animations**: Motion is purposeful. Slide-in for modals, stagger for lists, smooth transitions for interactions.
- **Mobile-first**: All breakpoints build up from `sm` (640px). No desktop-only layouts.

## Signature Detail
**Emerald-focused sidebar with dynamic profile branding**: The sidebar uses the primary green (or profile-customized color) as the active item highlight. Profile name and logo display at top, creating a visual anchor that personalizes the app per tenant. Inactive items fade to `--sidebar-accent-foreground` (light grey on dark). This becomes the app's visual identity—professional and calm, customizable per business.

## Dark Mode Strategy
- Class-based: `dark` class on root element toggles via Tailwind.
- Lightness tuned per token: backgrounds darken to near-black (`0.14 L`), text brightens to near-white (`0.95 L`).
- Primary green shifts to `0.70 L` (more visible on dark), maintaining hue and chroma. Profile theme color applies to dark mode as well.
- Sidebar uses same class strategy; no separate color set needed.

## Accessibility & Performance
- Minimum 5.5:1 contrast ratio (AA) across all text-background pairs. Form section wash (`secondary/10`) maintains contrast for all text.
- Focus states: `ring-offset-2 ring-2 ring-ring` (emerald or profile color) on all interactive elements.
- Font loading: `font-display: swap` for all custom fonts (General Sans, DM Sans, Geist Mono).
- Responsive: 375px mobile, 640px tablet, 1024px desktop. Sidebar hides below 768px (mobile).
- No images except static placeholders. Animations respect `prefers-reduced-motion`.


