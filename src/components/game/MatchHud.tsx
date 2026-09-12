import { useState } from "react";
import { useGameStore } from "../../game/store/useGameStore";
import { displayClock, formatClock, MATCH_TUNING, periodLabel } from "../../game/logic/match";
import { getClub } from "../../game/data/clubs";
import type { Club } from "../../game/types";
import { ExitConfirm } from "./ExitConfirm";
import { PostMatch } from "./PostMatch";

const ACCENT = "#63d68a";

/** Pick black or white text for legibility on a club colour. */
export function textOn(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 160 ? "#0a0c0f" : "#ffffff";
}

export function MatchHud({ onExit }: { onExit?: (() => void) | undefined }) {
  const score = useGameStore((s) => s.score);
  const matchTime = useGameStore((s) => s.matchTime);
  const period = useGameStore((s) => s.period);
  const status = useGameStore((s) => s.matchStatus);
  const lastScorer = useGameStore((s) => s.lastScorer);
  const netRole = useGameStore((s) => s.netRole);
  const bookings = useGameStore((s) => s.bookings);
  const goals = useGameStore((s) => s.goals);
  const homeClub = useGameStore((s) => getClub(s.homeClubId));
  const awayClub = useGameStore((s) => getClub(s.awayClubId));

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const clock = formatClock(displayClock(period, matchTime));
  const clubOf = (team: "home" | "away") => (team === "home" ? homeClub : awayClub);
  const lastGoal = goals[goals.length - 1];

  const goalSubtitle = (team: "home" | "away") => {
    const club = clubOf(team);
    const minute = lastGoal ? ` · ${lastGoal.minute}'` : "";
    if (netRole === "local") return `${team === "home" ? "You score" : "Conceded"}${minute}`;
    return `${club.name}${minute}`;
  };

  return (
    <>
      {onExit && status !== "fulltime" && (
        <button
          onClick={() => setShowExitConfirm(true)}
          className="gb-panel fixed right-4 top-5 z-20 px-4 py-2 font-body text-[12px] font-semibold uppercase tracking-[0.08em] text-[#c6cdd5] transition-colors hover:border-[#63d68a] hover:text-[#63d68a]"
        >
          End game
        </button>
      )}

      <ExitConfirm
        open={showExitConfirm}
        onResume={() => setShowExitConfirm(false)}
        onExit={() => {
          setShowExitConfirm(false);
          onExit?.();
        }}
      />

      {/* Broadcast score bug */}
      <div className="pointer-events-none fixed left-1/2 top-3.5 z-10 -translate-x-1/2 md:top-5">
        <div className="flex items-stretch overflow-hidden rounded-md border border-white/10 bg-[#0c0e12]/85 shadow-[0_2px_8px_rgba(0,0,0,0.45)] backdrop-blur-[10px]">
          <Badge club={homeClub} />
          <div className="flex items-center gap-2.5 px-3 py-1.5 md:gap-3.5 md:px-5 md:py-2.5">
            <span className="font-display text-[24px] font-extrabold leading-none text-white md:text-[38px]">
              {score.home}
            </span>
            <span className="h-4 w-[2px] bg-white/25 md:h-[26px]" />
            <span className="font-display text-[24px] font-extrabold leading-none text-white md:text-[38px]">
              {score.away}
            </span>
          </div>
          <Badge club={awayClub} />
          <div className="flex flex-col items-center justify-center border-l border-white/10 bg-white/5 px-3 py-1 md:px-[18px]">
            <span
              className="font-display text-[18px] font-extrabold leading-none tabular-nums md:text-[26px]"
              style={{ color: ACCENT }}
            >
              {clock}
            </span>
            <span className="hidden font-mono text-[10px] tracking-[0.16em] text-[#9aa4af] md:block">
              {periodLabel(period).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Bookings strip — top-left, one row per card */}
      {bookings.length > 0 && (
        <div className="pointer-events-none fixed left-4 top-[58px] z-10 flex flex-col gap-1.5 md:left-[22px] md:top-[22px]">
          {bookings.map((b, i) => (
            <div key={i} className="gb-panel flex items-center gap-2 px-2.5 py-1.5">
              <span
                aria-hidden
                className="block h-[15px] w-[11px] shrink-0 rounded-[2px]"
                style={{ background: b.color === "yellow" ? "#f4c20d" : "#e2444a" }}
              />
              <span className="font-display text-[15px] font-bold tracking-[0.04em] text-[#e8ecf0] md:text-[17px]">
                {b.playerName}
              </span>
              <span className="font-mono text-[11px] text-[#9aa4af]">{b.minute}'</span>
              {b.color === "red" && (
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#e2444a]">
                  off
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Event banners */}
      {status === "goal" && lastScorer && (
        <Banner
          key={goals.length}
          title="GOAL"
          sub={goalSubtitle(lastScorer)}
          bg={ACCENT}
          fg="#0a0c0f"
          subFg="rgba(10,12,15,0.72)"
        />
      )}
      {status === "kickoff" && (
        <Banner
          title="KICK OFF"
          sub={periodLabel(period)}
          bg="#ffffff"
          fg="#0a0c0f"
          subFg="rgba(10,12,15,0.7)"
        />
      )}
      {status === "halftime" && (
        <Banner
          title={period >= MATCH_TUNING.periods ? "BREAK" : "HALF TIME"}
          sub={`${homeClub.shortName} ${score.home} – ${score.away} ${awayClub.shortName}`}
          hold
        />
      )}
      {status === "extratime" && (
        <Banner title="EXTRA TIME" sub={`Level at ${score.home} – ${score.away}`} hold />
      )}

      {status === "fulltime" && <PostMatch onExit={onExit} />}
    </>
  );
}

function Badge({ club }: { club: Club }) {
  return (
    <div
      className="flex items-center px-2.5 md:px-4"
      style={{ backgroundColor: club.primaryColor, color: textOn(club.primaryColor) }}
      title={club.name}
    >
      <span className="font-display text-[20px] font-extrabold tracking-[0.04em] md:text-[30px]">
        {club.shortName}
      </span>
    </div>
  );
}

/**
 * Centre-screen event banner. Animated variants fade out after 1.3 s on
 * their own; `hold` variants stay while the status lasts (half time, etc).
 */
export function Banner({
  title,
  sub,
  bg = "rgba(12,14,18,0.92)",
  fg = ACCENT,
  subFg = "#e8ecf0",
  hold = false,
}: {
  title: string;
  sub?: string;
  bg?: string;
  fg?: string;
  subFg?: string;
  hold?: boolean;
}) {
  const bordered = bg.startsWith("rgba(12");
  return (
    <div
      className={`pointer-events-none fixed left-1/2 top-1/2 z-20 ${hold ? "gb-banner-hold" : "gb-banner-in"}`}
    >
      <div
        className="flex flex-col items-center gap-1 rounded-md px-8 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.5)] md:px-16 md:py-5"
        style={{ background: bg, border: bordered ? "1px solid rgba(255,255,255,0.14)" : "none" }}
      >
        <span
          className="whitespace-nowrap font-display text-[48px] font-extrabold uppercase leading-[0.85] tracking-[0.02em] md:text-[96px]"
          style={{ color: fg }}
        >
          {title}
        </span>
        {sub && (
          <span
            className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.2em] md:text-[15px]"
            style={{ color: subFg }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
