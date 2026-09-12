import type { Kinematics } from "../types";

/**
 * Pass targeting. Instead of "nearest teammate roughly ahead", every
 * teammate is scored on how well they match what the passer is asking for
 * — the direction being pushed on the stick (or the facing if the stick is
 * idle), a comfortable distance, a clear lane, and forward progress — and
 * the best one is led into so the ball meets them in stride.
 *
 * A *through ball* (pass with sprint held) weights forward progress far
 * higher, tolerates a tighter lane, and aims well ahead of the receiver
 * into space toward goal.
 */
export const PASS_TUNING = {
  /** ignore teammates closer than this (on top of the passer) */
  minDist: 1.5,
  /** ignore teammates further than this */
  maxDist: 45,
  /** candidates must be at least this aligned with the aim direction (cos) */
  minAlignment: 0.1,
  /** the distance a "normal" pass wants to travel */
  idealDist: 14,
  /** opponents within this of the ball's path block the lane */
  laneRadius: 1.4,
  /** seconds ahead of a moving receiver to aim */
  leadTime: 0.35,
  weights: { align: 1.0, dist: 0.35, lane: 1.2, forward: 0.25 },
  through: {
    leadTime: 0.9,
    /** metres beyond the led position, toward goal, to aim into */
    spaceAhead: 6,
    /** strike speed multiplier so the ball gets there first */
    powerMult: 1.15,
    weights: { align: 0.7, dist: 0.15, lane: 0.6, forward: 0.9 },
  },
} as const;

export type PassMode = "pass" | "through";

export type PassChoice = {
  /** index into the teammates array */
  index: number;
  /** where to aim the ball */
  aim: { x: number; z: number };
  /** strike speed multiplier (1 for a normal pass) */
  powerMult: number;
};

type Vec2 = { x: number; z: number };

/** Direction the passer is asking for: the stick if it's pushed, else the facing. */
export function passAimDirection(passer: Kinematics, input: { x: number; z: number }): Vec2 {
  const mag = Math.hypot(input.x, input.z);
  if (mag > 0.2) return { x: input.x / mag, z: input.z / mag };
  return { x: Math.sin(passer.heading), z: -Math.cos(passer.heading) };
}

/** True if any opponent stands inside the lane from `from` to `to`. */
export function laneBlocked(
  from: Vec2,
  to: Vec2,
  opponents: Kinematics[],
  radius = PASS_TUNING.laneRadius,
): boolean {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-6) return false;
  for (const o of opponents) {
    const ox = o.position.x - from.x;
    const oz = o.position.z - from.z;
    const t = (ox * dx + oz * dz) / len2;
    if (t < 0.12 || t > 0.95) continue; // right on top of passer / receiver doesn't count
    const px = from.x + dx * t;
    const pz = from.z + dz * t;
    if (Math.hypot(o.position.x - px, o.position.z - pz) < radius) return true;
  }
  return false;
}

/**
 * Picks the teammate to pass to and where to aim. Returns null when nobody
 * is a reasonable option, in which case the caller should kick along the
 * facing as before.
 *
 * `attackDir` is +1 when this side attacks toward +x, -1 toward -x.
 * `exclude` holds indices not on the pitch (sent off).
 */
export function selectPassTarget(
  passer: Kinematics,
  aimDir: Vec2,
  teammates: Kinematics[],
  selfIndex: number,
  opponents: Kinematics[],
  attackDir: 1 | -1,
  mode: PassMode = "pass",
  exclude: ReadonlySet<number> = new Set(),
  bounds: { halfLength: number; halfWidth: number } = { halfLength: 52.5, halfWidth: 34 },
): PassChoice | null {
  const t = PASS_TUNING;
  const w = mode === "through" ? t.through.weights : t.weights;
  const lead = mode === "through" ? t.through.leadTime : t.leadTime;

  let best: PassChoice | null = null;
  let bestScore = -Infinity;

  teammates.forEach((mate, i) => {
    if (i === selfIndex || exclude.has(i)) return;
    const dx = mate.position.x - passer.position.x;
    const dz = mate.position.z - passer.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < t.minDist || dist > t.maxDist) return;

    const align = (dx * aimDir.x + dz * aimDir.z) / dist;
    if (align < t.minAlignment) return;

    // Lead the runner; through balls go into the space beyond them.
    let ax = mate.position.x + mate.velocity.x * lead;
    let az = mate.position.z + mate.velocity.z * lead;
    if (mode === "through") ax += attackDir * t.through.spaceAhead;
    ax = Math.max(-bounds.halfLength + 1, Math.min(bounds.halfLength - 1, ax));
    az = Math.max(-bounds.halfWidth + 1, Math.min(bounds.halfWidth - 1, az));

    const distPenalty = Math.abs(dist - t.idealDist) / t.idealDist;
    const blocked = laneBlocked(passer.position, { x: ax, z: az }, opponents) ? 1 : 0;
    const forward = (attackDir * dx) / dist; // -1..1

    const score = align * w.align - distPenalty * w.dist - blocked * w.lane + forward * w.forward;
    if (score > bestScore) {
      bestScore = score;
      best = {
        index: i,
        aim: { x: ax, z: az },
        powerMult: mode === "through" ? t.through.powerMult : 1,
      };
    }
  });

  return best;
}
