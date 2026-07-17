/**
 * The witty critique template system.
 *
 * One line per analysis. Selection is deterministic: a stable hash of the
 * feature signature indexes into the pool for the relevant score band, so the
 * same image always yields the same line, while different images vary.
 */

import { OutfitFeatures } from "./features";
import { ScoreResult } from "./scoreEngine";

type Band = "brutal" | "rough" | "mid" | "solid" | "elite";

function bandFor(score: number): Band {
  if (score < 3.5) return "brutal";
  if (score < 5) return "rough";
  if (score < 6.5) return "mid";
  if (score < 8) return "solid";
  return "elite";
}

/**
 * Lines are grouped by band. Within a band, some lines are keyed to the weakest
 * dimension so the burn actually lands on what's wrong. Generic lines fill the rest.
 */
const LINES: Record<Band, string[]> = {
  brutal: [
    "This fit called in sick and came to work anyway.",
    "Getting dressed in the dark is a choice, and you made it.",
    "Somewhere a mirror is filing a complaint.",
    "You didn't get dressed, you got ambushed by laundry.",
    "This is what 'I have nothing to wear' looks like as a photo.",
  ],
  rough: [
    "There's an outfit in here somewhere, fighting to get out.",
    "Bold of you to leave the house this confident.",
    "The vibe is 'ran out of clean options,' and it shows.",
    "Half a good idea, wearing the other half's clothes.",
    "You're one decision away from this working. You made the other one.",
  ],
  mid: [
    "Perfectly fine. Nobody's screenshotting 'perfectly fine.'",
    "This fit is the human equivalent of room temperature.",
    "Safe. Very safe. Witness-protection safe.",
    "It works, the way a beige wall works.",
    "You're playing it so safe the fit fell asleep.",
  ],
  solid: [
    "Okay, this actually goes. Slightly annoying how easy you made it look.",
    "Genuinely put together — one tweak from a screenshot.",
    "This fit has a plan and it's mostly executing it.",
    "Sharp. You clearly checked a mirror and it approved.",
    "Real 'she gets ready with the lights on' energy.",
  ],
  elite: [
    "Okay, show-off. This is a whole moment.",
    "This is the fit other fits are jealous of.",
    "Effortless, expensive, slightly infuriating. Post it.",
    "You didn't get dressed, you got styled by fate.",
    "Screenshot this before you change your mind.",
  ],
};

/** Weakness-specific zingers layered on top of band lines for extra bite. */
const WEAKNESS_LINES: Record<string, string[]> = {
  colorHarmony: [
    "Your colors are in a group chat nobody muted.",
    "That palette needed one fewer opinion.",
  ],
  formalityCoherence: [
    "The top dressed for dinner, the bottom dressed for the couch.",
    "Pick a dress code and make the whole fit sign it.",
  ],
  paletteDiscipline: [
    "That's a lot of colors for one human silhouette.",
    "Retire two of those colors and you're instantly richer.",
  ],
  fitAndProportion: [
    "The proportions are negotiating and neither side is winning.",
    "Tailoring is free confidence you're leaving on the table.",
  ],
  framing: [
    "We'd rate higher if we could see the shoes — give us the full length.",
    "Half a photo, half a verdict.",
  ],
};

/** FNV-1a 32-bit hash — stable, fast, no dependencies. */
function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Build a stable signature from the features. Quantized so trivially-different
 * Vision readings of the same image collapse to the same signature.
 */
function featureSignature(features: OutfitFeatures, score: number): string {
  const hues = features.chromaticHues
    .map((h) => Math.round(h / 30))
    .sort((a, b) => a - b)
    .join(",");
  return [
    score.toFixed(1),
    features.chromaticCount,
    Math.round(features.neutralRatio * 10),
    Math.round(features.meanFormality * 10),
    Math.round(features.formalitySpread * 10),
    hues,
    features.garments
      .map((g) => g.term)
      .sort()
      .join("|"),
  ].join(":");
}

export function buildCritique(features: OutfitFeatures, result: ScoreResult): string {
  const band = bandFor(result.score);
  const sig = featureSignature(features, result.score);
  const h = hashString(sig);

  const bandPool = LINES[band];
  const weaknessPool = WEAKNESS_LINES[result.weakestDimension] ?? [];

  // For weak-scoring fits, ~40% of the time lead with the targeted zinger.
  const useWeakness =
    weaknessPool.length > 0 && result.score < 6.5 && h % 5 < 2;

  const pool = useWeakness ? weaknessPool : bandPool;
  return pool[h % pool.length];
}
