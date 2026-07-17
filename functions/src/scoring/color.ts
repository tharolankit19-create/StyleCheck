/**
 * Color math utilities for the scoring engine.
 *
 * Everything here is pure and deterministic: the same RGB inputs always produce
 * the same outputs. No Math.random, no Date, no external state.
 */

export interface Rgb {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface Hsv {
  h: number; // 0-360
  s: number; // 0-1
  v: number; // 0-1
}

/** A dominant color returned by Vision, normalized for our use. */
export interface DominantColor {
  rgb: Rgb;
  /** Fraction of the image this color covers, 0-1. */
  fraction: number;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : delta / max;
  const v = max;
  return { h, s, v };
}

/** Relative luminance (perceptual brightness), 0-1. */
export function luminance({ r, g, b }: Rgb): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** A color reads as "neutral" if it is desaturated (black/white/grey/beige). */
export function isNeutral(hsv: Hsv): boolean {
  return hsv.s < 0.18 || hsv.v < 0.12;
}

/** Smallest distance around the 360° hue wheel. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Harmony score for a palette of chromatic (non-neutral) hues, 0-1.
 *
 * Rewards recognizable relationships that stylists actually use:
 *  - monochrome (all hues within ~20°)
 *  - analogous (spread within ~60°)
 *  - complementary / split-complementary (a dominant pair ~150-210° apart)
 * Penalizes a scattered, "clown" spread of many unrelated hues.
 */
export function paletteHarmony(hues: number[]): number {
  if (hues.length === 0) return 0.72; // all-neutral palettes are safe & clean
  if (hues.length === 1) return 0.9;

  const sorted = [...hues].sort((a, b) => a - b);

  // Largest gap on the wheel → the arc the colors actually occupy.
  let maxGap = 360 - (sorted[sorted.length - 1] - sorted[0]);
  for (let i = 1; i < sorted.length; i++) {
    maxGap = Math.max(maxGap, sorted[i] - sorted[i - 1]);
  }
  const spread = 360 - maxGap; // arc occupied by the palette

  if (spread <= 22) return 0.95; // monochrome
  if (spread <= 60) return 0.88; // analogous

  // Complementary / split-complementary: check the two most prominent hues.
  const pairDist = hueDistance(hues[0], hues[1]);
  if (pairDist >= 150 && pairDist <= 210) {
    return hues.length <= 3 ? 0.86 : 0.7;
  }

  // Triadic-ish, evenly spaced 3.
  if (hues.length === 3) {
    const dists = [
      hueDistance(sorted[0], sorted[1]),
      hueDistance(sorted[1], sorted[2]),
      hueDistance(sorted[2], sorted[0]),
    ];
    const even = dists.every((d) => Math.abs(d - 120) < 40);
    if (even) return 0.78;
  }

  // Otherwise: the wider and busier the spread, the messier it reads.
  const spreadPenalty = Math.min(1, spread / 300);
  const countPenalty = Math.min(1, (hues.length - 2) / 4);
  return Math.max(0.32, 0.75 - 0.3 * spreadPenalty - 0.18 * countPenalty);
}

/**
 * Convert Vision dominant colors into a compact, weighted palette:
 *  - keeps colors above a coverage floor
 *  - separates neutrals from chromatic hues
 *  - orders chromatic hues by prominence
 */
export function summarizePalette(colors: DominantColor[]) {
  const significant = colors
    .filter((c) => c.fraction >= 0.03)
    .sort((a, b) => b.fraction - a.fraction);

  const chromatic: { hue: number; fraction: number }[] = [];
  let neutralFraction = 0;
  let totalFraction = 0;

  for (const c of significant) {
    const hsv = rgbToHsv(c.rgb);
    totalFraction += c.fraction;
    if (isNeutral(hsv)) {
      neutralFraction += c.fraction;
    } else {
      chromatic.push({ hue: hsv.h, fraction: c.fraction });
    }
  }

  const neutralRatio = totalFraction > 0 ? neutralFraction / totalFraction : 1;
  return {
    chromaticHues: chromatic.map((c) => c.hue),
    chromaticCount: chromatic.length,
    neutralRatio,
    dominantColors: significant.slice(0, 5),
  };
}
