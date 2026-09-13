import type { Kinematics, MovementInput } from "../types";
import type { MovementParams } from "./movement";

/**
 * Sprint economy. Stamina is a 0..1 tank per outfield player. Sprinting
 * drains it, jogging drains a trickle, standing or walking refills it.
 * Below `sprintCutoff` the sprint button does nothing until the tank
 * recovers past `sprintResume`; below `fadeStart` top speed and
 * acceleration ease down toward `minSpeedMult`.
 *
 * Tuned so a player can sprint flat-out for ~9 s from full, and gets most
 * of that back in ~25 s of walking. Over a 3-minute half that means pace
 * decides the first twenty minutes and management decides the last ten.
 */
export const STAMINA_TUNING = {
  /** per-second drain while sprinting */
  sprintDrain: 0.11,
  /** per-second drain while moving without sprint */
  runDrain: 0.012,
  /** per-second recovery while stationary */
  idleRecover: 0.05,
  /** per-second recovery while walking (moving, not sprinting) — applied instead of runDrain when below this speed */
  walkRecover: 0.03,
  /** speed (m/s) under which movement counts as walking and recovers */
  walkSpeed: 2.2,
  /** can't start / continue a sprint below this */
  sprintCutoff: 0.12,
  /** once cut off, sprint comes back above this (hysteresis) */
  sprintResume: 0.3,
  /** speed/accel start easing below this */
  fadeStart: 0.4,
  /** speed/accel multiplier at empty */
  minSpeedMult: 0.8,
  /** stamina restored at half time and before extra time */
  halfTimeRecover: 0.45,
  /** AI players save their legs: no discretionary sprint below this */
  aiSprintReserve: 0.35,
} as const;

/** Per-player stamina state: the tank plus a sprint-lockout latch. */
export type StaminaState = { tank: number; lockedOut: boolean };

export const FULL_STAMINA: StaminaState = { tank: 1, lockedOut: false };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * AI sprint discipline: a non-urgent AI input drops sprint when the tank
 * is under `aiSprintReserve`, so zonal drift never burns the legs a press
 * or a chase will need. Urgent (pressing, chasing a loose ball) is exempt
 * — the hard lockout in gateSprint still applies.
 */
export function aiSprintDiscipline(
  input: MovementInput,
  s: StaminaState,
  urgent: boolean,
): MovementInput {
  if (!input.sprint || urgent || s.tank >= STAMINA_TUNING.aiSprintReserve) return input;
  return { x: input.x, z: input.z, sprint: false };
}

/** Whether this player may sprint right now. */
export function canSprint(s: StaminaState): boolean {
  return !s.lockedOut;
}

/** Input with sprint removed when the tank doesn't allow it. */
export function gateSprint(input: MovementInput, s: StaminaState): MovementInput {
  if (!input.sprint || canSprint(s)) return input;
  return { x: input.x, z: input.z, sprint: false };
}

/**
 * Advances stamina by dt given what the player is actually doing this
 * frame. `input` should be the already-gated input (see gateSprint) so a
 * held sprint key with an empty tank doesn't keep draining. Pure.
 */
export function stepStamina(
  s: StaminaState,
  input: MovementInput,
  body: Kinematics,
  dt: number,
): StaminaState {
  const t = STAMINA_TUNING;
  const moving = Math.hypot(input.x, input.z) > 0.05;
  const speed = Math.hypot(body.velocity.x, body.velocity.z);

  let delta: number;
  if (input.sprint && moving) delta = -t.sprintDrain;
  else if (!moving) delta = t.idleRecover;
  else if (speed < t.walkSpeed) delta = t.walkRecover;
  else delta = -t.runDrain;

  const tank = clamp01(s.tank + delta * dt);
  const lockedOut = s.lockedOut ? tank < t.sprintResume : tank < t.sprintCutoff;
  if (tank === s.tank && lockedOut === s.lockedOut) return s;
  return { tank, lockedOut };
}

/** 1 when fresh, easing to minSpeedMult as the tank empties below fadeStart. */
export function staminaSpeedMult(s: StaminaState): number {
  const t = STAMINA_TUNING;
  if (s.tank >= t.fadeStart) return 1;
  const f = s.tank / t.fadeStart;
  return t.minSpeedMult + (1 - t.minSpeedMult) * f;
}

/** Movement params scaled for tiredness. Returns the same object when fresh. */
export function applyStamina(params: MovementParams, s: StaminaState): MovementParams {
  const m = staminaSpeedMult(s);
  if (m === 1) return params;
  return { ...params, accel: params.accel * m, maxSpeed: params.maxSpeed * m };
}

/** Half-time / extra-time top-up. */
export function recoverAtBreak(s: StaminaState): StaminaState {
  const tank = clamp01(s.tank + STAMINA_TUNING.halfTimeRecover);
  return { tank, lockedOut: tank < STAMINA_TUNING.sprintResume && s.lockedOut };
}
