import type { Attributes } from "../types";

/**
 * Shared helpers for turning 1–99 player attributes into simulation
 * parameters. Every module that consumes an attribute goes through these so
 * the scale lives in exactly one place.
 *
 * Each attribute has a *neutral* point: a player rated exactly there gets
 * the tuning-table defaults, so wiring an attribute never changes how the
 * average squad plays — it only spreads the good and the bad players away
 * from it. The neutral points are the medians of the generated roster
 * (`data/clubs.ts`), not a flat 50, because the roster is skewed high:
 * outfielders cluster around 63–73 and every starting keeper is 87+.
 */
export const ATTR_MAX = 99;
export const ATTR_MIN = 1;

export const ATTR_NEUTRAL: Attributes = {
  pace: 69,
  shot: 63,
  pass: 66,
  dribble: 73,
  defend: 64,
  gk: 92,
} as const;

/** 1–99 → 0..1 (99 = 1). Unaware of the neutral point. */
export function attrNorm(v: number): number {
  return Math.max(0, Math.min(1, v / ATTR_MAX));
}

/**
 * Attribute → -1..+1 with 0 exactly at that attribute's neutral point.
 * Piecewise-linear: the run from neutral down to 1 maps onto [-1, 0] and
 * from neutral up to 99 onto [0, +1], so both tails reach full swing.
 */
export function attrSigned(key: keyof Attributes, v: number): number {
  const n = ATTR_NEUTRAL[key];
  if (v >= n) return Math.min(1, (v - n) / (ATTR_MAX - n));
  return Math.max(-1, (v - n) / (n - ATTR_MIN));
}

/** Neutral attributes — handy default for callers without a roster. */
export const NEUTRAL_ATTRIBUTES: Attributes = { ...ATTR_NEUTRAL };
