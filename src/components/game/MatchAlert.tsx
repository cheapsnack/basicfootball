import { useEffect } from "react";
import { useGameStore } from "../../game/store/useGameStore";
import { Banner } from "./MatchHud";

/**
 * Big, short-lived flash across the middle of the screen for match-state
 * changes you must not miss: a card, a corner, a penalty. Auto-clears.
 */
export function MatchAlert() {
  const alert = useGameStore((s) => s.matchAlert);
  const clearAlert = useGameStore((s) => s.clearAlert);

  useEffect(() => {
    if (!alert) return;
    const id = alert.id;
    const t = setTimeout(() => clearAlert(id), 1400);
    return () => clearTimeout(t);
  }, [alert, clearAlert]);

  if (!alert) return null;

  const red = alert.kind === "card" && alert.accent.toLowerCase() === "#ef4444";
  const yellow = alert.kind === "card" && !red;

  return (
    <Banner
      key={alert.id}
      title={alert.title}
      sub={alert.subtitle}
      bg={red ? "#e2444a" : yellow ? "#f4c20d" : "#ffffff"}
      fg={red ? "#ffffff" : "#0a0c0f"}
      subFg={red ? "rgba(255,255,255,0.85)" : "rgba(10,12,15,0.7)"}
    />
  );
}
