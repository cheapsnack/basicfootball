import type {
  ActionInput,
  Attributes,
  BallState,
  ChargeState,
  Kinematics,
  StrikeAction,
} from "../types";
import { STRIKE_TUNING } from "./ballPhysics";
import { attrSigned } from "./attributes";

/**
 * How the `shot` and `pass` attributes bend a strike. A neutral-rated player (see
 * attributes.ts) gets exactly STRIKE_TUNING; the ranges below are the full swing from 1
 * to 99. Below neutral a player picks up random spread (they miss); above it
 * they lose nothing and gain a little assist (they find the target).
 */
export const STRIKE_ATTR_TUNING = {
  /** ±fraction of strike speed across 1..99 (99 → +18%, 1 → -18%) */
  shotPowerRange: 0.18,
  /** radians of random aim error at shot = 1 (~8°); zero at 50 and above */
  shotSpreadMax: 0.14,
  /** extra shot-assist weight at shot = 99 */
  shotAssistBonus: 0.15,
  passPowerRange: 0.1,
  passSpreadMax: 0.12,
  passAssistBonus: 0.15,
  /** ± added to the difficulty table's AI shotAccuracy at shot = 99 / 1 */
  aiAccuracyRange: 0.15,
} as const;

export type StrikeParams = {
  shotPower: number;
  shotSpread: number;
  shotAssist: number;
  passPower: number;
  passSpread: number;
  passAssist: number;
};

/** Exactly today's behaviour — what a neutral-rated player gets. */
export const NEUTRAL_STRIKE_PARAMS: StrikeParams = {
  shotPower: 1,
  shotSpread: 0,
  shotAssist: 0,
  passPower: 1,
  passSpread: 0,
  passAssist: 0,
};

export function strikeParamsFromAttributes(a: Pick<Attributes, "shot" | "pass">): StrikeParams {
  const s = attrSigned("shot", a.shot);
  const p = attrSigned("pass", a.pass);
  const t = STRIKE_ATTR_TUNING;
  return {
    shotPower: 1 + s * t.shotPowerRange,
    shotSpread: Math.max(0, -s) * t.shotSpreadMax,
    shotAssist: Math.max(0, s) * t.shotAssistBonus,
    passPower: 1 + p * t.passPowerRange,
    passSpread: Math.max(0, -p) * t.passSpreadMax,
    passAssist: Math.max(0, p) * t.passAssistBonus,
  };
}

/**
 * Per-player scaling of the AI's difficulty-table shot. Composes with
 * difficulty rather than replacing it: a 90-shot striker on Beginner is
 * still worse than a 30-shot one on Expert.
 */
export function aiShotFromAttributes(
  accuracy: number,
  power: number,
  a: Pick<Attributes, "shot">,
): { accuracy: number; power: number } {
  const s = attrSigned("shot", a.shot);
  return {
    accuracy: clamp01(accuracy + s * STRIKE_ATTR_TUNING.aiAccuracyRange),
    power: power * (1 + s * STRIKE_ATTR_TUNING.shotPowerRange),
  };
}

/** Stable identity so subscribers don't re-render while nothing is charging. */
export const IDLE_CHARGE: ChargeState = { action: null, power: 0, elapsed: 0, loft: false };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Which action the keys are asking for this frame. Shoot wins ties. */
function desiredAction(actions: ActionInput): StrikeAction | null {
  if (actions.shoot) return "shoot";
  if (actions.pass) return "pass";
  return null;
}

/**
 * Advances the charge by dt seconds. Pure.
 *  - Power ramps from minPower to 1 over chargeTime, then caps (no over-charge penalty).
 *  - Switching action mid-charge restarts the ramp.
 *  - Returns the shared IDLE_CHARGE reference when idle, so store subscribers stay quiet.
 */
