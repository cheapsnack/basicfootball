import { describe, expect, it } from "vitest";
import type { Kinematics } from "../types";
import { MOVEMENT_TUNING, paramsFromAttributes } from "./movement";
import {
  applyStamina,
  canSprint,
  FULL_STAMINA,
  gateSprint,
  recoverAtBreak,
  STAMINA_TUNING,
  staminaSpeedMult,
  stepStamina,
} from "./stamina";

const body = (speed = 0): Kinematics => ({
  position: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: -speed },
  heading: 0,
});
const sprint = { x: 0, z: -1, sprint: true };
const jog = { x: 0, z: -1, sprint: false };
const still = { x: 0, z: 0, sprint: false };
const T = STAMINA_TUNING;

function run(s = FULL_STAMINA, input = sprint, seconds = 1, speed = 7) {
  let cur = s;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt)
    cur = stepStamina(cur, gateSprint(input, cur), body(speed), dt);
  return cur;
}

describe("stamina tank", () => {
  it("sprinting drains, standing still refills", () => {
    const tired = run(FULL_STAMINA, sprint, 3);
    expect(tired.tank).toBeLessThan(1);
    expect(tired.tank).toBeCloseTo(1 - T.sprintDrain * 3, 1);
    const rested = run(tired, still, 3, 0);
    expect(rested.tank).toBeGreaterThan(tired.tank);
  });

  it("a full tank hits the sprint cutoff after roughly eight seconds flat out", () => {
    const secondsToCutoff = (1 - T.sprintCutoff) / T.sprintDrain;
    expect(secondsToCutoff).toBeGreaterThan(7);
    expect(secondsToCutoff).toBeLessThan(10);
    const s = run(FULL_STAMINA, sprint, secondsToCutoff + 0.5);
    expect(s.lockedOut).toBe(true);
    expect(s.tank).toBeLessThanOrEqual(T.sprintCutoff + 0.02);
  });

  it("walking recovers, running drains a trickle", () => {
    const half = { tank: 0.5, lockedOut: false };
    expect(run(half, jog, 2, 1.5).tank).toBeGreaterThan(0.5);
    expect(run(half, jog, 2, 6).tank).toBeLessThan(0.5);
  });

  it("locks sprint out below the cutoff and resumes above the hysteresis mark", () => {
    const empty = run(FULL_STAMINA, sprint, 12);
    expect(canSprint(empty)).toBe(false);
    expect(gateSprint(sprint, empty).sprint).toBe(false);
    // Just above cutoff but below resume: still locked out.
    const partial = run(empty, still, (T.sprintCutoff + 0.05) / T.idleRecover, 0);
    expect(partial.tank).toBeGreaterThan(T.sprintCutoff);
    expect(canSprint(partial)).toBe(false);
    const ready = run(partial, still, 20, 0);
    expect(canSprint(ready)).toBe(true);
  });

  it("gated input stops draining once locked out", () => {
    const empty = run(FULL_STAMINA, sprint, 12);
    const after = stepStamina(empty, gateSprint(sprint, empty), body(6), 1);
    // gated to a jog: trickle drain only, so still ≥ 0 and not sprint-rate
    expect(after.tank).toBeGreaterThanOrEqual(0);
    expect(empty.tank - after.tank).toBeLessThanOrEqual(T.runDrain + 1e-9);
  });

  it("returns the same reference when nothing changes (full tank, standing)", () => {
    expect(stepStamina(FULL_STAMINA, still, body(0), 1 / 60)).toBe(FULL_STAMINA);
  });
});

describe("stamina → movement", () => {
  const params = paramsFromAttributes({ pace: 70, dribble: 70 });

  it("fresh players keep the exact same params object", () => {
    expect(applyStamina(params, FULL_STAMINA)).toBe(params);
    expect(applyStamina(params, { tank: T.fadeStart, lockedOut: false })).toBe(params);
  });

  it("empty tank slows to minSpeedMult, never below", () => {
    expect(staminaSpeedMult({ tank: 0, lockedOut: true })).toBeCloseTo(T.minSpeedMult);
    const slow = applyStamina(params, { tank: 0, lockedOut: true });
    expect(slow.maxSpeed).toBeCloseTo(params.maxSpeed * T.minSpeedMult);
    expect(slow.accel).toBeCloseTo(params.accel * T.minSpeedMult);
    expect(slow.sprintMult).toBe(MOVEMENT_TUNING.sprintMult);
  });

  it("fade is monotonic between empty and fadeStart", () => {
    let prev = 0;
    for (let tank = 0; tank <= T.fadeStart; tank += 0.05) {
      const m = staminaSpeedMult({ tank, lockedOut: false });
      expect(m).toBeGreaterThanOrEqual(prev);
      prev = m;
    }
  });
});

describe("half time", () => {
  it("tops the tank up and clears a lockout once above the resume mark", () => {
    const empty = { tank: 0.05, lockedOut: true };
    const rested = recoverAtBreak(empty);
    expect(rested.tank).toBeCloseTo(0.05 + T.halfTimeRecover);
    expect(rested.lockedOut).toBe(false);
    expect(recoverAtBreak(FULL_STAMINA).tank).toBe(1);
  });
});
