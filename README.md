# BSN 2026 Basketball Manager (v0.1)

React + TypeScript + Vite MVP for a BSN 2026 / FIBA-inspired basketball management game.

## Implemented in v0.1

- In-memory BSN league state with 12 real teams
- 2 conferences (A/B), 6 teams each
- League rules model for 2026 (34-game regular season, 40-minute games, FIBA quarter structure)
- Placeholder 12-player minimum roster per team
- Player ratings, roles, tendencies
- BSN-ready player metadata placeholders (import slots, rights, salary/contract placeholders, technical foul counter)
- Matchup selector + simulate game flow
- Possession-based game simulation
- Final score + quarter splits + player box score
- Standings updates after every simulation
- Conference standings and optional overall standings view

## Deferred (future versions)

- Salary cap and finances
- Contracts/trades/free agency/draft
- Injuries
- Playoffs execution
- Import replacement rules

## Run locally

```bash
npm install
npm run dev
```

## Build and test

```bash
npm run build
npm run test
```
