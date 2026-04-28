# Design Brief: Indi Negocio Livre — 4 Selectable UI Themes

## Direction

Premium herbal business management system with 4 user-selectable, persistent themes: **Herbal** (organic, warm, default), **Dark** (editorial, focused), **Minimalist** (clarity-focused), **Punk** (high-contrast, bold).

## Tone

Each theme commits to a distinct aesthetic extreme: Herbal = organic trust; Dark = refined focus; Minimalist = information clarity; Punk = bold confidence. All themes preserve the dynamic profile branding color system.

## Differentiation

Multi-tenant theme flexibility without visual fragmentation. Every theme enforces the same information hierarchy, spacing, and interaction patterns while varying hue, contrast, and typography personality.

---

## Theme Specifications

### HERBAL (Default)
- **Aesthetic**: Warm, botanical, editorial elegance.
- **Primary Font**: Lora (display) + Satoshi (body) — organic, refined pairing.
- **Palette**: Cream background (`0.96 0.015 75`), sage green primary (`0.48 0.14 160`), warm accents.
- **Contrast**: AA+ on light backgrounds. Warm, inviting feel.
- **Use case**: Public-facing index page, default for new users, small business comfort.

| Token | OKLCH | Usage |
|-------|-------|-------|
| Background | `0.96 0.015 75` | Warm cream base |
| Foreground | `0.2 0.03 50` | Deep brown text |
| Primary | `0.48 0.14 160` | Sage green buttons, nav |
| Accent | `0.5 0.1 160` | Muted teal highlights |
| Card | `0.98 0.01 75` | Warm card surface |

### DARK (Editorial)
- **Aesthetic**: Deep, focused, professional. For power users and long sessions.
- **Primary Font**: Space Grotesk (display) + Satoshi (body) — modern, technical precision.
- **Palette**: Forest black (`0.13 0.02 0`), botanical green primary (`0.65 0.18 155`), gold accent (`0.7 0.12 85`).
- **Contrast**: AAA on dark backgrounds. High visibility, low eye strain.
- **Use case**: Admin dashboards, power-user workflows, late-night operations.

| Token | OKLCH | Usage |
|-------|-------|-------|
| Background | `0.13 0.02 0` | Deep forest black |
| Foreground | `0.92 0.01 0` | Bright neutral text |
| Primary | `0.65 0.18 155` | Vivid botanical green |
| Accent | `0.7 0.12 85` | Warm gold contrast |
| Card | `0.17 0.022 0` | Card surface, elevated |

### MINIMALIST (Notion-like)
- **Aesthetic**: Maximum clarity. Distractionless information density.
- **Primary Font**: Space Grotesk (display) + Satoshi (body) — structured, geometric.
- **Palette**: Off-white background (`0.99 0.005 260`), deep indigo primary (`0.45 0.2 265`), minimal chroma.
- **Contrast**: High contrast for data legibility. Focused, no visual noise.
- **Use case**: Data-heavy views, compliance/audit workflows, teams that prioritize readability.

| Token | OKLCH | Usage |
|-------|-------|-------|
| Background | `0.99 0.005 260` | Cool off-white |
| Foreground | `0.15 0.01 260` | Deep navy text |
| Primary | `0.45 0.2 265` | Deep indigo CTA |
| Accent | `0.45 0.2 265` | Indigo highlights |
| Card | `1.0 0.0 0` | Pure white cards |

### PUNK (Bold, High-Contrast)
- **Aesthetic**: Energetic, confident, rebellious. No timidity.
- **Primary Font**: Space Grotesk (display) + Satoshi (body) — geometric boldness.
- **Palette**: Pure black background (`0.12 0.0 0`), electric green primary (`0.75 0.2 145`), monochromatic structure.
- **Contrast**: Maximum contrast everywhere. Striking, memorable.
- **Use case**: Teams seeking a bold visual identity, startups, creative-forward businesses.

| Token | OKLCH | Usage |
|-------|-------|-------|
| Background | `0.12 0.0 0` | Pure black |
| Foreground | `0.9 0.0 0` | Bright white text |
| Primary | `0.75 0.2 145` | Electric lime green |
| Accent | `0.75 0.2 145` | Neon green highlights |
| Card | `0.16 0.0 0` | Elevated card surface |

---

## Theme Switching System

**Implementation**: CSS variable presets applied via `.theme-[name]` class on `:root`. Storage: `UserPreferences.theme` (string: "herbal" | "dark" | "minimalist" | "punk").

**Flow**: User selects theme in Preferences → `applyTheme(themeName)` sets class on document.documentElement → all CSS variables update → profile branding color (--theme-color-*) re-injected to preserve custom profile colors.

