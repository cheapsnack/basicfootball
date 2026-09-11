import { useState } from "react";
import { useGameStore } from "../../game/store/useGameStore";
import { displayClock, formatClock, MATCH_TUNING, periodLabel } from "../../game/logic/match";
import type { Booking } from "../../game/logic/bookings";
import { getClub } from "../../game/data/clubs";
import type { Club } from "../../game/types";
import { ExitConfirm } from "./ExitConfirm";

/** Pick black or white text for legibility on a club colour. */
function textOn(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 160 ? "#101418" : "#ffffff";
}

export function MatchHud({ onExit }: { onExit?: (() => void) | undefined }) {
  const resetMatch = useGameStore((s) => s.resetMatch);
  const score = useGameStore((s) => s.score);
  const matchTime = useGameStore((s) => s.matchTime);
  const period = useGameStore((s) => s.period);
  const status = useGameStore((s) => s.matchStatus);
  const lastScorer = useGameStore((s) => s.lastScorer);
  const netRole = useGameStore((s) => s.netRole);
  const bookings = useGameStore((s) => s.bookings);
  const homeClub = useGameStore((s) => getClub(s.homeClubId));
  const awayClub = useGameStore((s) => getClub(s.awayClubId));

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const clock = formatClock(displayClock(period, matchTime));
  const clubOf = (team: "home" | "away") => (team === "home" ? homeClub : awayClub);

  const goalSubtitle = (team: "home" | "away") => {
    if (netRole === "local") return team === "home" ? "You score" : "Conceded";
    return `${clubOf(team).name} score`;
  };

  return (
    <>
      {/* Always-available way out of a match, back to the main menu. */}
      {onExit && status !== "fulltime" && (
        <button
          onClick={() => setShowExitConfirm(true)}
          className="fixed right-4 top-5 z-20 rounded-md bg-foreground/80 px-4 py-2 font-sans text-[10px] font-black uppercase tracking-[0.22em] text-background/80 shadow-lg backdrop-blur-sm transition-colors hover:text-background"
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
      <div className="pointer-events-none fixed left-1/2 top-5 z-10 -translate-x-1/2">
        <div className="flex items-stretch overflow-hidden rounded-md bg-foreground/80 font-sans text-background shadow-lg backdrop-blur-sm">
          <Badge club={homeClub} />
          <div className="flex items-center gap-2 px-4 py-2 font-mono text-lg font-bold tabular-nums tracking-widest">
            <span>{score.home}</span>
            <span className="opacity-40">-</span>
            <span>{score.away}</span>
          </div>
          <Badge club={awayClub} />
          <div className="flex flex-col items-center justify-center border-l border-background/20 px-3 py-1">
            <span className="font-mono text-sm font-semibold tabular-nums leading-tight">
              {clock}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] opacity-60">
              {periodLabel(period)}
            </span>
          </div>
        </div>
      </div>

      {/* Status overlays */}
      {status === "goal" && lastScorer && (
        <Banner
          title="GOAL!"
          subtitle={goalSubtitle(lastScorer)}
          accent={clubOf(lastScorer).primaryColor}
        />
      )}
      {status === "kickoff" && <Banner title="KICK OFF" subtitle={periodLabel(period)} />}
      {status === "halftime" && (
        <Banner
          title={period >= MATCH_TUNING.periods ? "BREAK" : "HALF TIME"}
          subtitle={`${homeClub.shortName} ${score.home} - ${score.away} ${awayClub.shortName}`}
        />
      )}
      {status === "extratime" && (
        <Banner title="EXTRA TIME" subtitle={`Level at ${score.home} - ${score.away}`} />
      )}

      {status === "fulltime" && (
        <Banner
          title="FULL TIME"
          subtitle={`${homeClub.shortName} ${score.home} - ${score.away} ${awayClub.shortName}`}
        >
          <div className="pointer-events-auto mt-5 flex justify-center gap-3">
            {netRole !== "guest" && (
              <button
                onClick={() => resetMatch()}
                className="rounded-md bg-background px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-foreground transition-transform hover:scale-[1.03]"
              >
                Rematch
              </button>
            )}
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-md border border-background/40 px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-background/80 transition-colors hover:bg-background/10"
              >
                Main menu
              </button>
            )}
          </div>
        </Banner>
      )}

      {/* Bookings ticker along the bottom edge — quiet when empty. */}
      {bookings.length > 0 && (
        <BookingsTicker bookings={bookings} homeClub={homeClub} awayClub={awayClub} />
      )}
    </>
  );
}

function BookingsTicker({
  bookings,
  homeClub,
  awayClub,
}: {
  bookings: Booking[];
  homeClub: Club;
  awayClub: Club;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
      <div className="flex max-w-full items-center gap-3 overflow-x-auto rounded-md bg-foreground/80 px-4 py-2 font-sans text-[11px] text-background shadow-lg backdrop-blur-sm">
        <span className="shrink-0 font-bold uppercase tracking-[0.2em] text-background/60">
          Bookings
        </span>
        {bookings.map((b, i) => (
          <div key={i} className="flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden
              className={`inline-block h-3.5 w-2.5 rounded-sm ${
                b.color === "yellow" ? "bg-yellow-400" : "bg-red-500"
              }`}
              style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.3)" }}
            />
            <span className="font-mono tabular-nums text-background/50">{b.minute}'</span>
            <span className="font-semibold">{b.playerName}</span>
            <span className="text-background/40">
              ({b.team === "home" ? homeClub.shortName : awayClub.shortName})
            </span>
            {b.color === "red" && (
              <span className="ml-1 rounded-sm bg-red-500/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                Sent off
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ club }: { club: Club }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold tracking-[0.16em]"
      style={{ backgroundColor: club.primaryColor, color: textOn(club.primaryColor) }}
      title={club.name}
    >
      <span
        aria-hidden
        className="inline-block h-3 w-3 rounded-full"
        style={{
          backgroundColor: club.secondaryColor,
          boxShadow: "0 0 0 1.5px rgba(0,0,0,0.35)",
        }}
      />
      {club.shortName}
    </div>
  );
}

function Banner({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-1/3 z-10 flex flex-col items-center">
      <div
        className="rounded-lg bg-foreground/80 px-10 py-5 text-center backdrop-blur-sm"
        style={accent ? { boxShadow: `0 0 0 3px ${accent}` } : undefined}
      >
        <div className="font-sans text-5xl font-black tracking-[0.1em] text-background">
          {title}
        </div>
        {subtitle && (
          <div className="mt-1 text-xs font-semibold uppercase tracking-[0.3em] text-background/70">
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
