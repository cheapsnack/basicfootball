import { useCallback, useEffect, useRef, useState } from "react";
import type { TouchState } from "../../hooks/useTouchInput";

type Props = {
  /** The touch-input state ref from useTouchInput — buttons write into it. */
  stateRef: React.MutableRefObject<TouchState>;
  /** Whether the screen is narrow enough to need compact layout. */
  compact?: boolean;
};

const ACCENT = "#63d68a";
const PANEL = "rgba(12,14,18,0.62)";
const PANEL_ON = "rgba(99,214,138,0.28)";

/**
 * On-screen controller overlay — FIFA/eFootball mobile layout:
 *
 *  LEFT HALF  — virtual joystick (150px well, 66px knob)
 *  RIGHT HALF — action buttons in a diamond:
 *               [Switch] top
 *     [Pass] left   [Shoot] right
 *               [Tackle] bottom
 *
 * Sprint is automatic: the joystick input above SPRINT_THRESHOLD (outer 35%
 * of the stick) is treated as a sprint, so no dedicated sprint button is
 * needed — matches how FIFA Mobile handles it.
 *
 * The component doesn't own any state that flows into the physics loop.
 * It only writes into `stateRef.current`, which the frame loop reads each
 * frame via `useTouchInput().getInput()`.
 */