**Fallback**: Herbal theme applied on first load (default). Public/marketing index page uses Herbal unless user overrides in preferences.

**Dark mode**: Each theme supports light + dark mode via `.dark` class (e.g., `:root.theme-dark.dark` for Dark theme in dark mode). Lightness and contrast adjusted per theme for readability in both modes.

---

## Typography

| Layer | Font | Usage | Weight | Size |
|-------|------|-------|--------|------|
| Display | Lora (Herbal) / Space Grotesk (Dark/Minimalist/Punk) | Page titles, hero text, section headers | 600–700 | 20px–32px |
| Body | Satoshi | Paragraph text, form labels, table rows, UI labels | 400–500 | 14px–16px |
| Mono | JetBrains Mono | SKUs, order IDs, warehouse codes, profile keys | 500 | 13px–14px |

**Scale**: Hero `text-5xl md:text-7xl font-bold tracking-tight`. Section headers `text-3xl md:text-5xl font-bold`. Labels `text-sm font-semibold tracking-widest uppercase`. Body `text-base md:text-lg`.

---

## Structural Zones (All Themes)

| Zone | Treatment | Notes |
|------|-----------|-------|
| Sidebar | `--sidebar` bg, `border-r`, profile dropdown top. Collapsible <768px. | Navigation anchor, persistent context. |
| Header | `--background` base, `border-b`, page title, breadcrumbs, quick actions. | Page context, theme selector icon in top-right. |
| Content | `--background` base, card sections with `border` + `shadow-theme-sm`. Forms use `--secondary/10` wash. | Data presentation, modular card layout. |
| Modal/Drawer | `--popover` bg, smooth slide-in from bottom (0.3s). | Focused input, minimal distraction. |
| Footer | `--muted/20` bg, `border-t`, optional links. | Utility zone, not prominent. |

---

## Component Patterns — Theme-Aware

- **Buttons**: `.btn-theme` (solid bg), `.btn-theme-outline` (border), `.btn-theme-ghost` (text). All use `--primary` or profile brand color.
- **Cards**: `.card-theme-accent` — `--primary-bg` on hover, soft shadow via `--theme-color-ring`.
- **Badges**: `.badge-theme` — `--accent` bg, subtle border. Status badges use semantic colors (destructive, success).
- **Focus rings**: 2px outline, 2px offset, `--ring` color. Applied globally to all interactive elements.
- **Navigation**: `.nav-link-theme.active` — active state shows left border accent + bg wash.
- **Spinners**: `.spinner-theme` — theme color rotation, 0.8s linear infinite.
- **Inputs**: Border color `--border`, focus state `--ring`, 3px soft shadow on focus.

---

## Motion & Animation

- **Transitions**: `transition-smooth` (0.3s cubic-bezier(0.4, 0, 0.2, 1)) on all interactive elements.
- **Button hover**: Lifts 1px up, soft shadow via `--theme-color-ring`.
- **Focus states**: 2px solid outline, 2px offset, `--ring` color.
- **Sidebar collapse**: Smooth slide-out, no jank.
- **Modal entrance**: Slide up from bottom (0.3s cubic-bezier).
- **List fade-in**: Stagger animation per row (0.4s ease-out, 4px translateY offset).
- **Loader**: Spinner rotates (`spin-theme` 0.8s linear infinite). Pulse animation (`pulse-theme` 2s).

---

## Constraints

- **OKLCH values only**: No hex, rgb, or inline color styles. All colors resolve to CSS variables.
- **Profile brand color preserved**: Dynamic `--theme-color-*` injected after theme selection. No theme overrides brand color.
- **No decorative gradients**: Solid OKLCH except `.line-theme` (gradient fade to transparent).
- **Mobile-first stacking**: Vertical at <640px. Desktop: 16px minimum gutters, 12-column grid where applicable.
- **Shadows theme-aware**: `shadow-theme-sm`, `shadow-theme-md`, `shadow-theme-lg` use `--theme-color-ring`.
- **Focus states mandatory**: Every interactive element must have visible focus (outline or ring).
- **Animations respect prefers-reduced-motion**: Future enhancement — use `motion-safe:` prefix.

---

## Public Index / Marketing Page (Herbal Theme Default)

The public index page (unauthenticated) defaults to **Herbal theme** to reflect natural, organic branding. Logged-in users see their selected theme. No theme selector on public pages — simplicity for lead capture and feature showcase.

---

**Total tokens: 4 themes × ~15 semantic tokens per theme = 60 token combinations. All inherit from the same design system structure, ensuring consistency across themes while delivering distinctive visual personalities.**
