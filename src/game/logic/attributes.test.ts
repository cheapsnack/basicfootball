import { describe, expect, it } from "vitest";
import type { BallState, ChargeState, Kinematics } from "../types";
import { BALL_RADIUS, STRIKE_TUNING } from "./ballPhysics";
import { ATTR_NEUTRAL, attrNorm, attrSigned, NEUTRAL_ATTRIBUTES } from "./attributes";
import {
  aiShotFromAttributes,
  NEUTRAL_STRIKE_PARAMS,
  resolveStrike,
  strikeParamsFromAttributes,
} from "./striking";
import {
  attemptTackleImpulse,
  detectFoulOnOpponent,
  NEUTRAL_TACKLE_PARAMS,
  TACKLE_TUNING,
  tackleParamsFromAttributes,
} from "./tackle";
import {
  POSSESSION_TUNING,
  shieldFromAttributes,
  stealReachFromAttributes,
  trySteal,
} from "./possession";
import {
  KEEPER_TUNING,
  keeperParamsFromAttributes,
  NEUTRAL_KEEPER_PARAMS,
  stepGoalkeeper,
  tryKeeperSave,
} from "./ai/goalkeeper";
import { goalLineX } from "./field";

const body = (x: number, z: number, heading = 0, vx = 0, vz = 0): Kinematics => ({
  position: { x, y: 0, z },
  velocity: { x: vx, y: 0, z: vz },
  heading,
});
const ballAt = (x: number, z: number, vx = 0, vz = 0, y = BALL_RADIUS): BallState => ({
  position: { x, y, z },
  velocity: { x: vx, y: 0, z: vz },
  heading: 0,
  spin: 0,
});
const full = (action: "shoot" | "pass", loft = false): ChargeState => ({
  action,
  power: 1,
  elapsed: 1,
  loft,
});
/** Every attribute at the same rating, or at its own neutral point for "mid". */
const at = (v: number | "mid") =>
  v === "mid"
    ? { ...NEUTRAL_ATTRIBUTES }
    : { ...NEUTRAL_ATTRIBUTES, shot: v, pass: v, defend: v, dribble: v, gk: v };
const constantRng = (v: number) => () => v;

describe("attribute scale helpers", () => {
  it("normalises 1–99 to 0..1 and the neutral point to exactly 0 signed", () => {
    expect(attrNorm(99)).toBe(1);
    expect(attrNorm(0)).toBe(0);
    for (const k of ["shot", "pass", "defend", "dribble", "gk"] as const) {
      expect(attrSigned(k, ATTR_NEUTRAL[k])).toBe(0);
      expect(attrSigned(k, 99)).toBe(1);
      expect(attrSigned(k, 1)).toBe(-1);
      expect(attrSigned(k, ATTR_NEUTRAL[k] + 1)).toBeGreaterThan(0);
      expect(attrSigned(k, ATTR_NEUTRAL[k] - 1)).toBeLessThan(0);
    }
  });

  it("neutral points sit inside the roster's range so both tails are reachable", () => {
    for (const k of ["shot", "pass", "defend", "dribble", "gk"] as const) {
      expect(ATTR_NEUTRAL[k]).toBeGreaterThan(1);
      expect(ATTR_NEUTRAL[k]).toBeLessThan(99);
    }
  });
});

