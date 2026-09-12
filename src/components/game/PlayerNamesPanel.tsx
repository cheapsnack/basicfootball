import { useEffect, useState } from "react";
import { useGameStore, HOME_DEFEND_SIDE, AWAY_DEFEND_SIDE } from "../../game/store/useGameStore";
import { getClub } from "../../game/data/clubs";
import { buildOutfield } from "../../game/logic/ai/outfield";
import type { PlayerPosition } from "../../game/types";
import { textOn } from "./MatchHud";

type Row = {
  name: string;
  position: PlayerPosition;
  number: number;
  color: string;
  ink: string;
  club: string;
} | null;

/**
 * Card for the human-controlled player: yours bottom-left and — in a
 * two-human match (local 1v1 or an online room) — the opponent's
 * bottom-right. Rendered as DOM rather than 3D labels so it never ghosts in
 * networked matches, where positions mutate in place without re-rendering.
 */
export function PlayerNamesPanel() {
  const [home, setHome] = useState<Row>(null);
  const [away, setAway] = useState<Row>(null);
  const netRole = useGameStore((s) => s.netRole);
  const twoHuman = netRole !== "local";

  useEffect(() => {
    const tick = () => {
      const s = useGameStore.getState();
      const homeClub = getClub(s.homeClubId);
      const awayClub = getClub(s.awayClubId);

      const homeXI = buildOutfield(homeClub, HOME_DEFEND_SIDE, s.mentality);
      const mine = homeXI[s.controlledIndex];
      setHome(
        mine
          ? {
              name: mine.player.name,
              position: mine.player.position,
              number: s.controlledIndex + 2,
              color: homeClub.primaryColor,
              ink: textOn(homeClub.primaryColor),
              club: homeClub.shortName,
            }
          : null,
      );

      if (twoHuman) {
        const awayXI = buildOutfield(awayClub, AWAY_DEFEND_SIDE, s.mentality);
        const idx = s.awayControlledIndex;
        const theirs = idx == null ? undefined : awayXI[idx];
        setAway(
          theirs && idx != null
            ? {
                name: theirs.player.name,
                position: theirs.player.position,
                number: idx + 2,
                color: awayClub.primaryColor,
                ink: textOn(awayClub.primaryColor),
                club: awayClub.shortName,
              }
            : null,
        );
      } else {
        setAway(null);
      }
    };

    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [twoHuman]);

  return (
    <>
      {home && <NameCard row={home} side="left" tag="YOU" />}
      {away && <NameCard row={away} side="right" tag="P2" />}
    </>
  );
}

function NameCard({
  row,
  side,
  tag,
}: {
  row: NonNullable<Row>;
  side: "left" | "right";
  tag: string;
}) {
  return (
    <div
      className={`gb-panel pointer-events-none fixed bottom-4 z-10 hidden w-[300px] items-center gap-3 px-3 py-2.5 md:flex ${
        side === "left" ? "left-[22px]" : "right-[22px] flex-row-reverse text-right"
      }`}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md"
        style={{ background: row.color, color: row.ink }}
      >
        <span className="font-display text-[22px] font-extrabold">{row.number}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-display text-[22px] font-extrabold uppercase leading-none tracking-[0.03em] text-[#e8ecf0]">
          {row.name}
        </span>
        <span className="font-mono text-[11px] tracking-[0.1em] text-[#9aa4af]">
          {row.position} · {row.club}
        </span>
      </div>
      <span
        className={`font-display text-[14px] font-extrabold tracking-[0.1em] ${side === "left" ? "ml-auto" : "mr-auto"}`}
        style={{ color: "#63d68a" }}
      >
        {tag}
      </span>
    </div>
  );
}
