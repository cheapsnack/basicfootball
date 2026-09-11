# Changelog

All notable changes to Goodball. Dates are when the change landed on `main`.

## [Unreleased]

### Added
- Stadium: terraced stands, instanced crowd tinted in the two clubs' colours,
  advertising boards, roofs and floodlight pylons
- Real sky (drei `Sky`) and fog pushed back past the stands
- Ball contact shadow that stays on the turf and widens with height
- Scoreboard shows club short names and colours; banners and bookings ticker
  use club names
- GitHub Actions CI: install, unit tests, production build on every push
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `.env.example`, Dependabot

### Fixed
- Controls hint no longer overlaps the controlled-player card (was clipping
  "Shift" to "hift")

## [0.1.0] - 2026-09-07

### Added
- Set-piece taker placement that respects sent-off players (`setpiece.ts`)
- Penalty-area detection and penalty spot logic; free kicks and penalties
  unified under the restart system
- HUD flashes for cards, corners and penalties (`MatchAlert`)
- Lineup indicator once a side is down to 10 or 9
- Card and set-piece award sound effects
- Toggleable set-piece debug overlay (hidden from players)
- Repo metadata: description, keywords, license note, gameplay screenshot
- Test suite grows to 116 tests across 9 files

### Changed
- Rebranded from "Arcade Football" / "Arcade Goal Rush" to
  "Goodball - Arcade Football"

## Earlier

- 11 v 11 match engine with formations, AI difficulty tiers and team mentality
- Fouls, yellow/red cards, bookings ledger
- Possession-lock ball model replacing physics-pull dribbling
- Throw-ins, corners, goal kicks; free-kick mini-game with wall and curve
- In-match and standalone penalty shootouts
- Extra time and scaled match clock
- Broadcast and run cameras
- Local split-keyboard 1 v 1 and online 1 v 1 over Supabase Realtime
- Mobile touch controls
