import { useRef, useState } from "react";
import { initAudio, isAudioEnabled, setAudioEnabled } from "../../game/logic/audio";
import { MATCH_TUNING } from "../../game/logic/match";
import { CLUBS, DEFAULT_AWAY_CLUB_ID, DEFAULT_HOME_CLUB_ID, getClub } from "../../game/data/clubs";
import { DIFFICULTY_LABEL, type Difficulty } from "../../game/logic/ai/difficulty";
import { MENTALITY_LABEL, type Mentality } from "../../game/logic/ai/mentality";
import { useGameStore } from "../../game/store/useGameStore";
import { createRoom, joinRoom } from "../../multiplayer/roomClient";
import { useRoomChannel } from "../../multiplayer/useRoomChannel";
import type { Club } from "../../game/types";

type Mode = "ai" | "local2p" | "friend" | "penalties" | "freekicks";
type FriendStep = "choose" | "create-waiting" | "join-form" | "connecting";
const DIFFICULTIES: Difficulty[] = ["beginner", "amateur", "advanced", "expert"];
const MENTALITIES: Mentality[] = ["defensive", "balanced", "attacking"];

const ACCENT = "#63d68a";

const MODES: { id: Mode; title: string; blurb: string }[] = [
  { id: "ai", title: "Kick Off", blurb: "Full 11 v 11 match against the AI." },
  { id: "penalties", title: "Penalty Shootout", blurb: "Best of five, then sudden death." },
  { id: "freekicks", title: "Free Kick", blurb: "Curl, dip, beat the wall." },
  { id: "friend", title: "Online 1v1", blurb: "Share a room code, play a friend." },
  { id: "local2p", title: "Local 1v1", blurb: "Two players, one keyboard." },
];

/**
 * Pre-match screen. Rendered instead of the Canvas so nothing simulates (and
 * no WebGL context is created) until the player commits — this also gives us
 * the user gesture WebAudio needs before it will make a sound.
 */
