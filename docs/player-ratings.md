# BSN Player Ratings Guide

## Baseline philosophy
- The universe baseline is **BSN**, not NBA.
- A rating should answer: “How effective is this player in BSN-level competition?”
- Visual scale follows a 2K-like style but interpreted in BSN context.

## BSN overall tiers (display scale)
- 90–94: BSN superstar / elite import
- 85–89: BSN star / top native / top import
- 80–84: strong starter
- 75–79: average starter / strong sixth man
- 70–74: normal rotation player
- 65–69: deep bench / situational player
- 60–64: reserve / prospect
- <60: emergency/non-rotation only

## Model architecture
1. **Attributes (effectiveness)**
   - Core skill and physical ratings (25–99) are generated from:
     - tier
     - archetype/style profile
     - position
     - import/native status
     - age curve
2. **Tendencies (frequency/style)**
   - Tendencies model how often players choose actions (3PA, drives, post-ups, passing, foul-draw attempts, crash glass).
   - Tendencies should alter possession mix and usage, not direct make ability.
3. **Coaching role (rotation/tactics)**
   - Role is used for lineup management and coaching logic.
   - Role is **not** an input to rating generation or overall derivation.

## Attribute meanings in BSN context
- closeShot / drivingLayup / drivingDunk / standingDunk / postControl: finishing effectiveness inside the arc in BSN defenses.
- midRange / threePoint / freeThrow: shotmaking at those zones against BSN contests.
- drawFoul: effectiveness at creating contact and free-throw opportunities.
- shotCreation / offBallMovement: self-created jumper quality and off-ball shot quality generation.
- passAccuracy / ballHandle / speedWithBall: playmaking reliability and dribble pressure handling.
- interiorDefense / perimeterDefense / steal / block: defensive event prevention and creation.
- offensiveRebound / defensiveRebound: rebounding win rate relative to BSN athletes.
- speed / acceleration / strength / vertical / stamina: physical tools and game endurance.
- offensiveIQ / defensiveIQ: decision quality and positioning over a BSN game sample.
- drawFoulTendency (tendency, not rating): how often the player seeks contact; this is separate from drawFoul effectiveness.

## Overall derivation
- Overall is never assigned directly.
- Overall is computed from detailed attributes via simplified buckets plus position-specific weights.
- Position weighting emphasizes different impact profiles (e.g. PG playmaking, C interior defense/rebounding).
