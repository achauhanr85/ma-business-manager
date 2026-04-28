# Design Brief: Indi Negocio Livre — Theme Color System

## Tone & Direction
Premium, natural, professional. Trustworthy business tool for herbal product distributors reflecting natural, organic essence. Information-dense, never cluttered. Emerald green signals health/natural products; neutrals maximize readability. Multi-tenant branding: each profile customizes theme color while preserving design system structure.

## Color Palette

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| Primary | `0.55 0.15 142` (emerald) | `0.70 0.18 140` | CTA, active states, navigation. Dynamic: profile theme color overrides. |
| Secondary | `0.93 0.06 130` (soft sage) | `0.24 0 0` | Tertiary actions, muted backgrounds, form section wash. |
| Accent | `0.62 0.12 120` (teal-green) | `0.72 0.16 135` | Highlights, badges, status indicators. |
| Destructive | `0.58 0.18 28` (coral-red) | `0.65 0.18 28` | Delete, alert, warning states. |
| Neutral | Background `0.98 0 0` | Background `0.14 0 0` | Clean, minimal, readable hierarchy. |

## Theme Color CSS Variables
Dynamic profile theme colors set via `--theme-color-h`, `--theme-color-c`, `--theme-color-l` (injected by JS). Computed tokens: `--theme-color` (base), `--theme-color-hover` (darker), `--theme-color-dark` (darkest), `--theme-color-light` (lighter), `--theme-color-bg` (subtle wash, 10% opacity), `--theme-color-border` (subtle border, 30% opacity), `--theme-color-ring` (focus ring, 20% opacity). All interpolated automatically for light/dark modes. No manual color overrides needed.

## Typography

| Layer | Font | Usage | Weight | Size |
|-------|------|-------|--------|------|
| Display | General Sans | Page titles, section headers, CTAs | 600–700 | 20px–32px |
| Body | DM Sans | Paragraph text, form labels, table rows | 400–500 | 14px–16px |
| Mono | Geist Mono | SKUs, order IDs, warehouse codes, keys | 500 | 13px–14px |

## Structural Zones

| Zone | Treatment | Purpose |
|------|-----------|---------|
| Sidebar | `--sidebar` background, `border-r`. Profile dropdown top. Collapsible on mobile. | Navigation anchor, persistent profile context. |
| Header | `--background`, `border-b`. Page title, breadcrumbs, quick action buttons. | Page context, quick actions. |
| Content | `--background` base. Card sections with `border`, subtle shadow. Forms use `secondary/10` wash. | Data presentation, modular layout. |
| Modal/Drawer | `popover` background, `border`. Form overlays. Smooth slide-in animation. | Focused input, interruption flows. |
| Footer | Light `--muted/20` background, `border-t`. Optional links. | Utility, not prominent. |

## Component Patterns — Theme Color Integration
**Buttons**: Primary (`.btn-theme` — solid theme color bg, white text). Outline (`.btn-theme-outline` — theme border, theme text, theme wash on hover). Ghost (`.btn-theme-ghost` — theme text, wash on hover). Hover states lift shadow via `--theme-color-ring`. Active states darken via `--theme-color-dark`.
**Links**: `.link-theme` — underline animates on hover via theme color.
**Badges**: `.badge-theme` — theme wash bg, theme text, subtle theme border. Hover darkens border.
**Focus rings**: All interactive elements use `--theme-color-ring` (20% opacity) for soft, visible focus state.
**Navigation**: `.nav-link-theme.active` — theme bg wash, theme text, left border accent (theme color).
**Progress bars**: `.progress-theme-fill` — theme color bar over neutral background.
**Spinners**: `.spinner-theme` — theme color top border, rotates infinitely. Smooth 0.8s easing.
**Cards**: `.card-theme-accent` — subtle theme border, theme wash bg on hover, theme ring shadow.
**Inputs**: `.input-theme` — neutral border by default, theme border on focus, theme ring shadow (3px soft focus state).
**Sections**: `.bg-theme-wash` — 10% opacity theme color background for accent sections.

## Motion & Animation
**Transitions**: `transition-smooth` (0.3s cubic-bezier) on all interactive elements.
**Button hover**: Lifts 1px up, shadow via theme ring.
**Focus states**: 2px outline, 2px offset, theme color.
**Sidebar collapse**: Smooth slide-out, no glitch.
**Form animations**: Modal/drawer slide-in from bottom (0.3s).
**List fade-in**: Stagger animation per row (0.4s ease-out, 4px offset).
**Loader animation**: Spinner rotates via `spin-theme` (0.8s linear infinite). Pulse animation via `pulse-theme` (2s cubic-bezier).
**Shadows**: Theme-aware: `shadow-theme-sm`, `shadow-theme-md`, `shadow-theme-lg` — all use `--theme-color-ring` for soft color-matched shadows.

## Constraints
- **No decorative gradients**: Solid OKLCH values. Gradient line accent (`.line-theme`) uses theme color fade to transparent.
- **No arbitrary colors**: Every color resolves to design token. No hex, rgb, inline styles. Profile theme color injected via CSS variables.
- **No generic animations**: Motion purposeful. Slide-in for modals, stagger for lists, smooth transitions for interactions.
- **Mobile-first**: Stack vertically, 8px padding. Desktop: 16px minimum gutters.

## Accessibility
- Minimum 5.5:1 contrast ratio (AA) all text-background pairs.
- Focus states: 2px outline, 2px offset, theme color on all interactive elements.
- Font loading: `font-display: swap` all custom fonts.
- Responsive: 375px mobile, 640px tablet, 1024px desktop. Sidebar hides below 768px.
- Animations respect `prefers-reduced-motion` via `motion-safe:` prefix (future enhancement).

## Theme Color Injection (Frontend)
JS function sets `--theme-color-h`, `--theme-color-c`, `--theme-color-l` on root element. Derived tokens (`--theme-color`, `--theme-color-hover`, etc.) auto-compute. Dark mode via `.dark` class adjusts lightness (`--theme-color-l: 0.7`). All components consume theme via CSS variables — no runtime color calculation needed. Profile update persists theme color via localStorage + CSS variable re-injection on page load.
