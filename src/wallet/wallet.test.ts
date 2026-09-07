import { describe, it, expect } from "vitest";
import { applyRule, matchRule } from "@/wallet/wallet";
import type { EarningRule } from "@/lib/types";

const rules: EarningRule[] = [
  { id: "a", exercise: "pushup", reps: 1, minutes: 1, enabled: true, createdAt: 0 },
  { id: "b", exercise: "pushup", reps: 10, minutes: 15, enabled: true, createdAt: 0 },
  { id: "c", exercise: "squat", reps: 20, minutes: 20, enabled: true, createdAt: 0 },
  { id: "d", exercise: "pushup", reps: 5, minutes: 5, enabled: false, createdAt: 0 },
];

describe("wallet matching", () => {
  it("picks the largest matching rule per exercise", () => {
    expect(matchRule(rules, "pushup", 11)?.rule.id).toBe("b");
    expect(matchRule(rules, "pushup", 5)?.rule.id).toBe("a");
    expect(matchRule(rules, "squat", 20)?.rule.id).toBe("c");
    expect(matchRule(rules, "squat", 5)).toBeNull();
  });

  it("skips disabled rules", () => {
    expect(matchRule(rules, "pushup", 5)?.rule.id).toBe("a");
    expect(matchRule(rules.filter(r => r.id === "d"), "pushup", 5)).toBeNull();
  });

  it("applies per-rep minutes when matching a higher rule", () => {
    const { matchedRule, earnedSeconds } = applyRule(rules, "pushup", 10);
    expect(matchedRule?.id).toBe("b");
    expect(earnedSeconds).toBe(10 * 1.5 * 60);
  });
});