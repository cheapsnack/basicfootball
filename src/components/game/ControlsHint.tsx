import { useGameStore } from "../../game/store/useGameStore";

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="font-semibold text-[#e8ecf0]">{children}</span>
);
const Sep = () => <span className="mx-2 text-white/20">|</span>;

/**
 * Keyboard hint strip, centred along the bottom edge between the player
 * card (left) and the possession widget (right). Hidden while a strike is
 * charging so it never fights the power meter on narrow desktops.
 */
export function ControlsHint() {
  const charging = useGameStore((s) => s.charge.action !== null);
  if (charging) return null;
  return (
    <div className="gb-panel pointer-events-none fixed bottom-4 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap px-3.5 py-2 font-mono text-[11px] text-[#9aa4af] lg:block">
      <Key>WASD</Key> move
      <Sep />
      <Key>Shift</Key> sprint
      <Sep />
      <Key>Space</Key> shoot
      <Sep />
      <Key>E</Key> pass
      <Sep />
      <Key>Shift+E</Key> through
      <Sep />
      <Key>Ctrl</Key> loft
      <Sep />
      <Key>F</Key> slide
      <Sep />
      <Key>Q</Key> switch
      <Sep />
      <Key>C</Key> camera
    </div>
  );
}
