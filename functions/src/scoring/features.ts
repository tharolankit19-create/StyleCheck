/**
 * Turns raw Google Cloud Vision output into the structured outfit features the
 * score engine consumes. Pure & deterministic.
 */

import { DominantColor, summarizePalette } from "./color";

export interface VisionLabel {
  description: string;
  score: number; // 0-1 confidence
}

export interface VisionObject {
  name: string;
  score: number;
  /** Normalized bounding box (0-1) in image space. */
  box: { x: number; y: number; w: number; h: number };
}

export interface RawVision {
  labels: VisionLabel[];
  objects: VisionObject[];
  colors: DominantColor[];
  faceCount: number;
}

/** Formality axis: 0 = loungewear, 1 = black-tie. */
const FORMALITY_MAP: Record<string, number> = {
  gown: 0.98,
  tuxedo: 0.97,
  suit: 0.9,
  blazer: 0.82,
  "sport coat": 0.82,
  dress: 0.78,
  "dress shirt": 0.75,
  trousers: 0.7,
  loafer: 0.72,
  heel: 0.75,
  "dress shoe": 0.78,
  skirt: 0.66,
  cardigan: 0.55,
  sweater: 0.5,
  "polo shirt": 0.5,
  jeans: 0.42,
  denim: 0.42,
  "t-shirt": 0.32,
  hoodie: 0.25,
  sneaker: 0.35,
  sandal: 0.28,
  shorts: 0.28,
  sweatpants: 0.15,
  jersey: 0.2,
  tracksuit: 0.18,
  "tank top": 0.2,
  slipper: 0.08,
};

/** Category signal words → style label weights. */
const CATEGORY_SIGNALS: Record<string, string[]> = {
  Formalwear: ["suit", "tuxedo", "gown", "blazer", "dress shirt", "tie", "formal wear"],
  "Old Money": ["blazer", "loafer", "cardigan", "polo", "trench", "knit", "chino"],
  "Smart Casual": ["blazer", "chino", "shirt", "leather shoe", "loafer", "trousers"],
  Streetwear: ["hoodie", "sneaker", "cargo", "graphic", "oversized", "beanie", "puffer"],
  Athleisure: ["tracksuit", "jersey", "sweatpants", "legging", "sneaker", "activewear", "gym"],
  Minimalist: ["monochrome", "neutral", "plain", "turtleneck", "tailored"],
  Y2K: ["baggy", "low rise", "denim", "crop", "cargo", "trucker"],
  Casual: ["t-shirt", "jeans", "denim", "sneaker", "casual"],
};

const GARMENT_KEYWORDS = Object.keys(FORMALITY_MAP);

export interface OutfitFeatures {
  chromaticHues: number[];
  chromaticCount: number;
  neutralRatio: number;
  dominantColors: DominantColor[];
  /** Detected garment terms with formality values, deduped. */
  garments: { term: string; formality: number }[];
  /** Mean formality across detected garments, 0-1. */
  meanFormality: number;
  /** Spread (max-min) of formality — high spread = mismatched pieces. */
  formalitySpread: number;
  /** Vertical extent of detected clothing objects (proxy for full-body framing). */
  bodyCoverage: number;
  /** Silhouette top/bottom balance, 0-1 where ~0.5 is balanced. */
  proportion: number;
  faceCount: number;
  labelSet: string[];
}

function matchGarments(labels: VisionLabel[], objects: VisionObject[]) {
  const found = new Map<string, number>();
  const consider = [
    ...labels.filter((l) => l.score >= 0.6).map((l) => l.description.toLowerCase()),
    ...objects.filter((o) => o.score >= 0.5).map((o) => o.name.toLowerCase()),
  ];
  for (const text of consider) {
    for (const kw of GARMENT_KEYWORDS) {
      if (text.includes(kw)) {
        // Keep the highest-formality reading if a term appears twice.
        found.set(kw, FORMALITY_MAP[kw]);
      }
    }
  }
  return [...found.entries()].map(([term, formality]) => ({ term, formality }));
}

function estimateFraming(objects: VisionObject[], faceCount: number) {
  const clothing = objects.filter((o) =>
    /cloth|apparel|outerwear|dress|pant|shirt|shorts|skirt|footwear|shoe|coat|jacket|top/i.test(
      o.name,
    ),
  );
  if (clothing.length === 0) {
    return { bodyCoverage: faceCount > 0 ? 0.4 : 0.2, proportion: 0.5 };
  }
  const minY = Math.min(...clothing.map((o) => o.box.y));
  const maxY = Math.max(...clothing.map((o) => o.box.y + o.box.h));
  const bodyCoverage = Math.min(1, maxY - minY);

  // Split clothing above/below the vertical midpoint as a crude top/bottom balance.
  const mid = 0.5;
  let topArea = 0;
  let bottomArea = 0;
  for (const o of clothing) {
    const area = o.box.w * o.box.h;
    if (o.box.y + o.box.h / 2 < mid) topArea += area;
    else bottomArea += area;
  }
  const total = topArea + bottomArea;
  const proportion = total > 0 ? topArea / total : 0.5;
  return { bodyCoverage, proportion };
}

export function extractFeatures(raw: RawVision): OutfitFeatures {
  const palette = summarizePalette(raw.colors);
  const garments = matchGarments(raw.labels, raw.objects);

  const formalities = garments.map((g) => g.formality);
  const meanFormality =
    formalities.length > 0
      ? formalities.reduce((a, b) => a + b, 0) / formalities.length
      : 0.45;
  const formalitySpread =
    formalities.length > 1 ? Math.max(...formalities) - Math.min(...formalities) : 0;

  const { bodyCoverage, proportion } = estimateFraming(raw.objects, raw.faceCount);

  return {
    chromaticHues: palette.chromaticHues,
    chromaticCount: palette.chromaticCount,
    neutralRatio: palette.neutralRatio,
    dominantColors: palette.dominantColors,
    garments,
    meanFormality,
    formalitySpread,
    bodyCoverage,
    proportion,
    faceCount: raw.faceCount,
    labelSet: raw.labels.filter((l) => l.score >= 0.55).map((l) => l.description.toLowerCase()),
  };
}

/** Deterministically classify the outfit into a single style category. */
export function classifyCategory(features: OutfitFeatures): string {
  const haystack = [
    ...features.labelSet,
    ...features.garments.map((g) => g.term),
  ].join(" ");

  let best = "Casual";
  let bestScore = 0;
  for (const [category, signals] of Object.entries(CATEGORY_SIGNALS)) {
    let score = 0;
    for (const s of signals) if (haystack.includes(s)) score += 1;
    // Tie-break deterministically by category name length then alphabetical.
    if (score > bestScore || (score === bestScore && category < best && score > 0)) {
      best = category;
      bestScore = score;
    }
  }

  // Formality overrides refine the label at the extremes.
  if (features.meanFormality >= 0.85 && bestScore <= 1) return "Formalwear";
  if (features.meanFormality <= 0.22 && bestScore <= 1) return "Loungewear";
  if (features.chromaticCount === 0 && features.neutralRatio > 0.8) return "Minimalist";
  return best;
}