export function MobileControls({ stateRef, compact }: Props) {
  const [isTouch, setIsTouch] = useState(false);
  const [joyCentre, setJoyCentre] = useState<{ x: number; y: number } | null>(null);
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [held, setHeld] = useState<Set<string>>(new Set());
  const joystickId = useRef<number | null>(null);

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const touchPoints = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    setIsTouch(coarse && touchPoints);
  }, []);

  const BTN_SIZE = compact ? 56 : 66;
  const JOY_RADIUS = compact ? 62 : 75;
  const KNOB = compact ? 56 : 66;

  // ── joystick (left half, handled here for visual feedback) ────────────────
  const onJoyStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0]!;
    joystickId.current = t.identifier;
    setJoyCentre({ x: t.clientX, y: t.clientY });
    setJoyKnob({ x: 0, y: 0 });
  }, []);

  const onJoyMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (joystickId.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i]!;
        if (t.identifier !== joystickId.current) continue;
        const cx = joyCentre?.x ?? t.clientX;
        const cy = joyCentre?.y ?? t.clientY;
        const dx = t.clientX - cx;
        const dy = t.clientY - cy;
        const mag = Math.hypot(dx, dy);
        const norm = Math.min(1, mag / JOY_RADIUS);
        const kx = mag > 0 ? (dx / mag) * norm * JOY_RADIUS : 0;
        const ky = mag > 0 ? (dy / mag) * norm * JOY_RADIUS : 0;
        setJoyKnob({ x: kx, y: ky });
      }
    },
    [joyCentre, JOY_RADIUS],
  );

  const onJoyEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    joystickId.current = null;
    setJoyCentre(null);
    setJoyKnob({ x: 0, y: 0 });
  }, []);

  // ── action buttons ────────────────────────────────────────────────────────
  const pressButton = useCallback(
    (name: string) => {
      stateRef.current = { ...stateRef.current, [name]: true };
      setHeld((h) => new Set([...h, name]));
    },
    [stateRef],
  );

  const releaseButton = useCallback(
    (name: string) => {
      stateRef.current = { ...stateRef.current, [name]: false };
      setHeld((h) => {
        const n = new Set(h);
        n.delete(name);
        return n;
      });
    },
    [stateRef],
  );

  const btnHandlers = (name: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      pressButton(name);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      releaseButton(name);
    },
    onTouchCancel: (e: React.TouchEvent) => {
      e.preventDefault();
      releaseButton(name);
    },
  });

  const btnStyle = (name: string, primary: boolean): React.CSSProperties => {
    const on = held.has(name);
    return {
      position: "absolute",
      width: BTN_SIZE,
      height: BTN_SIZE,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: compact ? 13 : 15,
      fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
      fontWeight: 800,
      letterSpacing: "0.06em",
      color: primary || on ? ACCENT : "#e8ecf0",
      background: on ? PANEL_ON : PANEL,
      border: `2px solid ${primary || on ? ACCENT : "rgba(255,255,255,0.18)"}`,
      boxShadow: on ? `0 0 16px ${ACCENT}66` : "0 2px 8px rgba(0,0,0,0.45)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      userSelect: "none",
      WebkitUserSelect: "none",
      touchAction: "none",
      transition: "background 0.06s, box-shadow 0.06s",
      cursor: "pointer",
    };
  };

  // Layout constants — diamond arrangement on the right
  const PAD = compact ? 16 : 22;
  const GAP = compact ? 6 : 8;

  // Only show on real touch devices — a narrow desktop window is still a
  // desktop, so screen width alone is the wrong test.
  if (!isTouch) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 30,
        touchAction: "none",
      }}
    >
      <div
        className="mobile-controls-root"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {/* ── LEFT: Virtual joystick ── */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: "48%",
            height: "55%",
            pointerEvents: "auto",
            touchAction: "none",
          }}
          onTouchStart={onJoyStart}
          onTouchMove={onJoyMove}
          onTouchEnd={onJoyEnd}
          onTouchCancel={onJoyEnd}
        >
          {joyCentre && (
            <>
              {/* Well */}
              <div
                style={{
                  position: "absolute",
                  left: joyCentre.x - JOY_RADIUS,
                  top: joyCentre.y - JOY_RADIUS,
                  width: JOY_RADIUS * 2,
                  height: JOY_RADIUS * 2,
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: PANEL,
                }}
              />
              {/* Knob */}
              <div
                style={{
                  position: "absolute",
                  left: joyCentre.x + joyKnob.x - KNOB / 2,
                  top: joyCentre.y + joyKnob.y - KNOB / 2,
                  width: KNOB,
                  height: KNOB,
                  borderRadius: "50%",
                  background: "rgba(12,14,18,0.85)",
                  border: `2px solid ${ACCENT}`,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.45)",
                }}
              />
            </>
          )}
          {/* Ghost joystick when idle — shows where to press */}
          {!joyCentre && (
            <div
              style={{
                position: "absolute",
                left: PAD + JOY_RADIUS,
                bottom: PAD + JOY_RADIUS,
                transform: "translate(-50%, 50%)",
                width: JOY_RADIUS * 2,
                height: JOY_RADIUS * 2,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(12,14,18,0.4)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: KNOB,
                  height: KNOB,
                  transform: "translate(-50%, -50%)",
                  borderRadius: "50%",
                  border: "2px solid rgba(99,214,138,0.5)",
                  background: "rgba(12,14,18,0.6)",
                }}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: Action buttons — diamond layout ── */}
        <div
          style={{
            position: "absolute",
            right: PAD,
            bottom: PAD,
            width: BTN_SIZE * 3 + GAP * 2,
            height: BTN_SIZE * 3 + GAP * 2,
            pointerEvents: "auto",
            touchAction: "none",
          }}
        >
          {/* Shoot — right of diamond, accent */}
          <div
            {...btnHandlers("shoot")}
            style={{ ...btnStyle("shoot", true), right: 0, top: BTN_SIZE + GAP }}
          >
            SHOOT
          </div>
          {/* Pass — left of diamond */}
          <div
            {...btnHandlers("pass")}
            style={{ ...btnStyle("pass", false), left: 0, top: BTN_SIZE + GAP }}
          >
            PASS
          </div>
          {/* Tackle — bottom of diamond */}
          <div
            {...btnHandlers("tackle")}
            style={{ ...btnStyle("tackle", false), left: BTN_SIZE + GAP, bottom: 0 }}
          >
            TACKLE
          </div>
          {/* Switch player — top of diamond */}
          <div
            {...btnHandlers("switchPlayer")}
            style={{ ...btnStyle("switchPlayer", false), left: BTN_SIZE + GAP, top: 0 }}
          >
            SWITCH
          </div>
        </div>
      </div>
    </div>
  );
}
