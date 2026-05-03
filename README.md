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


## Balance audits (Phase 1)

Run Monte Carlo season audits to measure realism and catch simulation regressions:

```bash
npm run audit:balance
npm run audit:balance:json
```

You can override defaults directly:

```bash
vite-node scripts/season-balance-report.ts --seasons 200 --seedStart 5000 --json
```

### How to interpret output

- Each metric prints mean/median/stdev/min/max across simulated seasons.
- `out=...%` is the percent of seasons outside the target range.
- `Worst offending metric` identifies the highest out-of-range percentage.
- Script exits non-zero when quality gates fail (safe for CI).

### Safe tuning workflow

1. Change one simulation factor at a time (pace, shot mix, foul tuning, injury risk).
2. Re-run balance audit with the same seeds first (regression check).
3. Re-run with a wider seed window for robustness.
4. Do not ship if critical metrics fail gates; adjust incrementally and re-test.
