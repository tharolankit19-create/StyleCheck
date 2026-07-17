import { describe, it, expect } from "vitest";
import { extractFeatures, classifyCategory, RawVision } from "./features";
import { scoreOutfit } from "./scoreEngine";
import { buildCritique } from "./critique";

function make(partial: Partial<RawVision>): RawVision {
  return {
    labels: [],
    objects: [],
    colors: [],
    faceCount: 0,
    ...partial,
  };
}

const cohesiveNavyFit = make({
  colors: [
    { rgb: { r: 30, g: 40, b: 70 }, fraction: 0.45 }, // navy
    { rgb: { r: 20, g: 20, b: 20 }, fraction: 0.3 }, // near-black neutral
    { rgb: { r: 200, g: 200, b: 200 }, fraction: 0.15 }, // grey neutral
  ],
  labels: [
    { description: "Blazer", score: 0.9 },
    { description: "Trousers", score: 0.85 },
    { description: "Dress shoe", score: 0.8 },
  ],
  objects: [
    { name: "Outerwear", score: 0.9, box: { x: 0.3, y: 0.15, w: 0.4, h: 0.35 } },
    { name: "Pants", score: 0.9, box: { x: 0.32, y: 0.5, w: 0.36, h: 0.4 } },
    { name: "Footwear", score: 0.8, box: { x: 0.35, y: 0.9, w: 0.3, h: 0.08 } },
  ],
  faceCount: 1,
});

const clashingFit = make({
  colors: [
    { rgb: { r: 220, g: 30, b: 30 }, fraction: 0.3 }, // red
    { rgb: { r: 30, g: 200, b: 40 }, fraction: 0.25 }, // green
    { rgb: { r: 240, g: 210, b: 20 }, fraction: 0.22 }, // yellow
    { rgb: { r: 40, g: 60, b: 220 }, fraction: 0.2 }, // blue
  ],
  labels: [
    { description: "Hoodie", score: 0.9 },
    { description: "Trousers", score: 0.85 },
  ],
  objects: [
    { name: "Top", score: 0.9, box: { x: 0.3, y: 0.2, w: 0.4, h: 0.3 } },
    { name: "Pants", score: 0.9, box: { x: 0.32, y: 0.55, w: 0.36, h: 0.4 } },
  ],
  faceCount: 1,
});

describe("scoring engine", () => {
  it("is deterministic: same input yields identical score", () => {
    const a = scoreOutfit(extractFeatures(cohesiveNavyFit)).score;
    const b = scoreOutfit(extractFeatures(cohesiveNavyFit)).score;
    expect(a).toBe(b);
  });

  it("scores a cohesive, coherent fit higher than a clashing one", () => {
    const good = scoreOutfit(extractFeatures(cohesiveNavyFit)).score;
    const bad = scoreOutfit(extractFeatures(clashingFit)).score;
    expect(good).toBeGreaterThan(bad);
  });

  it("keeps scores within the 2.0-9.0 band", () => {
    for (const fit of [cohesiveNavyFit, clashingFit, make({})]) {
      const s = scoreOutfit(extractFeatures(fit)).score;
      expect(s).toBeGreaterThanOrEqual(2.0);
      expect(s).toBeLessThanOrEqual(9.0);
    }
  });

  it("rounds to one decimal place", () => {
    const s = scoreOutfit(extractFeatures(cohesiveNavyFit)).score;
    expect(Math.round(s * 10)).toBe(s * 10);
  });

  it("produces a stable critique for the same features", () => {
    const f = extractFeatures(clashingFit);
    const r = scoreOutfit(f);
    expect(buildCritique(f, r)).toBe(buildCritique(f, r));
  });

  it("classifies a suit-like fit as formal-leaning", () => {
    const category = classifyCategory(extractFeatures(cohesiveNavyFit));
    expect(["Formalwear", "Smart Casual", "Old Money"]).toContain(category);
  });
});