describe("shot / pass attributes", () => {
  it("neutral-rated is exactly the neutral params (no drift)", () => {
    expect(strikeParamsFromAttributes(at("mid"))).toEqual(NEUTRAL_STRIKE_PARAMS);
  });

  it("resolveStrike with neutral params matches the no-params call exactly", () => {
    const p = body(0, 0, 0, 2, 0);
    const a = resolveStrike(p, full("shoot"), { x: 30, z: 0 });
    const b = resolveStrike(
      p,
      full("shoot"),
      { x: 30, z: 0 },
      NEUTRAL_STRIKE_PARAMS,
      constantRng(0.5),
    );
    expect(b).toEqual(a);
  });

  it("shot=99 strikes strictly harder than shot=1 at equal charge", () => {
    const p = body(0, 0);
    const hi = resolveStrike(
      p,
      full("shoot"),
      undefined,
      strikeParamsFromAttributes(at(99)),
      constantRng(0.5),
    );
    const lo = resolveStrike(
      p,
      full("shoot"),
      undefined,
      strikeParamsFromAttributes(at(1)),
      constantRng(0.5),
    );
    const mid = resolveStrike(p, full("shoot"));
    expect(hi.speed).toBeGreaterThan(mid.speed);
    expect(mid.speed).toBeGreaterThan(lo.speed);
    expect(hi.speed).toBeLessThanOrEqual(STRIKE_TUNING.shot.maxSpeed * 1.35);
  });

  it("shot=1 scatters aim; neutral and above do not", () => {
    const p = body(0, 0); // heading 0 → faces -z
    const lo = resolveStrike(
      p,
      full("shoot"),
      undefined,
      strikeParamsFromAttributes(at(1)),
      constantRng(1),
    );
    const mid = resolveStrike(
      p,
      full("shoot"),
      undefined,
      strikeParamsFromAttributes(at("mid")),
      constantRng(1),
    );
    const hi = resolveStrike(
      p,
      full("shoot"),
      undefined,
      strikeParamsFromAttributes(at(99)),
      constantRng(1),
    );
    expect(Math.abs(lo.direction.x)).toBeGreaterThan(0.05);
    expect(Math.abs(mid.direction.x)).toBeLessThan(1e-9);
    expect(Math.abs(hi.direction.x)).toBeLessThan(1e-9);
  });

  it("pass=99 bends further toward the target than neutral", () => {
    // Facing -z with a teammate 45° off to the right.
    const p = body(0, 0, 0);
    const target = { x: 10, z: -10 };
    const mid = resolveStrike(p, full("pass"), target, NEUTRAL_STRIKE_PARAMS, constantRng(0.5));
    const hi = resolveStrike(
      p,
      full("pass"),
      target,
      strikeParamsFromAttributes(at(99)),
      constantRng(0.5),
    );
    expect(hi.direction.x).toBeGreaterThan(mid.direction.x);
  });

  it("AI shot composes with difficulty: better attribute → higher accuracy and power", () => {
    const hi = aiShotFromAttributes(0.6, 18, at(99));
    const mid = aiShotFromAttributes(0.6, 18, at("mid"));
    const lo = aiShotFromAttributes(0.6, 18, at(1));
    expect(mid).toEqual({ accuracy: 0.6, power: 18 });
    expect(hi.accuracy).toBeGreaterThan(mid.accuracy);
    expect(hi.power).toBeGreaterThan(mid.power);
    expect(lo.accuracy).toBeLessThan(mid.accuracy);
    expect(aiShotFromAttributes(0.95, 18, at(99)).accuracy).toBeLessThanOrEqual(1);
  });
});

describe("defend attribute", () => {
  it("neutral-rated is exactly TACKLE_TUNING", () => {
    expect(tackleParamsFromAttributes(at("mid"))).toEqual(NEUTRAL_TACKLE_PARAMS);
    expect(NEUTRAL_TACKLE_PARAMS.reach).toBe(TACKLE_TUNING.reach);
  });

  it("defend=99 reaches a ball defend=1 cannot", () => {
    const ball = ballAt(0, TACKLE_TUNING.reach + 0.15);
    expect(
      attemptTackleImpulse(ball, { x: 0, z: 0 }, tackleParamsFromAttributes(at(99))),
    ).not.toBeNull();
    expect(
      attemptTackleImpulse(ball, { x: 0, z: 0 }, tackleParamsFromAttributes(at(1))),
    ).toBeNull();
    expect(attemptTackleImpulse(ball, { x: 0, z: 0 })).toBeNull();
  });

  it("defend=99 fouls less: a body just inside the default radius is clean for them, a foul for defend=1", () => {
    const opponent = [body(0, TACKLE_TUNING.foulRadius - 0.2)];
    expect(detectFoulOnOpponent({ x: 0, z: 0 }, opponent)).toBe(0);
    expect(
      detectFoulOnOpponent({ x: 0, z: 0 }, opponent, tackleParamsFromAttributes(at(99))),
    ).toBeNull();
    expect(detectFoulOnOpponent({ x: 0, z: 0 }, opponent, tackleParamsFromAttributes(at(1)))).toBe(
      0,
    );
  });

  it("steal reach scales with defend and is neutral at the roster median", () => {
    expect(stealReachFromAttributes(at("mid"))).toBe(POSSESSION_TUNING.stealRadius);
    expect(stealReachFromAttributes(at(99))).toBeGreaterThan(stealReachFromAttributes(at(1)));
  });

  it("trySteal honours per-candidate reach and the carrier's shield", () => {
    const carrier = body(0, 0);
    const gap = POSSESSION_TUNING.stealRadius + 0.1;
    const far = { team: "away" as const, index: 0, body: body(0, gap) };
    expect(trySteal(carrier, [far])).toBeNull();
    expect(trySteal(carrier, [{ ...far, reach: stealReachFromAttributes(at(99)) }])).toEqual({
      team: "away",
      index: 0,
    });
    // A 99-dribble carrier shields well enough to keep it from that defender.
    expect(
      trySteal(
        carrier,
        [{ ...far, reach: stealReachFromAttributes(at(99)) }],
        shieldFromAttributes(at(99)),
      ),
    ).toBeNull();
    expect(shieldFromAttributes(at("mid"))).toBe(1);
  });

  it("trySteal without reach or shield behaves as before", () => {
    const carrier = body(0, 0);
    const near = {
      team: "away" as const,
      index: 3,
      body: body(0, POSSESSION_TUNING.stealRadius - 0.05),
    };
    const nearer = { team: "away" as const, index: 7, body: body(0.2, 0) };
    expect(trySteal(carrier, [near, nearer])).toEqual({ team: "away", index: 7 });
  });
});

