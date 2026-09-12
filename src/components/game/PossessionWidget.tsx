import { useGameStore } from "../../game/store/useGameStore";
import { getClub } from "../../game/data/clubs";

/**
 * Bottom-right possession split + shot count. Reads the coarse `stats`
 * field, which the frame loop flushes every couple of seconds — never the
 * per-frame bodies.
 */
export function PossessionWidget() {
  const stats = useGameStore((s) => s.stats);
  const netRole = useGameStore((s) => s.netRole);
  const homeClub = useGameStore((s) => getClub(s.homeClubId));
  const awayClub = useGameStore((s) => getClub(s.awayClubId));

  const total = stats.possessionSeconds.home + stats.possessionSeconds.away;
  const home = total > 0 ? Math.round((stats.possessionSeconds.home / total) * 100) : 50;

  // In a two-human match the bottom-right corner belongs to P2's card.
  const lifted = netRole !== "local";

  return (
    <div
      className={`gb-panel pointer-events-none fixed right-[22px] z-10 hidden w-[210px] flex-col gap-2 px-3.5 py-3 md:flex ${
        lifted ? "bottom-[88px]" : "bottom-4"
      }`}
    >
      <div className="flex justify-between font-mono text-[11px] tracking-[0.16em] text-[#9aa4af]">
        <span>POSS</span>
        <span className="text-[#e8ecf0]">
          {home} / {100 - home}
        </span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-md">
        <div style={{ width: `${home}%`, background: homeClub.primaryColor }} />
        <div style={{ width: `${100 - home}%`, background: awayClub.primaryColor }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] tracking-[0.16em] text-[#9aa4af]">
        <span>SHOTS</span>
        <span className="text-[#e8ecf0]">
          {stats.shots.home} / {stats.shots.away}
        </span>
      </div>
    </div>
  );
}
