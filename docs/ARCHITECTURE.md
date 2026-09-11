# Architecture

How Goodball is put together, and the conventions that keep it maintainable.
Read this before changing anything under `src/game` or `src/components/game`.

## The one rule

**Gameplay logic is pure; components only render it.**

Everything in `src/game/logic/` is framework-free TypeScript — no React, no
three.js, no Zustand imports. It takes plain data in and returns plain data
out, which is why it has 116 unit tests and the rendering layer has none.
If you're about to put a rule ("a tackle within 1.6 m that misses the ball is
a foul") inside a component, stop and put it in `logic/` with a test.

## Layers

```
routes/index.tsx            single route; mounts MainMenu or GameCanvas
components/game/
  GameCanvas.tsx            R3F <Canvas>, lights, sky, HUD overlays
  MatchScene.tsx            the match loop: reads input, steps logic, writes bodies
  Stadium / Pitch / Goal / Ball   static and dynamic scene objects
  MatchHud / MatchAlert / …  DOM overlays that subscribe to HUD-safe store fields
  FreeKick / PenaltyShootout / SetPiece3DScene   standalone set-piece scenes
game/
  types.ts                  Vec3, Kinematics, Player, Club, Attributes
  data/clubs.ts             8 clubs × 16 players — GENERATED, never hand-edit
  logic/                    physics, AI, rules (see below)
  store/useGameStore.ts     one Zustand store
hooks/                      keyboard and touch input → MovementInput/ActionInput
multiplayer/                Supabase room client, channel hook, snapshot codec
```

### `game/logic/` map

| Module | Owns |
|---|---|
| `movement.ts` | player acceleration, top speed, turn rate; `paramsFromAttributes()` maps `pace`/`dribble` (1–99) onto these |
| `ballPhysics.ts` | free-ball integration, bounce, drag, `BALL_RADIUS`, `STRIKE_TUNING` |
| `possession.ts` | possession-lock model: the ball is glued to the carrier and only becomes a physics body when loose; capture/steal radii |
| `striking.ts` | charge → shot/pass direction, speed, lift; target assist |
| `tackle.ts` | slide-tackle dash, dispossession window, foul detection |
| `bookings.ts` | yellow/red ledger, `isSentOff()` |
| `restarts.ts`, `setpiece.ts`, `field.ts` | throw-in/corner/goal-kick/free-kick/penalty spots, taker selection and placement, pitch geometry |
| `freekicks.ts`, `penalties.ts` | the aim/curve/power mini-games and keeper guessing (injectable RNG) |
| `match.ts` | clock scaling, periods, extra time, goal detection (interpolated, tunnel-proof), shootout winner |
| `camera.ts` | broadcast and run camera tracking |
| `ai/outfield.ts` | formations, team shape, pressing, shoot/pass/dribble decisions |
| `ai/goalkeeper.ts` | keeper positioning, dives, goal kicks |
| `ai/steering.ts` | shared steering behaviours and obstacle avoidance |
| `ai/difficulty.ts`, `ai/mentality.ts` | the four difficulty tiers and three mentalities as tuning tables |
| `audio.ts` | synthesised sound effects |

## Conventions

### 1. Simulation bodies are never subscribed to
`ball`, `homeOutfield[]`, `awayOutfield[]`, `homeGK`, `awayGK` are written
every frame inside `useFrame` via `useGameStore.getState()` and read the
same way. Subscribing a component to them would re-render React at 60 fps.
Only HUD-safe fields (score, clock, status, bookings) are subscribed.

### 2. Animation signals ride on `userData`
Speed, kick count and tackle count are set on the R3F object's `userData`
from the frame loop; the player model reads them in its own `useFrame`.
No props, no state, no re-renders.

### 3. Every tunable lives in a named constant object
`MOVEMENT_TUNING`, `STRIKE_TUNING`, `TACKLE_TUNING`, `POSSESSION_TUNING`,
`MATCH_TUNING`, `CAMERA_TUNING`, `DIFFICULTY_TUNING`, `MENTALITY_TUNING`,
`STADIUM_TUNING`, … If you're typing a magic number into a function body,
it belongs in one of these instead.

### 4. Attributes are 1–99
`Attributes` = `pace, shot, pass, dribble, defend, gk`, each 1–99, normalised
with `v / 99` where a 0–1 value is needed. There are no other attribute
fields. `pace` and `dribble` are wired into movement; `shot`, `pass`,
`defend`, `gk` are not yet consumed (see ROADMAP).

### 5. `clubs.ts` is generated
Names are Cricket-97-style parodies to avoid IP. Regenerate; don't edit.

### 6. Multiplayer is host-authoritative
The host runs the full simulation and broadcasts `buildSnapshot()` (positions
and headings only — the guest never integrates physics) over a Supabase
Realtime channel. The guest sends `GuestInputPayload` each frame and calls
`applySnapshot()` for rendering. The `game_rooms` table exists only for the
room-code handshake. `local2p` reuses the same "away side has a controlled
index" plumbing with no network.

### 7. Git history is shared with Lovable
The repo is connected to Lovable; commits on `main` appear in its editor.
Never force-push, rebase or squash published commits. Keep `main` building.

## Adding a feature — the checklist

1. Put the rule in `src/game/logic/` as a pure function with a test.
2. Add its tuning values to a `*_TUNING` object.
3. Read/write bodies via `getState()` inside `MatchScene`'s frame loop.
4. Expose anything the HUD needs as a coarse store field, not a body.
5. `bun run test` and `bun run build` must both pass before it goes on `main`
   (CI checks this on every push).