describe("gk attribute", () => {
  const SIDE = 1 as const;
  const line = goalLineX(SIDE);
  const tracking = { phase: "tracking" as const, timer: 0, diveDir: 0 as const };

  it("neutral-rated is exactly KEEPER_TUNING", () => {
    expect(keeperParamsFromAttributes(at("mid"))).toEqual(NEUTRAL_KEEPER_PARAMS);
    expect(NEUTRAL_KEEPER_PARAMS.saveRadius).toBe(KEEPER_TUNING.saveRadius);
  });

  it("gk=99 saves a ball just outside the default radius; gk=1 does not", () => {
    const keeper = body(line - 0.7, 0);
    const ball = ballAt(keeper.position.x - 0.1, KEEPER_TUNING.saveRadius + 0.15, 20, 0);
    expect(tryKeeperSave(ball, keeper, tracking, SIDE)).toBeNull();
    expect(
      tryKeeperSave(ball, keeper, tracking, SIDE, keeperParamsFromAttributes(at(99))),
    ).not.toBeNull();
    expect(
      tryKeeperSave(ball, keeper, tracking, SIDE, keeperParamsFromAttributes(at(1))),
    ).toBeNull();
  });

  it("gk=99 commits to a dive earlier than gk=1 on the same shot", () => {
    const keeper = body(line - 0.7, 0);
    // Ball heading for the corner, arriving in ~0.85 s — inside the 99
    // keeper's lead time, outside the 1 keeper's.
    const dist = 0.85 * 22;
    const ball = ballAt(keeper.position.x - dist, 2.5, 22, 0);
    const hi = stepGoalkeeper(
      keeper,
      tracking,
      ball,
      SIDE,
      1 / 60,
      keeperParamsFromAttributes(at(99)),
    );
    const lo = stepGoalkeeper(
      keeper,
      tracking,
      ball,
      SIDE,
      1 / 60,
      keeperParamsFromAttributes(at(1)),
    );
    expect(hi.state.phase).toBe("diving");
    expect(lo.state.phase).not.toBe("diving");
  });

  it("dive speed follows the attribute", () => {
    const keeper = body(line - 0.7, 0);
    const ball = ballAt(keeper.position.x - 6, 2.5, 22, 0);
    const hi = stepGoalkeeper(
      keeper,
      tracking,
      ball,
      SIDE,
      1 / 60,
      keeperParamsFromAttributes(at(99)),
    );
    const lo = stepGoalkeeper(
      keeper,
      tracking,
      ball,
      SIDE,
      1 / 60,
      keeperParamsFromAttributes(at(1)),
    );
    expect(hi.state.phase).toBe("diving");
    expect(lo.state.phase).toBe("diving");
    expect(Math.abs(hi.diveVelocity!.z)).toBeGreaterThan(Math.abs(lo.diveVelocity!.z));
  });
});
