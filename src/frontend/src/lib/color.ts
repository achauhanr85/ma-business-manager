/**
 * color.ts — Colour conversion and theme-switching utilities.
 *
 * WHAT THIS FILE DOES:
 * Provides two functions used throughout the app:
 *   1. `hexToOklch()` — converts a #rrggbb hex colour to an OKLCH colour string
 *      suitable for CSS custom properties (e.g. `--primary: 52.1% 0.132 142.3`)
 *   2. `applyTheme()` — switches the active theme by toggling a CSS class on <html>
 *      (e.g. `theme-dark`, `theme-herbal`) which overrides the :root token defaults
 *
 * WHY OKLCH?
 * OKLCH (Lightness, Chroma, Hue) is a perceptually uniform colour space — meaning
 * colours with the same L value look equally bright to the human eye. This gives
 * better contrast ratios and more consistent brand colours across dark/light themes.
 *
 * WHO USES THIS:
 *   ProfileContext.tsx — calls `hexToOklch()` to apply the business brand colour
 *   Layout.tsx — calls `hexToOklch()` to re-apply brand colour after profile edit
 *   UserPreferencesContext.tsx — calls `applyTheme()` on load and on theme change
 */

/**
 * hexToOklch — converts a 6-digit hex colour (#rrggbb) to an OKLCH string.
 * The result is intended for use in CSS custom properties.
 *
 * Example:
 *   hexToOklch("#2d7d32") → "52.1% 0.132 142.3"
 *
 * The conversion pipeline:
 *   1. Split hex into R, G, B channels (0–1 range)
 *   2. Apply gamma correction (sRGB → linear RGB)
 *   3. Convert linear RGB → XYZ (D65 illuminant)
 *   4. Convert XYZ → OKLab via a matrix transform
 *   5. Convert OKLab → OKLCH (polar form: L, chroma, hue angle)
 *
 * @param hex - A 6-digit hex colour string starting with "#"
 * @returns An OKLCH string of the form "L% C H" e.g. "52.1% 0.132 142.3"
 */
export function hexToOklch(hex: string): string {
  // Parse hex channels to 0–1 range
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

  // Step 1: gamma correction — convert sRGB to linear RGB
  const lr = r <= 0.04045 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4;
  const lg = g <= 0.04045 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4;
  const lb = b <= 0.04045 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4;

  // Step 2: linear RGB → XYZ (using D65 illuminant matrix)
  const x = lr * 0.4122214708 + lg * 0.5363325363 + lb * 0.0514459929;
  const y = lr * 0.2119034982 + lg * 0.6806995451 + lb * 0.1073969566;
  const z = lr * 0.0883024619 + lg * 0.2817188376 + lb * 0.6299787005;

  // Step 3: cube-root of each XYZ component (OKLab transform requires this)
  const cbrtX = Math.cbrt(x);
  const cbrtY = Math.cbrt(y);
  const cbrtZ = Math.cbrt(z);

  // Step 4: XYZ (cube-rooted) → OKLab via linear matrix
  const L = Math.max(
    0,
    0.2104542553 * cbrtX + 0.793617785 * cbrtY - 0.0040720468 * cbrtZ,
  );
  const a_ = 1.9779984951 * cbrtX - 2.428592205 * cbrtY + 0.4505937099 * cbrtZ;
  const b_ = 0.0259040371 * cbrtX + 0.7827717662 * cbrtY - 0.808675766 * cbrtZ;

  // Step 5: OKLab → OKLCH (convert Cartesian a,b to polar chroma,hue)
  const C = Math.sqrt(a_ * a_ + b_ * b_); // chroma = distance from neutral axis
  const h = (Math.atan2(b_, a_) * 180) / Math.PI; // hue = angle in degrees

  // Format: "L% C H" — L is a percentage, C and H are raw numbers
  return `${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${((h % 360) + 360) % 360}`;
}

/** The four supported UI theme names */
export type ThemeName = "herbal" | "dark" | "minimalist" | "punk";

/** All valid theme class names — used to strip any previous theme before applying new one */
const THEME_CLASSES: ThemeName[] = ["herbal", "dark", "minimalist", "punk"];

/**
 * applyTheme — switches the active UI theme by toggling a class on <html>.
 *
 * Each theme name maps to a CSS class (e.g. `theme-dark`) defined in index.css.
 * That class overrides the `:root` default token values with the correct OKLCH
 * colour set for that theme (background, card, muted, sidebar, etc.).
 *
 * IMPORTANT: This function removes ALL other theme classes first to prevent
 * multiple themes being active simultaneously.
 *
 * Profile brand colour (`--primary`) is applied SEPARATELY via `applyProfileBrandColor()`
 * and is NOT cleared by this function — so brand colour overlays survive theme changes.
 *
 * @param themeName - One of "herbal" | "dark" | "minimalist" | "punk"
 */
export function applyTheme(themeName: string): void {
  const root = document.documentElement;
  // Remove all existing theme classes before applying the new one
  for (const t of THEME_CLASSES) {
    root.classList.remove(`theme-${t}`);
  }
  // Apply the new theme class (validates it's a known theme first)
  const safe = themeName as ThemeName;
  if (THEME_CLASSES.includes(safe)) {
    root.classList.add(`theme-${safe}`);
  }
  // If the theme is unknown, no class is added — the :root defaults apply
}