export function stepCharge(charge: ChargeState, actions: ActionInput, dt: number): ChargeState {
  const want = desiredAction(actions);
  if (!want) return IDLE_CHARGE;

  const restarted = charge.action !== want;
  const elapsed = restarted ? dt : charge.elapsed + dt;
  const t = clamp01(elapsed / STRIKE_TUNING.chargeTime);
  const power = STRIKE_TUNING.minPower + (1 - STRIKE_TUNING.minPower) * t;

  return {
    action: want,
    power: clamp01(power),
    elapsed,
    // Latch the modifier: holding it at any point during the charge lofts the strike.
    loft: actions.loft || (!restarted && charge.loft),
  };
}

/**
 * True when the player can strike the ball. For a possessed ball the player
 * is *always* in range by construction (the ball is glued to their feet).
 * For a loose ball the original distance check applies.
 */
export function canStrike(player: Kinematics, ball: BallState, hasPossession = false): boolean {
  if (hasPossession) return ball.position.y <= STRIKE_TUNING.maxStrikeHeight;
  const dist = Math.hypot(ball.position.x - player.position.x, ball.position.z - player.position.z);
  return dist <= STRIKE_TUNING.reach && ball.position.y <= STRIKE_TUNING.maxStrikeHeight;
}

export type StrikeResult = {
  direction: { x: number; z: number };
  /** horizontal speed in m/s */
  speed: number;
  /** vertical launch speed in m/s */
  lift: number;
};

/**
 * Turns a released charge into an impulse.
 *
 * `target` is a pass-assist seam (nearest teammate) or, for shots, the goal
 * centre — while it is undefined the direction is purely the player's
 * heading, so callers that don't pass one get unassisted behaviour.
 */
export function resolveStrike(
  player: Kinematics,
  charge: ChargeState,
  target?: { x: number; z: number },
  params: StrikeParams = NEUTRAL_STRIKE_PARAMS,
  rng: () => number = Math.random,
): StrikeResult {
  const isPass = charge.action === "pass";
  const cfg = isPass ? STRIKE_TUNING.pass : STRIKE_TUNING.shot;

  // Facing direction on the ground plane.
  let dx = Math.sin(player.heading);
  let dz = -Math.cos(player.heading);

  // Assist: blend toward the target when one is supplied and roughly ahead.
  // Passing gets a strong, generous cone; shooting gets a light nudge only
  // when you're already close to on-target, so it steadies aim without
  // aiming the shot for you.
  if (target) {
    const tx = target.x - player.position.x;
    const tz = target.z - player.position.z;
    const len = Math.hypot(tx, tz);
    if (len > 1e-3) {
      const nx = tx / len;
      const nz = tz / len;
      const alignment = dx * nx + dz * nz;
      const minAlignment = isPass
        ? STRIKE_TUNING.assistMinAlignment
        : STRIKE_TUNING.shotAssistMinAlignment;
      const weight =
        (isPass ? STRIKE_TUNING.assistWeight : STRIKE_TUNING.shotAssistWeight) +
        (isPass ? params.passAssist : params.shotAssist);
      if (alignment >= minAlignment) {
        dx += (nx - dx) * weight;
        dz += (nz - dz) * weight;
      }
    }
  }

  const dirLen = Math.hypot(dx, dz) || 1;
  dx /= dirLen;
  dz /= dirLen;

  // Attribute spread: poor strikers scatter their aim by up to ±spread.
  const spread = isPass ? params.passSpread : params.shotSpread;
  if (spread > 0) {
    const err = (rng() - 0.5) * 2 * spread;
    const cos = Math.cos(err);
    const sin = Math.sin(err);
    const rx = dx * cos - dz * sin;
    const rz = dx * sin + dz * cos;
    dx = rx;
    dz = rz;
  }

  // Momentum: running into the strike adds power, running away takes some off.
  const forward = player.velocity.x * dx + player.velocity.z * dz;
  const base = cfg.minSpeed + (cfg.maxSpeed - cfg.minSpeed) * charge.power;
  const speed =
    Math.max(cfg.minSpeed * 0.5, base + forward * STRIKE_TUNING.momentumTransfer) *
    (isPass ? params.passPower : params.shotPower);

  const loftRatio = charge.loft ? cfg.loftRatio : cfg.baseLoftRatio;

  return { direction: { x: dx, z: dz }, speed, lift: speed * loftRatio };
}

