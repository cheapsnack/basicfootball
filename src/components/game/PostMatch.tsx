import { useMemo } from "react";
import { useGameStore, HOME_DEFEND_SIDE, AWAY_DEFEND_SIDE } from "../../game/store/useGameStore";
import { getClub } from "../../game/data/clubs";
import { buildOutfield } from "../../game/logic/ai/outfield";
import { DIFFICULTY_LABEL } from "../../game/logic/ai/difficulty";
import type { Club } from "../../game/types";
import type { TeamSide } from "../../game/logic/match";
import { textOn } from "./MatchHud";

const ACCENT = "#63d68a";

type Scorer = { name: string; minutes: string };

/** Groups a side's goals by scorer: "R. Okafor 12' 67'". */
function scorersFor(
  team: TeamSide,
  goals: { team: TeamSide; scorerIndex: number | null; minute: number }[],
  club: Club,
  side: 1 | -1,
  mentality: Parameters<typeof buildOutfield>[2],
): Scorer[] {
  const xi = buildOutfield(club, side, mentality);
  const byName = new Map<string, number[]>();
  for (const g of goals) {
    if (g.team !== team) continue;
    const entry = g.scorerIndex == null ? undefined : xi[g.scorerIndex];
    const name = entry ? entry.player.name : "Own goal";
    byName.set(name, [...(byName.get(name) ?? []), g.minute]);
  }
  return [...byName.entries()].map(([name, mins]) => ({
    name,
    minutes: mins.map((m) => `${m}'`).join(" "),
  }));
}