export function MainMenu({
  onKickoff,
}: {
  onKickoff: (kind?: "match" | "penalties" | "freekicks") => void;
}) {
  const [sound, setSound] = useState(isAudioEnabled());
  const [homeId, setHomeId] = useState(DEFAULT_HOME_CLUB_ID);
  const [awayId, setAwayId] = useState(DEFAULT_AWAY_CLUB_ID);
  const setClubs = useGameStore((s) => s.setClubs);
  const setNetRoom = useGameStore((s) => s.setNetRoom);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const mentality = useGameStore((s) => s.mentality);
  const setMentality = useGameStore((s) => s.setMentality);

  const [mode, setMode] = useState<Mode>("ai");
  const [friendStep, setFriendStep] = useState<FriendStep>("choose");
  const [roomCode, setRoomCode] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Which of the two DB flows we're mid-way through, so the shared onSubscribed handler knows what to do. */
  const [pendingAction, setPendingAction] = useState<"create" | "join" | null>(null);
  /** The channel needs a code to subscribe to; null keeps it fully inert until one exists. */
  const [channelCode, setChannelCode] = useState<string | null>(null);
  /** Host's room id, needed once the guest joins — not rendered, so a ref, not state. */
  const hostRoomId = useRef<string | null>(null);

  const channel = useRoomChannel(channelCode, {
    onGuestJoined: (payload) => {
      // Host side: the guest has joined and told us their club — start the match.
      if (sound) initAudio();
      setAudioEnabled(sound);
      setClubs(homeId, payload.guestClubId);
      setNetRoom("host", channelCode, hostRoomId.current);
      onKickoff();
    },
    onSubscribed: async () => {
      if (pendingAction !== "join") return;
      // Guest side: channel is live, now actually claim the room in the DB.
      try {
        const room = await joinRoom(joinCodeInput, homeId);
        channel.sendGuestJoined({ guestClubId: homeId });
        if (sound) initAudio();
        setAudioEnabled(sound);
        setClubs(room.host_club_id, homeId);
        setNetRoom("guest", room.code, room.id);
        onKickoff();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not join that room.");
        setFriendStep("join-form");
        setChannelCode(null);
        setPendingAction(null);
      }
    },
  });

  const armAudio = () => {
    if (sound) initAudio();
    setAudioEnabled(sound);
  };
  const opponent = () => (awayId === homeId ? DEFAULT_AWAY_CLUB_ID : awayId);

  const startVsAi = () => {
    armAudio();
    setClubs(homeId, opponent());
    setNetRoom("local", null, null);
    onKickoff();
  };

  const startLocal2P = () => {
    armAudio();
    setClubs(homeId, opponent());
    setNetRoom("local2p", null, null);
    onKickoff();
  };

  /** Standalone shootout — no match simulation, straight to the spot. */
  const startPenalties = () => {
    armAudio();
    setClubs(homeId, opponent());
    setNetRoom("local", null, null);
    onKickoff("penalties");
  };

  /** Standalone free-kick practice — aim, bend and power against a wall. */
  const startFreeKicks = () => {
    armAudio();
    setClubs(homeId, opponent());
    setNetRoom("local", null, null);
    onKickoff("freekicks");
  };

  const startCreateRoom = async () => {
    setError(null);
    setFriendStep("connecting");
    setPendingAction("create");
    try {
      const room = await createRoom(homeId);
      hostRoomId.current = room.id;
      setRoomCode(room.code);
      setChannelCode(room.code); // subscribes; onGuestJoined fires once someone joins
      setFriendStep("create-waiting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a room.");
      setFriendStep("choose");
      setPendingAction(null);
    }
  };

  const startJoinRoom = () => {
    if (joinCodeInput.trim().length < 4) {
      setError("Enter the room code your friend shared.");
      return;
    }
    setError(null);
    setPendingAction("join");
    setFriendStep("connecting");
    setChannelCode(joinCodeInput.trim().toUpperCase()); // triggers onSubscribed above
  };

  const cancelFriendFlow = () => {
    setFriendStep("choose");
    setChannelCode(null);
    setPendingAction(null);
    setError(null);
  };

  const selectMode = (m: Mode) => {
    setMode(m);
    if (m !== "friend") cancelFriendFlow();
  };

  const minutes = Math.round((MATCH_TUNING.periodSeconds * MATCH_TUNING.periods) / 60);
  const homeClub = getClub(homeId);
  const awayClub = getClub(opponent());

  const primaryAction: { label: string; onClick: () => void } | null =
    mode === "ai"
      ? { label: "Start match", onClick: startVsAi }
      : mode === "local2p"
        ? { label: "Start match", onClick: startLocal2P }
        : mode === "penalties"
          ? { label: "Take penalties", onClick: startPenalties }
          : mode === "freekicks"
            ? { label: "Take free kicks", onClick: startFreeKicks }
            : null;

  const showDifficulty = mode === "ai" || mode === "penalties" || mode === "freekicks";
  const showMentality = mode === "ai" || mode === "local2p" || mode === "friend";
  const showOpponent = mode !== "friend";

  return (
    <div className="gb-stripes fixed inset-0 z-20 overflow-y-auto font-body text-[#e8ecf0]">
      <div className="mx-auto flex min-h-full w-full max-w-[1180px] flex-col gap-4 px-4 py-6 sm:px-8 sm:py-8 lg:gap-5">
        {/* header */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
            <span className="font-display text-[38px] font-extrabold uppercase leading-[0.9] tracking-[-0.01em] sm:text-[44px]">
              Goodball
            </span>
            <span
              className="font-display text-[11px] font-bold uppercase tracking-[0.26em] sm:text-[13px]"
              style={{ color: ACCENT }}
            >
              Arcade Football
            </span>
          </div>
          <button
            onClick={() => setSound((s) => !s)}
            className="gb-panel px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#c6cdd5] transition-colors hover:border-[#63d68a] hover:text-[#63d68a] sm:px-4 sm:text-[13px]"
          >
            Sound {sound ? "on" : "off"}
          </button>
        </div>

        {/* mode cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-5">
          {MODES.map((m, i) => {
            const on = m.id === mode;
            return (
              <button
                key={m.id}
                onClick={() => selectMode(m.id)}
                className="flex min-h-[78px] flex-col items-start justify-end gap-1.5 rounded-md border px-3 py-3 text-left transition-colors sm:min-h-[140px] sm:gap-2.5 sm:px-4 sm:py-4"
                style={{
                  background: on ? "rgba(99,214,138,0.10)" : "rgba(12,14,18,0.85)",
                  borderColor: on ? ACCENT : "rgba(255,255,255,0.10)",
                  boxShadow: on ? "0 2px 8px rgba(0,0,0,0.45)" : "none",
                  backdropFilter: "blur(10px)",
                }}
              >
                <span
                  className="hidden font-mono text-[11px] tracking-[0.14em] sm:block"
                  style={{ color: ACCENT }}
                >
                  0{i + 1}
                </span>
                <span className="font-display text-[21px] font-extrabold uppercase leading-[0.95] sm:text-[26px]">
                  {m.title}
                </span>
                <span className="hidden text-[13px] leading-[1.35] text-[#98a2ad] sm:block">
                  {m.blurb}
                </span>
              </button>
            );
          })}
        </div>

        {/* club pickers */}
        <div className={`grid gap-3 ${showOpponent ? "lg:grid-cols-2" : ""}`}>
          <ClubPanel
            label={mode === "local2p" ? "Player 1" : "Your club"}
            selected={homeClub}
            selectedId={homeId}
            onSelect={setHomeId}
          />
          {showOpponent && (
            <ClubPanel
              label={mode === "local2p" ? "Player 2" : "Opponent"}
              selected={awayClub}
              selectedId={awayId}
              onSelect={setAwayId}
            />
          )}
        </div>

        {/* difficulty + mentality */}
        {(showDifficulty || showMentality) && (
          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            {showDifficulty && (
              <Panel title="Difficulty">
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  {DIFFICULTIES.map((d) => (
                    <Pill key={d} on={d === difficulty} onClick={() => setDifficulty(d)}>
                      {DIFFICULTY_LABEL[d]}
                    </Pill>
                  ))}
                </div>
              </Panel>
            )}
            {showMentality && (
              <Panel title="Mentality">
                <div className="flex gap-[3px] rounded-md bg-white/5 p-[3px]">
                  {MENTALITIES.map((m) => {
                    const on = m === mentality;
                    return (
                      <button
                        key={m}
                        onClick={() => setMentality(m)}
                        className="flex-1 rounded-[4px] py-2 font-display text-[15px] font-extrabold uppercase tracking-[0.08em] transition-colors sm:text-[17px]"
                        style={{
                          background: on ? ACCENT : "transparent",
                          color: on ? "#0a0c0f" : "#98a2ad",
                        }}
                      >
                        {MENTALITY_LABEL[m]}
                      </button>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* mode-specific notes */}
        {mode === "ai" && (
          <Note>
            {MATCH_TUNING.periods} halves · {minutes} minutes · 11 v 11. Hold <b>Space</b> to charge
            a shot, <b>E</b> to pass (aim with the stick, hold <b>Shift</b> for a through ball),{" "}
            <b>F</b> to slide, <b>Q</b> switches player, <b>C</b> flips the camera.
          </Note>
        )}
        {mode === "penalties" && (
          <Note>
            <b>Best of five, then sudden death.</b> Aim with the arrows or WASD, hold Space to build
            power, release to strike.
          </Note>
        )}
        {mode === "freekicks" && (
          <Note>
            <b>Five kicks against a wall.</b> Aim with the arrows or WASD, bend the ball with Z / X,
            hold Space for power.
          </Note>
        )}
        {mode === "local2p" && (
          <Note>
            <b>One keyboard, two players.</b> Player 1 uses WASD + Space / E / Ctrl / Q / F / C.
            Player 2 uses the Arrow keys + Enter (shoot) / &apos; (pass) / Slash (loft) / Period
            (tackle) / Semicolon (switch).
          </Note>
        )}

        {/* online flow */}
        {mode === "friend" && (
          <Panel title="Online room">
            {error && (
              <p className="rounded-md bg-[#e2444a]/15 px-3 py-2 text-xs font-semibold text-[#ff9a9a]">
                {error}
              </p>
            )}
            {friendStep === "choose" && (
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <button onClick={startCreateRoom} className={cta()}>
                  Create room
                </button>
                <button onClick={() => setFriendStep("join-form")} className={ghost()}>
                  Join room
                </button>
              </div>
            )}
            {friendStep === "connecting" && (
              <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-[#9aa4af]">
                Connecting…
              </p>
            )}
            {friendStep === "create-waiting" && (
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#9aa4af]">
                  Share this code
                </span>
                <div
                  className="rounded-md py-4 text-center font-mono text-4xl font-black tracking-[0.3em]"
                  style={{
                    border: `1px solid ${ACCENT}66`,
                    background: `${ACCENT}1a`,
                    color: ACCENT,
                  }}
                >
                  {roomCode}
                </div>
                <span className="text-sm text-[#9aa4af]">Waiting for your friend to join…</span>
                <button onClick={cancelFriendFlow} className={link()}>
                  Cancel
                </button>
              </div>
            )}
            {friendStep === "join-form" && (
              <div className="flex flex-col gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#9aa4af]">
                  Room code
                </span>
                <input
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABCDE"
                  maxLength={6}
                  className="w-full rounded-md border border-white/15 bg-transparent px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.3em] text-[#e8ecf0] outline-none focus:border-[#63d68a]"
                />
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <button onClick={startJoinRoom} className={cta()}>
                    Join
                  </button>
                  <button onClick={cancelFriendFlow} className={ghost()}>
                    Back
                  </button>
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* primary CTA */}
        {primaryAction && (
          <div className="mt-auto flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4">
            <button onClick={primaryAction.onClick} className={cta("big")}>
              {primaryAction.label}
            </button>
            <span className="hidden font-mono text-[12px] text-[#6f7a85] sm:block">
              {homeClub.shortName} vs {awayClub.shortName}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */

function cta(size: "big" | "normal" = "normal") {
  return `rounded-md bg-[#63d68a] font-display font-extrabold uppercase tracking-[0.1em] text-[#0a0c0f] shadow-[0_2px_8px_rgba(0,0,0,0.45)] transition-colors hover:bg-[#7ce39c] ${
    size === "big" ? "px-10 py-4 text-[26px] sm:px-14 sm:text-[30px]" : "px-6 py-3 text-[18px]"
  }`;
}
function ghost() {
  return "rounded-md border border-white/20 px-6 py-3 font-display text-[18px] font-extrabold uppercase tracking-[0.1em] text-[#c6cdd5] transition-colors hover:border-[#63d68a] hover:text-[#63d68a]";
}
function link() {
  return "self-start text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9aa4af] hover:text-[#e8ecf0]";
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="gb-panel flex flex-col gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
      <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.2em] text-[#c6cdd5] sm:text-[15px]">
        {title}
      </span>
      {children}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="gb-panel px-4 py-3 text-[13px] leading-relaxed text-[#98a2ad] [&_b]:text-[#e8ecf0]">
      {children}
    </p>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-md border px-3 py-2.5 font-display text-[16px] font-extrabold uppercase tracking-[0.1em] transition-colors sm:text-[19px]"
      style={{
        background: on ? ACCENT : "rgba(255,255,255,0.06)",
        color: on ? "#0a0c0f" : "#c6cdd5",
        borderColor: on ? ACCENT : "rgba(255,255,255,0.12)",
      }}
    >
      {children}
    </button>
  );
}

function ClubPanel({
  label,
  selected,
  selectedId,
  onSelect,
}: {
  label: string;
  selected: Club;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="gb-panel flex flex-col gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-baseline justify-between">
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.2em] text-[#c6cdd5] sm:text-[15px]">
          {label}
        </span>
        <span className="text-[13px] text-[#79838e]">{selected.name}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {CLUBS.map((club) => {
          const on = club.id === selectedId;
          return (
            <button
              key={club.id}
              onClick={() => onSelect(club.id)}
              title={club.name}
              className="relative flex h-[54px] items-center justify-center overflow-hidden rounded-md border-2 transition-transform hover:scale-[1.03] sm:h-[62px]"
              style={{
                background: club.primaryColor,
                color: club.secondaryColor,
                borderColor: on ? ACCENT : "rgba(255,255,255,0.10)",
                boxShadow: on ? "0 2px 8px rgba(0,0,0,0.45)" : "none",
              }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-2"
                style={{ background: club.secondaryColor }}
              />
              <span className="font-display text-[20px] font-extrabold tracking-[0.04em] sm:text-[22px]">
                {club.shortName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
