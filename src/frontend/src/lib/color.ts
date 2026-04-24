/**
 * Converts a 6-digit hex color string (#rrggbb) to an OKLCH color string
 * suitable for use in CSS custom properties.
 */
export function hexToOklch(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;

  const lr = r <= 0.04045 ? r / 12.92 : ((r + 0.055) / 1.055) ** 2.4;
  const lg = g <= 0.04045 ? g / 12.92 : ((g + 0.055) / 1.055) ** 2.4;
  const lb = b <= 0.04045 ? b / 12.92 : ((b + 0.055) / 1.055) ** 2.4;

  const x = lr * 0.4122214708 + lg * 0.5363325363 + lb * 0.0514459929;
  const y = lr * 0.2119034982 + lg * 0.6806995451 + lb * 0.1073969566;
  const z = lr * 0.0883024619 + lg * 0.2817188376 + lb * 0.6299787005;

  const cbrtX = Math.cbrt(x);
  const cbrtY = Math.cbrt(y);
  const cbrtZ = Math.cbrt(z);

  const L = Math.max(
    0,
    0.2104542553 * cbrtX + 0.793617785 * cbrtY - 0.0040720468 * cbrtZ,
  );
  const a_ = 1.9779984951 * cbrtX - 2.428592205 * cbrtY + 0.4505937099 * cbrtZ;
  const b_ = 0.0259040371 * cbrtX + 0.7827717662 * cbrtY - 0.808675766 * cbrtZ;

  const C = Math.sqrt(a_ * a_ + b_ * b_);
  const h = (Math.atan2(b_, a_) * 180) / Math.PI;

  return `${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${((h % 360) + 360) % 360}`;
}