export function PostMatch({ onExit }: { onExit?: (() => void) | undefined }) {
  const resetMatch = useGameStore((s) => s.resetMatch);
  const score = useGameStore((s) => s.score);
  const goals = useGameStore((s) => s.goals);
  const stats = useGameStore((s) => s.stats);
  const bookings = useGameStore((s) => s.bookings);
  const netRole = useGameStore((s) => s.netRole);
  const difficulty = useGameStore((s) => s.difficulty);
  const mentality = useGameStore((s) => s.mentality);
  const homeClub = useGameStore((s) => getClub(s.homeClubId));
  const awayClub = useGameStore((s) => getClub(s.awayClubId));

  const homeScorers = useMemo(
    () => scorersFor("home", goals, homeClub, HOME_DEFEND_SIDE, mentality),
    [goals, homeClub, mentality],
  );
  const awayScorers = useMemo(
    () => scorersFor("away", goals, awayClub, AWAY_DEFEND_SIDE, mentality),
    [goals, awayClub, mentality],
  );

  const possTotal = stats.possessionSeconds.home + stats.possessionSeconds.away;
  const possHome =
    possTotal > 0 ? Math.round((stats.possessionSeconds.home / possTotal) * 100) : 50;
  const rows = [
    { label: "SHOTS", home: stats.shots.home, away: stats.shots.away },
    { label: "POSSESSION", home: possHome, away: 100 - possHome, pct: true },
    { label: "GOALS", home: score.home, away: score.away },
    {
      label: "CARDS",
      home: bookings.filter((b) => b.team === "home").length,
      away: bookings.filter((b) => b.team === "away").length,
    },
  ];

  const homeWon = score.home > score.away;
  const awayWon = score.away > score.home;
  const modeLabel =
    netRole === "local"
      ? `KICK OFF · ${DIFFICULTY_LABEL[difficulty].toUpperCase()}`
      : netRole === "local2p"
        ? "LOCAL 1V1"
        : "ONLINE 1V1";

  const yellows = bookings.filter((b) => b.color === "yellow");
  const reds = bookings.filter((b) => b.color === "red");

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#0a0c0f]/70 p-3 font-body text-[#e8ecf0] backdrop-blur-[6px] md:p-8">
      <div className="gb-panel-solid flex w-full max-w-[1000px] flex-col gap-5 px-4 py-5 md:gap-6 md:px-9 md:py-8">
        {/* header line */}
        <div className="flex items-center justify-between">
          <span
            className="font-mono text-[11px] tracking-[0.22em] md:text-[12px]"
            style={{ color: ACCENT }}
          >
            FULL TIME · {modeLabel}
          </span>
          <span className="hidden font-mono text-[12px] text-[#79838e] md:block">
            {homeClub.shortName} v {awayClub.shortName}
          </span>
        </div>

        {/* score */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-7">
          <div className="flex items-center gap-3 md:gap-4">
            <Crest club={homeClub} />
            <span className="hidden font-display text-[34px] font-extrabold uppercase tracking-[0.02em] md:block">
              {homeClub.name}
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
            <Big n={score.home} win={homeWon} />
            <span className="font-display text-[32px] font-extrabold text-[#3c454f] md:text-[52px]">
              –
            </span>
            <Big n={score.away} win={awayWon} />
          </div>
          <div className="flex items-center justify-end gap-3 md:gap-4">
            <span className="hidden text-right font-display text-[34px] font-extrabold uppercase tracking-[0.02em] md:block">
              {awayClub.name}
            </span>
            <Crest club={awayClub} />
          </div>
        </div>

        {/* scorers */}
        <div className="grid gap-3 md:grid-cols-2 md:gap-3.5">
          <ScorerBox scorers={homeScorers} align="left" />
          <ScorerBox scorers={awayScorers} align="right" />
        </div>

        {/* stats */}
        <div className="flex flex-col gap-3 md:gap-3.5">
          {rows.map((r) => {
            const total = r.home + r.away;
            const hw = total > 0 ? (r.home / total) * 100 : 50;
            return (
              <div
                key={r.label}
                className="grid grid-cols-[44px_1fr_110px_1fr_44px] items-center gap-2 md:grid-cols-[56px_1fr_150px_1fr_56px] md:gap-3"
              >
                <span className="text-right font-display text-[18px] font-extrabold md:text-[22px]">
                  {r.home}
                  {r.pct ? "%" : ""}
                </span>
                <div className="flex h-2 justify-end overflow-hidden rounded-md bg-white/10">
                  <div
                    className="h-full rounded-md"
                    style={{ width: `${hw}%`, background: homeClub.primaryColor }}
                  />
                </div>
                <span className="text-center font-mono text-[10px] tracking-[0.16em] text-[#9aa4af] md:text-[11px]">
                  {r.label}
                </span>
                <div className="h-2 overflow-hidden rounded-md bg-white/10">
                  <div
                    className="h-full rounded-md"
                    style={{ width: `${100 - hw}%`, background: awayClub.primaryColor }}
                  />
                </div>
                <span className="font-display text-[18px] font-extrabold md:text-[22px]">
                  {r.away}
                  {r.pct ? "%" : ""}
                </span>
              </div>
            );
          })}
        </div>

        {/* cards + actions */}
        <div className="flex flex-col gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center">
          {yellows.length > 0 && (
            <CardLine
              color="#f4c20d"
              text={yellows.map((b) => `${b.playerName} ${b.minute}'`).join(" · ")}
            />
          )}
          {reds.length > 0 && (
            <CardLine
              color="#e2444a"
              text={reds.map((b) => `${b.playerName} ${b.minute}'`).join(" · ")}
            />
          )}
          <div className="flex flex-col gap-2.5 md:ml-auto md:flex-row">
            {onExit && (
              <button onClick={onExit} className={btn("ghost")}>
                Main menu
              </button>
            )}
            {netRole !== "guest" && (
              <button onClick={() => resetMatch()} className={btn("primary")}>
                Rematch
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function btn(kind: "primary" | "ghost") {
  const base =
    "rounded-md px-6 py-3 font-display text-[20px] font-extrabold uppercase tracking-[0.1em] transition-colors";
  return kind === "primary"
    ? `${base} bg-[#63d68a] text-[#0a0c0f] shadow-[0_2px_8px_rgba(0,0,0,0.45)] hover:bg-[#7ce39c]`
    : `${base} border border-white/20 text-[#c6cdd5] hover:border-[#63d68a] hover:text-[#63d68a]`;
}

function Crest({ club }: { club: Club }) {
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md md:h-[60px] md:w-[60px]"
      style={{ background: club.primaryColor, color: textOn(club.primaryColor) }}
    >
      <span className="font-display text-[20px] font-extrabold md:text-[26px]">
        {club.shortName}
      </span>
    </div>
  );
}

function Big({ n, win }: { n: number; win: boolean }) {
  return (
    <span
      className="font-display text-[56px] font-extrabold leading-[0.85] md:text-[88px]"
      style={{ color: win ? ACCENT : "#e8ecf0" }}
    >
      {n}
    </span>
  );
}

function ScorerBox({ scorers, align }: { scorers: Scorer[]; align: "left" | "right" }) {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-white/[0.04] px-4 py-3.5 md:px-[18px] md:py-4">
      <span
        className={`font-mono text-[11px] tracking-[0.16em] text-[#9aa4af] ${align === "right" ? "md:text-right" : ""}`}
      >
        SCORERS
      </span>
      {scorers.length === 0 && (
        <span className={`text-[13px] text-[#5d6a76] ${align === "right" ? "md:text-right" : ""}`}>
          —
        </span>
      )}
      {scorers.map((s) => (
        <div
          key={s.name}
          className={`flex items-baseline gap-2.5 ${align === "right" ? "md:flex-row-reverse" : ""}`}
        >
          <span className="font-display text-[19px] font-bold text-[#e8ecf0] md:text-[20px]">
            {s.name}
          </span>
          <span className="font-mono text-[12px]" style={{ color: ACCENT }}>
            {s.minutes}
          </span>
        </div>
      ))}
    </div>
  );
}

function CardLine({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="block h-[15px] w-[11px] rounded-[2px]"
        style={{ background: color }}
      />
      <span className="font-display text-[16px] font-bold md:text-[18px]">{text}</span>
    </div>
  );
}
