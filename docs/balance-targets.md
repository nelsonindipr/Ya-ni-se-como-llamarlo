# Balance Targets (Phase 1)

These targets define realism windows for BSN/FIBA-style outcomes and are used by the Monte Carlo season balance audit.

| Metric | Target range | Tolerance band | Why this range |
|---|---:|---:|---|
| Team points per game (PPG) | 76 - 89 | +/- 2.0 | 40-minute FIBA-context leagues usually produce lower scoring than NBA pace/efficiency baselines, while still allowing elite offenses to approach high-80s. |
| Possessions / pace (per team game) | 70 - 80 | +/- 1.5 | Typical FIBA/BSN game lengths and half-court frequency keep possessions mostly in low/mid-70s, with faster teams reaching upper-70s. |
| 3PA rate (3PA / FGA) | 0.28 - 0.44 | +/- 0.03 | Modern teams still space the floor heavily, but a 40-minute environment and interior usage should prevent extreme 3-only shot diets. |
| FT rate (FTA / FGA) | 0.18 - 0.33 | +/- 0.03 | Captures normal physicality and whistle frequency; too low suggests non-physical sim, too high suggests whistle-heavy imbalance. |
| Turnover % (TOV / possessions) | 0.11 - 0.17 | +/- 0.02 | Reflects realistic passing pressure and decision-making variance without forcing arcade-level sloppiness. |
| Offensive rebound % (ORB / (ORB + opp DRB)) | 0.22 - 0.34 | +/- 0.025 | Prevents either overpowered put-back loops or unrealistically low second-chance creation. |
| Foul rate (team fouls per game) | 14 - 23 | +/- 2.0 | Keeps game flow believable for FIBA foul environment and avoids excessive bonus-driven scoring spikes. |
| Foul-outs per game | 0.02 - 0.35 | +/- 0.05 | Foul-outs should happen occasionally, not constantly; this tracks discipline + substitution realism. |
| Injury incidence (new injuries per team game) | 0.005 - 0.06 | +/- 0.01 | Ensures injuries matter strategically without making rosters collapse unrealistically every season. |

## Tolerance policy

- The **target range** is the preferred realism window for each season-level metric.
- The **tolerance band** is used for quality gates on **mean** values over Monte Carlo runs.
- Metrics can have occasional outlier seasons, but repeated misses indicate regression.

## Quality-gate severity

- **Critical metrics**: PPG, pace, 3PA rate, FT rate, turnover %, injury incidence.
- **Non-critical metrics**: ORB%, foul rate, foul-outs.
- Default gate policy in Phase 1:
  - Fail if critical metric has > 12% seasons out of target range.
  - Fail if non-critical metric has > 20% seasons out of target range.
  - Fail if metric mean is outside `(target min - tolerance)` to `(target max + tolerance)`.
