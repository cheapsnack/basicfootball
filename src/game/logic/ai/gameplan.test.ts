import { describe, expect, it } from "vitest";
import { GAMEPLAN_TUNING, matchProgress, planMentality } from "./gameplan";

describe("planMentality", () => {
  it("starts balanced on every difficulty", () => {
    for (const d of ["beginner", "amateur", "advanced", "expert"] as const) {
      expect(planMentality(d, 0, 0)).toBe("balanced");
    }
  });

  it("chases a one-goal deficit late, earlier on harder difficulties", () => {
    expect(planMentality("expert", -1, 0.5)).toBe("attacking");
    expect(planMentality("expert", -1, 0.3)).toBe("balanced");
    expect(planMentality("beginner", -1, 0.5)).toBe("balanced");
    expect(planMentality("beginner", -1, 0.85)).toBe("attacking");
  });

  it("chases a two-goal deficit sooner than a one-goal one", () => {
    const p = GAMEPLAN_TUNING.advanced;
    expect(p.chaseTwoAfter).toBeLessThan(p.chaseAfter);
    expect(planMentality("advanced", -2, p.chaseTwoAfter)).toBe("attacking");
    expect(planMentality("advanced", -1, p.chaseTwoAfter)).toBe("balanced");
  });

  it("protects a lead late; Beginner never parks the bus", () => {
    expect(planMentality("expert", 1, 0.8)).toBe("defensive");
    expect(planMentality("expert", 1, 0.5)).toBe("balanced");
    expect(planMentality("expert", 2, 0.55)).toBe("defensive");
    expect(planMentality("beginner", 3, 1)).toBe("balanced");
  });

  it("goes for it when level and late only on the top difficulties", () => {
    expect(planMentality("expert", 0, 0.9)).toBe("attacking");
    expect(planMentality("advanced", 0, 0.95)).toBe("attacking");
    expect(planMentality("amateur", 0, 0.99)).toBe("balanced");
    expect(planMentality("beginner", 0, 0.99)).toBe("balanced");
  });

  it("clamps progress", () => {
    expect(planMentality("expert", -1, 5)).toBe("attacking");
    expect(planMentality("expert", -1, -1)).toBe("balanced");
  });
});

describe("matchProgress", () => {
  it("maps the clock to 0..1 across regulation and pins extra time at 1", () => {
    expect(matchProgress(1, 0, 2, 180)).toBe(0);
    expect(matchProgress(1, 90, 2, 180)).toBeCloseTo(0.25);
    expect(matchProgress(2, 90, 2, 180)).toBeCloseTo(0.75);
    expect(matchProgress(2, 180, 2, 180)).toBe(1);
    expect(matchProgress(3, 10, 2, 180)).toBe(1);
  });
});
