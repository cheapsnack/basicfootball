import { describe, expect, it } from "vitest";
import type { Kinematics } from "../types";
import { laneBlocked, PASS_TUNING, passAimDirection, selectPassTarget } from "./passing";

const body = (x: number, z: number, heading = 0, vx = 0, vz = 0): Kinematics => ({
  position: { x, y: 0, z },
  velocity: { x: vx, y: 0, z: vz },
  heading,
});
const facingPlusX = Math.PI / 2; // heading π/2 → (sin, -cos) = (1, 0)

describe("passAimDirection", () => {
  it("uses the stick when pushed, the facing when idle", () => {
    const p = body(0, 0, facingPlusX);
    expect(passAimDirection(p, { x: 0, z: -1 })).toEqual({ x: 0, z: -1 });
    const idle = passAimDirection(p, { x: 0, z: 0 });
    expect(idle.x).toBeCloseTo(1);
    expect(idle.z).toBeCloseTo(0);
  });
});

describe("laneBlocked", () => {
  it("flags an opponent sitting on the line, ignores one beside it or at either end", () => {
    const from = { x: 0, z: 0 };
    const to = { x: 20, z: 0 };
    expect(laneBlocked(from, to, [body(10, 0)])).toBe(true);
    expect(laneBlocked(from, to, [body(10, 3)])).toBe(false);
    expect(laneBlocked(from, to, [body(0.5, 0)])).toBe(false);
    expect(laneBlocked(from, to, [body(19.8, 0)])).toBe(false);
  });
});

describe("selectPassTarget", () => {
  const passer = body(0, 0, facingPlusX);

  it("picks the teammate in the direction being pushed over the nearest one", () => {
    const mates = [passer, body(8, 0), body(0, -12)]; // one ahead (+x), one up (-z)
    const up = selectPassTarget(passer, { x: 0, z: -1 }, mates, 0, [], 1);
    expect(up?.index).toBe(2);
    const ahead = selectPassTarget(passer, { x: 1, z: 0 }, mates, 0, [], 1);
    expect(ahead?.index).toBe(1);
  });

  it("prefers a clear lane over a blocked one at similar distance and angle", () => {
    const mates = [passer, body(14, 2), body(14, -2)];
    const blocker = body(7, 2); // sits on the line to mate 1
    const c = selectPassTarget(passer, { x: 1, z: 0 }, mates, 0, [blocker], 1);
    expect(c?.index).toBe(2);
  });

  it("ignores teammates behind, on top, sent off, or beyond range", () => {
    const mates = [passer, body(-10, 0), body(0.5, 0), body(60, 0), body(12, 0)];
    const c = selectPassTarget(passer, { x: 1, z: 0 }, mates, 0, [], 1, "pass", new Set([4]));
    expect(c).toBeNull();
    const c2 = selectPassTarget(passer, { x: 1, z: 0 }, mates, 0, [], 1);
    expect(c2?.index).toBe(4);
  });

  it("leads a moving receiver", () => {
    const runner = body(12, 0, 0, 0, -6);
    const c = selectPassTarget(passer, { x: 1, z: 0 }, [passer, runner], 0, [], 1);
    expect(c?.aim.z).toBeCloseTo(-6 * PASS_TUNING.leadTime);
    expect(c?.powerMult).toBe(1);
  });

  it("through ball aims into space toward goal and hits harder", () => {
    const runner = body(12, 0, 0, 6, 0);
    const c = selectPassTarget(passer, { x: 1, z: 0 }, [passer, runner], 0, [], 1, "through");
    const expected = 12 + 6 * PASS_TUNING.through.leadTime + PASS_TUNING.through.spaceAhead;
    expect(c?.aim.x).toBeCloseTo(expected);
    expect(c?.powerMult).toBe(PASS_TUNING.through.powerMult);
    // attacking the other way, the space is on the other side
    const back = selectPassTarget(
      body(0, 0, -facingPlusX),
      { x: -1, z: 0 },
      [passer, body(-12, 0)],
      0,
      [],
      -1,
      "through",
    );
    expect(back?.aim.x).toBeLessThan(-12);
  });

  it("through ball favours the forward runner over the safe square option", () => {
    const square = body(2, -10); // beside, not forward
    const forward = body(16, -3, 0, 5, 0);
    const c = selectPassTarget(
      passer,
      { x: 0.5, z: -0.86 },
      [passer, square, forward],
      0,
      [],
      1,
      "through",
    );
    expect(c?.index).toBe(2);
    const normal = selectPassTarget(
      passer,
      { x: 0.5, z: -0.86 },
      [passer, square, forward],
      0,
      [],
      1,
      "pass",
    );
    expect(normal?.index).toBe(1);
  });

  it("clamps the aim inside the pitch", () => {
    const wide = body(40, 0, 0, 8, 0); // led + space would land at 53.2
    const c = selectPassTarget(
      passer,
      { x: 1, z: 0 },
      [passer, wide],
      0,
      [],
      1,
      "through",
      new Set(),
      { halfLength: 52.5, halfWidth: 34 },
    );
    expect(c?.aim.x).toBeLessThanOrEqual(51.5);
  });
});
