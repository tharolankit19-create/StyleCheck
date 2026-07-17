/**
 * The deterministic scoring engine.
 *
 * Contract (from the product spec):
 *   Same image  ==>  same features  ==>  same score, ALWAYS.
 *
 * There is no randomness anywhere in this file. The score is a pure function of
 * the detected features. Determinism across identical images is additionally
 * guaranteed upstream by caching on the image's SHA-256 (see analyzeOutfit.ts).
 */

import { OutfitFeatures } from "./features";
import { paletteHarmony } from "./color";

export interface ScoreBreakdown {
  colorHarmony: number; // 0-1
  paletteDiscipline: number; // 0-1
  formalityCoherence: number; // 0-1
  fitAndProportion: number; // 0-1
  framing: number; // 0-1
}

export interface ScoreResult {
  /** Final score, 2.0-9.0, rounded to one decimal. */
  score: number;
  breakdown: ScoreBreakdown;
  /** Human-readable weighted sub-scores for the premium breakdown screen. */
  detail: {
    label: string;
    value: number; // 0-100
    weight: number; // 0-1
    note: string;
  }[];
  /** The single weakest dimension — drives critique selection. */
  weakestDimension: keyof ScoreBreakdown;
}

const WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  colorHarmony: 0.3,
  paletteDiscipline: 0.18,
  formalityCoherence: 0.24,
  fitAndProportion: 0.16,
  framing: 0.12,
};

const MIN_SCORE = 2.0;
const MAX_SCORE = 9.0;

function paletteDiscipline(features: OutfitFeatures): number {
  // Reward a controlled number of colors and a healthy neutral anchor.
  const loudCount = features.chromaticCount;
  let base: number;
  if (loudCount <= 1) base = 0.9;
  else if (loudCount === 2) base = 0.85;
  else if (loudCount === 3) base = 0.68;
  else base = Math.max(0.3, 0.68 - 0.12 * (loudCount - 3));

  // Neutrals stabilize an outfit; a total absence of them with loud colors reads busy.
  const neutralBonus = features.neutralRatio * 0.12;
  const noAnchorPenalty = loudCount >= 3 && features.neutralRatio < 0.25 ? 0.12 : 0;
  return clamp01(base + neutralBonus - noAnchorPenalty);
}

function formalityCoherence(features: OutfitFeatures): number {
  // Low spread across pieces = coherent register. High spread = mismatched.
  // A blazer with sweatpants (spread ~0.67) should read poorly.
  const spread = features.formalitySpread;
  const coherence = 1 - Math.min(1, spread / 0.6);
  // Very few detected garments → we can't fault coherence, keep it neutral-high.
  if (features.garments.length <= 1) return 0.7;
  return clamp01(0.25 + 0.75 * coherence);
}

function fitAndProportion(features: OutfitFeatures): number {
  // Closer to a balanced 0.5 top/bottom split reads as intentional proportion.
  const balance = 1 - Math.min(1, Math.abs(features.proportion - 0.5) / 0.5);
  return clamp01(0.45 + 0.55 * balance);
}

function framing(features: OutfitFeatures): number {
  // Full-body shots (the app's ask) score the framing dimension higher.
  const coverage = clamp01(features.bodyCoverage);
  const facePresent = features.faceCount > 0 ? 0.1 : 0;
  return clamp01(0.35 + 0.55 * coverage + facePresent);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function scoreOutfit(features: OutfitFeatures): ScoreResult {
  const breakdown: ScoreBreakdown = {
    colorHarmony: clamp01(paletteHarmony(features.chromaticHues)),
    paletteDiscipline: paletteDiscipline(features),
    formalityCoherence: formalityCoherence(features),
    fitAndProportion: fitAndProportion(features),
    framing: framing(features),
  };

  let weighted = 0;
  (Object.keys(WEIGHTS) as (keyof ScoreBreakdown)[]).forEach((k) => {
    weighted += breakdown[k] * WEIGHTS[k];
  });

  // Map the 0-1 composite onto the 2.0-9.0 band with a mild S-curve so the
  // middle of the range is expressive and extremes are rare but reachable.
  const shaped = sCurve(weighted);
  const raw = MIN_SCORE + shaped * (MAX_SCORE - MIN_SCORE);
  const score = Math.round(raw * 10) / 10;

  const weakestDimension = (Object.keys(breakdown) as (keyof ScoreBreakdown)[]).reduce(
    (min, k) => (breakdown[k] < breakdown[min] ? k : min),
  );

  const detail = [
    {
      label: "Color Harmony",
      value: Math.round(breakdown.colorHarmony * 100),
      weight: WEIGHTS.colorHarmony,
      note: colorNote(breakdown.colorHarmony),
    },
    {
      label: "Palette Discipline",
      value: Math.round(breakdown.paletteDiscipline * 100),
      weight: WEIGHTS.paletteDiscipline,
      note: paletteNote(features),
    },
    {
      label: "Formality Match",
      value: Math.round(breakdown.formalityCoherence * 100),
      weight: WEIGHTS.formalityCoherence,
      note: formalityNote(breakdown.formalityCoherence),
    },
    {
      label: "Fit & Proportion",
      value: Math.round(breakdown.fitAndProportion * 100),
      weight: WEIGHTS.fitAndProportion,
      note: fitNote(breakdown.fitAndProportion),
    },
    {
      label: "Framing",
      value: Math.round(breakdown.framing * 100),
      weight: WEIGHTS.framing,
      note: framingNote(breakdown.framing),
    },
  ];

  return { score, breakdown, detail, weakestDimension };
}

/** Gentle logistic centered at 0.5, keeps output in [0,1]. */
function sCurve(x: number): number {
  const k = 6;
  const raw = 1 / (1 + Math.exp(-k * (x - 0.5)));
  const lo = 1 / (1 + Math.exp(-k * (0 - 0.5)));
  const hi = 1 / (1 + Math.exp(-k * (1 - 0.5)));
  return (raw - lo) / (hi - lo);
}

function colorNote(v: number): string {
  if (v >= 0.85) return "Your palette is locked in — colors talk to each other.";
  if (v >= 0.6) return "Colors mostly agree, with one note slightly off-key.";
  return "The colors are having different conversations.";
}
function paletteNote(f: OutfitFeatures): string {
  if (f.chromaticCount >= 4) return "Four-plus loud colors is a lot to ask a fit to carry.";
  if (f.neutralRatio > 0.7) return "Neutrals doing quiet, expensive-looking work.";
  return "Tight color count — disciplined and intentional.";
}
function formalityNote(v: number): string {
  if (v >= 0.8) return "Every piece is speaking the same dress code.";
  if (v >= 0.5) return "One piece is dressed for a different event.";
  return "Top and bottom RSVP'd to two different parties.";
}
function fitNote(v: number): string {
  if (v >= 0.75) return "Proportions read deliberate.";
  if (v >= 0.5) return "Silhouette is fine, not yet architectural.";
  return "The proportions are fighting your frame.";
}
function framingNote(v: number): string {
  if (v >= 0.75) return "Clean full-length shot — we can see the whole story.";
  return "Next time give us the full length; shoes finish the sentence.";
}
