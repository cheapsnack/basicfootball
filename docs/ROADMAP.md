# Roadmap

Ordered by value per unit of effort. Items move to CHANGELOG.md as they land.

## Now — presentation & feel

- [x] Stadium: stands, crowd in club colours, ad boards, floodlights
- [x] Club names and colours in the scoreboard
- [x] Ball contact shadow, real sky
- [x] CI on every push
- [ ] Kit numbers on shirts
- [ ] Wire `shot`, `pass`, `defend`, `gk` attributes into striking, tackling
      and goalkeeping (`pace`/`dribble` already drive movement)
- [ ] Post-match summary: score, scorers, cards, shots

## Next — reasons to play again

- [ ] Cup mode: 8-club single-elimination bracket with a trophy screen
- [ ] Stamina and sprint economy
- [ ] Goal replay (reuse the multiplayer snapshot format as a ring buffer)
- [ ] Better pass targeting: aim with input direction, through-balls,
      penalise blocked lanes, auto-switch on turnover
- [ ] "How to play" screen; frame Free Kick and Penalty modes as Skills
- [ ] AI chooses its own mentality and reacts to the scoreline
- [ ] Extract `stepMatch()` from `MatchScene.tsx` into `logic/` so the
      tick is testable
- [ ] E2E smoke test (load, kick off, canvas renders)

## Later — growth

- [ ] Aerial play: headers, crosses, volleys
- [ ] League season with table and form
- [ ] Player progression and squad customisation
- [ ] Online ranked play and leaderboards
- [ ] Commentary and crowd reactivity
- [ ] Kit editor and custom clubs

## Deliberately out of scope

- Offside — needs second-last-defender tracking and indirect free kicks;
  too punishing for casual arcade play without a coaching overlay.
- A full referee model with foul severity and VAR. Fouls and cards exist;
  they stay simple.
- Management-sim features (transfers, finances, training).
