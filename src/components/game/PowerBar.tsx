import { useGameStore } from "../../game/store/useGameStore";

const LABEL: Record<string, string> = { shoot: "SHOT POWER", pass: "PASS POWER" };

/**
 * Charge meter for the human's strike. Sits above the player card
 * bottom-left on desktop and centre-bottom on touch layouts. Only renders
 * while a strike is being charged (IDLE_CHARGE is a stable reference, so
 * the selector doesn't re-render otherwise).
 */
export function PowerBar() {
  const charge = useGameStore((s) => s.charge);
  if (!charge.action) return null;

  const pct = Math.round(charge.power * 100);

  return (
    <div className="gb-panel pointer-events-none fixed bottom-[92px] left-1/2 z-10 w-[min(300px,calc(100vw-32px))] -translate-x-1/2 px-3 py-2.5 md:bottom-[88px] md:left-[22px] md:w-[300px] md:translate-x-0 md:px-3.5">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[10px] tracking-[0.16em] text-[#9aa4af] md:text-[11px]">
          {LABEL[charge.action]}
          {charge.loft ? " · LOFT" : ""}
        </span>
        <span
          className="font-display text-[18px] font-extrabold leading-none"
          style={{ color: "#63d68a" }}
        >
          {pct}%
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-md bg-white/10 md:h-3.5">
        <div
          className="h-full transition-[width] duration-75 ease-linear"
          style={{ width: `${pct}%`, background: "#63d68a" }}
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(0,0,0,0) 0 23px, rgba(12,14,18,0.85) 23px 25px)",
          }}
        />
        {/* sweet-spot tick */}
        <div className="absolute inset-y-0 left-[78%] w-[2px] bg-white" />
      </div>
    </div>
  );
}
