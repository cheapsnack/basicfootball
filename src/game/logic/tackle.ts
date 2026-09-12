import type { Attributes, BallState, Kinematics } from "../types";
import { attrSigned } from "./attributes";

/**
 * Slide-tackle feel. A tackle is a short committed dash rather than a held
 * action — press it, and for a brief window afterward getting close to the
 * ball forcibly knocks it loose, win or lose. The cooldown is the balance
 * lever: cheap enough to use as a real defensive tool, expensive enough
 * that spamming it just leaves you out of position.
 */
export const TACKLE_TUNING = {
  /** burst of speed added in the player's current facing direction when a tackle starts */
  dashSpeed: 9,
  /** seconds after starting a tackle where contact actually dispossesses */
  activeWindow: 0.3,
  /** seconds before the same player can tackle again */
  cooldown: 1.1,
  /** distance from the tackler to the ball for a tackle to connect */
  reach: 1.3,
  /** speed given to the ball when a tackle connects, knocking it loose */
  impulseSpeed: 10,
  /**
   * If a tackle dash reaches within this radius of an *opponent's body*
   * without first winning the ball, it counts as a foul. Set at 1.6m:
   * - Must be smaller than the steal radius (1.2m) would be reached first
   *   if the player was actually winning the ball.
   * - Only triggers when the ball genuinely wasn't reached (the knock was
   *   null) AND the opponent body is this close — about the distance of a
   *   genuine challenge that misses the ball.
   * Deliberately conservative: better to have fewer, meaningful cards than
   * a card every other tackle.
   */
  foulRadius: 1.6,
} as const;

/**
 * How `defend` bends a tackle: better defenders reach further for the ball
 * and need to be closer to a body before it counts as a foul. A neutral-rated
 * player (attributes.ts) gets exactly TACKLE_TUNING.
 */
export const TACKLE_ATTR_TUNING = {
  /** ± metres of reach across 1..99 */
  reachRange: 0.3,
  /** ∓ metres of foul radius across 1..99 (99 → smaller, cleaner) */
  foulRadiusRange: 0.45,
} as const;

export type TackleParams = { reach: number; foulRadius: number };

export const NEUTRAL_TACKLE_PARAMS: TackleParams = {
  reach: TACKLE_TUNING.reach,
  foulRadius: TACKLE_TUNING.foulRadius,
};

export function tackleParamsFromAttributes(a: Pick<Attributes, "defend">): TackleParams {
  const d = attrSigned("defend", a.defend);
  return {
    reach: TACKLE_TUNING.reach + d * TACKLE_ATTR_TUNING.reachRange,
    foulRadius: TACKLE_TUNING.foulRadius - d * TACKLE_ATTR_TUNING.foulRadiusRange,
  };
}

/**
 * If the ball is within tackle reach of `tacklerPos`, knocks it loose away
 * from the tackler at TACKLE_TUNING.impulseSpeed. Returns null when out of
 * reach — nothing to do. Pure.
 */
export function attemptTackleImpulse(
  ball: BallState,
  tacklerPos: { x: number; z: number },
  params: TackleParams = NEUTRAL_TACKLE_PARAMS,
): BallState | null {
  const dx = ball.position.x - tacklerPos.x;
  const dz = ball.position.z - tacklerPos.z;
  const dist = Math.hypot(dx, dz);
  if (dist >= params.reach) return null;

  const nx = dist < 1e-3 ? 0 : dx / dist;
  const nz = dist < 1e-3 ? 1 : dz / dist;
  return {
    ...ball,
    velocity: { x: nx * TACKLE_TUNING.impulseSpeed, y: ball.velocity.y, z: nz * TACKLE_TUNING.impulseSpeed },
  };
}

/**
 * If a tackle dash misses the ball but clatters into an opponent's body,
 * returns the index of the fouled opponent. Called *after* attemptTackleImpulse
 * has been given first refusal — only fires if that returned null. Pure.
 */
export function detectFoulOnOpponent(
  tacklerPos: { x: number; z: number },
  opponents: Kinematics[],
  params: TackleParams = NEUTRAL_TACKLE_PARAMS,
): number | null {
  let best = -1;
  let bestDist: number = params.foulRadius;
  opponents.forEach((o, i) => {
    const dist = Math.hypot(o.position.x - tacklerPos.x, o.position.z - tacklerPos.z);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  return best >= 0 ? best : null;
}

/** Dash velocity added when a tackle begins, in the tackler's facing direction. */
export function tackleDash(heading: number): { x: number; z: number } {
  return {
    x: Math.sin(heading) * TACKLE_TUNING.dashSpeed,
    z: -Math.cos(heading) * TACKLE_TUNING.dashSpeed,
  };
}
