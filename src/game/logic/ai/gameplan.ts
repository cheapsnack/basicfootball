import type { Difficulty } from "./difficulty";
import type { Mentality } from "./mentality";

/**
 * The AI's game plan: which mentality it plays with, given the scoreline
 * and how much of the match is left. Instead of mirroring whatever the
 * human picked, the AI chases when it's behind, protects a lead late on,
 * and — on the top difficulties — goes for it when a match is level in
 * the closing minutes.
 *
 * `progress` is the fraction of regulation played (0 at kick-off, 1 at
 * full time; extra time is treated as 1). Thresholds are per difficulty
 * so a Beginner AI barely reacts while an Expert AI manages the game.
 */
export type GameplanProfile = {
  /** mentality when nothing in the rules below applies */
  base: Mentality;
  /** behind by one → attacking once this far through */
  chaseAfter: number;
  /** behind by two or more → attacking once this far through */
  chaseTwoAfter: number;
  /** ahead by one → defensive once this far through */
  protectAfter: number;
  /** ahead by two or more → defensive once this far through */
  protectTwoAfter: number;
  /** level this late → attacking (null = never) */
  boldLateAfter: number | null;
};

export const GAMEPLAN_TUNING: Record<Difficulty, GameplanProfile> = {
  beginner: {
    base: "balanced",
    chaseAfter: 0.8,
    chaseTwoAfter: 0.6,
    protectAfter: 1.01, // never
    protectTwoAfter: 1.01,
    boldLateAfter: null,
  },
  amateur: {
    base: "balanced",
    chaseAfter: 0.65,
    chaseTwoAfter: 0.4,
    protectAfter: 0.85,
    protectTwoAfter: 0.7,
    boldLateAfter: null,
  },
  advanced: {
    base: "balanced",
    chaseAfter: 0.55,
    chaseTwoAfter: 0.3,
    protectAfter: 0.78,
    protectTwoAfter: 0.6,
    boldLateAfter: 0.9,
  },
  expert: {
    base: "balanced",
    chaseAfter: 0.45,
    chaseTwoAfter: 0.2,
    protectAfter: 0.72,
    protectTwoAfter: 0.5,
    boldLateAfter: 0.85,
  },
};

/** How often (real seconds) the AI reconsiders — avoids flip-flopping. */
export const GAMEPLAN_REVIEW_SECONDS = 6;

export function planMentality(
  difficulty: Difficulty,
  /** AI goals minus opponent goals */
  scoreDiff: number,
  /** 0..1 of regulation played; pass 1 in extra time */
  progress: number,
): Mentality {
  const p = GAMEPLAN_TUNING[difficulty];
  const t = Math.max(0, Math.min(1, progress));

  if (scoreDiff <= -2 && t >= p.chaseTwoAfter) return "attacking";
  if (scoreDiff === -1 && t >= p.chaseAfter) return "attacking";
  if (scoreDiff >= 2 && t >= p.protectTwoAfter) return "defensive";
  if (scoreDiff === 1 && t >= p.protectAfter) return "defensive";
  if (scoreDiff === 0 && p.boldLateAfter !== null && t >= p.boldLateAfter) return "attacking";
  return p.base;
}

/** Fraction of regulation played, from the match clock. */
export function matchProgress(
  period: number,
  matchTime: number,
  regulationPeriods: number,
  periodSeconds: number,
): number {
  if (period > regulationPeriods) return 1;
  const played = (period - 1) * periodSeconds + Math.min(matchTime, periodSeconds);
  return Math.max(0, Math.min(1, played / (regulationPeriods * periodSeconds)));
}
