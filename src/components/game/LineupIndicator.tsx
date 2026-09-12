import { useGameStore } from "../../game/store/useGameStore";
import { playersOnPitch, sentOffIndices } from "../../game/logic/setpiece";
import type { TeamSide } from "../../game/logic/match";

/**
 * Compact lineup strip under the score bug: how many players each side
 * still has on the pitch, plus who has been sent off.
 */
export function LineupIndicator() {
  const bookings = useGameStore((s) => s.bookings);
  const netRole = useGameStore((s) => s.netRole);
  const awayLabel = netRole === "local" ? "AI" : "P2";

  const reds = bookings.filter((b) => b.color === "red");
  if (reds.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-1/2 top-[64px] z-10 -translate-x-1/2 md:top-[76px]">
      <div className="gb-panel flex items-center gap-4 px-4 py-1.5 font-mono text-[11px] tracking-[0.1em] text-[#e8ecf0]">
        <TeamCount team="home" label="YOU" bookings={bookings} />
        <span className="opacity-30">|</span>
        <TeamCount team="away" label={awayLabel} bookings={bookings} />
      </div>
    </div>
  );
}

function TeamCount({
  team,
  label,
  bookings,
}: {
  team: TeamSide;
  label: string;
  bookings: ReturnType<typeof useGameStore.getState>["bookings"];
}) {
  const count = playersOnPitch(bookings, team);
  const off = sentOffIndices(bookings, team);
  const names = bookings
    .filter((b) => b.team === team && b.color === "red")
    .map((b) => b.playerName);

  return (
    <div className="flex items-center gap-2">
      <span className="uppercase tracking-[0.18em] text-[#9aa4af]">{label}</span>
      <span
        className={`font-display text-[16px] font-extrabold tabular-nums ${
          count < 11 ? "text-[#e2444a]" : ""
        }`}
      >
        {count}
      </span>
      <span className="text-[#5d6a76]">on pitch</span>
      {off.length > 0 && (
        <span className="flex items-center gap-1.5 text-[#c6cdd5]">
          <span aria-hidden className="inline-block h-3 w-2 rounded-[2px] bg-[#e2444a]" />
          {names.join(", ")}
        </span>
      )}
    </div>
  );
}
