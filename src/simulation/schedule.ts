import type { ScheduledGame, Team } from '../domain/types';
import { createSeededRandom, randomInt, type RandomSource } from './random';

type PairRequirement = {
  a: string;
  b: string;
  meetings: number;
};

type ScheduleValidation = {
  valid: boolean;
  errors: string[];
};

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

const shuffle = <T>(items: T[], rng: RandomSource): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i, rng);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const buildPairRequirements = (teams: Team[], rng: RandomSource): PairRequirement[] => {
  const confA = teams.filter((t) => t.conference === 'A');
  const confB = teams.filter((t) => t.conference === 'B');
  const requirements: PairRequirement[] = [];

  for (let i = 0; i < confA.length; i += 1) {
    for (let j = i + 1; j < confA.length; j += 1) {
      requirements.push({ a: confA[i].id, b: confA[j].id, meetings: 4 });
    }
  }

  for (let i = 0; i < confB.length; i += 1) {
    for (let j = i + 1; j < confB.length; j += 1) {
      requirements.push({ a: confB[i].id, b: confB[j].id, meetings: 4 });
    }
  }

  for (const a of confA) {
    for (const b of confB) {
      requirements.push({ a: a.id, b: b.id, meetings: 2 });
    }
  }

  const aShuffled = shuffle(confA, rng);
  const bShuffled = shuffle(confB, rng);
  for (let i = 0; i < aShuffled.length; i += 1) {
    const first = bShuffled[i % bShuffled.length];
    const second = bShuffled[(i + 2) % bShuffled.length];
    const candidates = [first.id, second.id];
    for (const bId of candidates) {
      const existing = requirements.find((r) => pairKey(r.a, r.b) === pairKey(aShuffled[i].id, bId));
      if (existing) existing.meetings += 1;
    }
  }

  return requirements;
};

const buildGamesFromRequirements = (requirements: PairRequirement[], rng: RandomSource): ScheduledGame[] => {
  const homeCount = new Map<string, number>();
  const awayCount = new Map<string, number>();

  const games: ScheduledGame[] = [];

  for (const req of shuffle(requirements, rng)) {
    let aHome = Math.floor(req.meetings / 2);
    let bHome = req.meetings - aHome;

    if (req.meetings % 2 === 1 && rng() < 0.5) {
      aHome = bHome;
      bHome = req.meetings - aHome;
    }

    for (let i = 0; i < aHome; i += 1) {
      games.push({
        id: `sched-${req.a}-${req.b}-h${i + 1}`,
        gameNumber: 0,
        homeTeamId: req.a,
        awayTeamId: req.b,
        played: false
      });
      homeCount.set(req.a, (homeCount.get(req.a) ?? 0) + 1);
      awayCount.set(req.b, (awayCount.get(req.b) ?? 0) + 1);
    }

    for (let i = 0; i < bHome; i += 1) {
      games.push({
        id: `sched-${req.a}-${req.b}-a${i + 1}`,
        gameNumber: 0,
        homeTeamId: req.b,
        awayTeamId: req.a,
        played: false
      });
      homeCount.set(req.b, (homeCount.get(req.b) ?? 0) + 1);
      awayCount.set(req.a, (awayCount.get(req.a) ?? 0) + 1);
    }
  }

  return shuffle(games, rng).map((game, idx) => ({ ...game, gameNumber: idx + 1, id: `game-${idx + 1}-${game.homeTeamId}-${game.awayTeamId}` }));
};

export const validateRegularSeasonSchedule = (schedule: ScheduledGame[], teams: Team[]): ScheduleValidation => {
  const errors: string[] = [];
  const teamIds = new Set(teams.map((t) => t.id));

  if (schedule.length !== 204) errors.push(`Expected 204 total games, got ${schedule.length}.`);

  const byTeam = new Map<string, { total: number; home: number; away: number }>();
  for (const teamId of teamIds) byTeam.set(teamId, { total: 0, home: 0, away: 0 });

  const ids = new Set<string>();
  for (const game of schedule) {
    if (ids.has(game.id)) errors.push(`Duplicate game id ${game.id}.`);
    ids.add(game.id);

    if (game.homeTeamId === game.awayTeamId) errors.push(`Self matchup detected for ${game.homeTeamId}.`);
    if (!teamIds.has(game.homeTeamId) || !teamIds.has(game.awayTeamId)) {
      errors.push(`Unknown team in game ${game.id}.`);
      continue;
    }

    const home = byTeam.get(game.homeTeamId);
    const away = byTeam.get(game.awayTeamId);
    if (home) {
      home.total += 1;
      home.home += 1;
    }
    if (away) {
      away.total += 1;
      away.away += 1;
    }
  }

  for (const [teamId, counts] of byTeam) {
    if (counts.total !== 34) errors.push(`Team ${teamId} has ${counts.total} games instead of 34.`);
    if (Math.abs(counts.home - counts.away) > 3) {
      errors.push(`Team ${teamId} home/away imbalance too high (${counts.home}/${counts.away}).`);
    }
  }

  if (byTeam.size !== teams.length) errors.push('Not all teams included in schedule.');

  return { valid: errors.length === 0, errors };
};

export const generateRegularSeasonSchedule = (teams: Team[], seed: number): ScheduledGame[] => {
  const rng = createSeededRandom(seed);
  const requirements = buildPairRequirements(teams, rng);
  const schedule = buildGamesFromRequirements(requirements, rng);

  const validation = validateRegularSeasonSchedule(schedule, teams);
  if (!validation.valid) {
    throw new Error(`Failed to generate valid schedule: ${validation.errors.join(' ')}`);
  }

  return schedule;
};
