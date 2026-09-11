import { useGameStore } from "../../game/store/useGameStore";

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold">{children}</span>
);

const Sep = () => <span className="mx-2 opacity-40">|</span>;

/**
 * Keyboard hint strip. Centred along the bottom edge so it never collides
 * with the controlled-player card pinned bottom-left. Lifts above the
 * bookings ticker when one is showing.
 */
export function ControlsHint() {
  const hasBookings = useGameStore((s) => s.bookings.length > 0);
  return (
    <div
      className={`pointer-events-none fixed left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground/70 px-3 py-2 font-mono text-xs text-background backdrop-blur-sm md:block ${
        hasBookings ? "bottom-16" : "bottom-4"
      }`}
    >
      <Key>WASD / Arrows</Key> move
      <Sep />
      <Key>Shift</Key> sprint
      <Sep />
      <Key>Space</Key> shoot
      <Sep />
      <Key>E</Key> pass
      <Sep />
      <Key>Ctrl</Key> loft
      <span className="ml-2 opacity-60">(hold to charge)</span>
      <Sep />
      <Key>C</Key> camera
      <Sep />
      <Key>Q</Key> switch player
      <Sep />
      <Key>F</Key> tackle
    </div>
  );
}
