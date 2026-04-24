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

type PairCount = {
  meetings: number;
  homeByTeam: Map<string, number>;
};

export const rivalryPairs: Array<readonly [string, string]> = [
  ['bay', 'man'],
  ['cag', 'gua'],
  ['san', 'car'],
  ['are', 'que'],
  ['may', 'sgm'],
  ['pon', 'agu']
] as const;

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

const shuffle = <T>(items: T[], rng: RandomSource): T[] => {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i, rng);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const buildPairRequirements = (teams: Team[]): PairRequirement[] => {
  const requirements = new Map<string, PairRequirement>();

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const a = teams[i];
      const b = teams[j];
      const meetings = a.conference === b.conference ? 4 : 2;
      requirements.set(pairKey(a.id, b.id), { a: a.id, b: b.id, meetings });
    }
  }

  for (const [x, y] of rivalryPairs) {
    const key = pairKey(x, y);
    const current = requirements.get(key);
    if (!current) {
      throw new Error(`Rivalry pair ${x}/${y} not found in teams list.`);
    }
    current.meetings += 2;
  }

  return [...requirements.values()];
};

const buildGamesFromRequirements = (requirements: PairRequirement[], rng: RandomSource): ScheduledGame[] => {
  const games: ScheduledGame[] = [];

  for (const req of shuffle(requirements, rng)) {
    const homeForA = req.meetings / 2;
    const homeForB = req.meetings / 2;

    for (let i = 0; i < homeForA; i += 1) {
      games.push({
        id: '',
        gameNumber: 0,
        date: '',
        phase: 'regular_season',
        homeTeamId: req.a,
        awayTeamId: req.b,
        played: false
      });
    }

    for (let i = 0; i < homeForB; i += 1) {
      games.push({
        id: '',
        gameNumber: 0,
        date: '',
        phase: 'regular_season',
        homeTeamId: req.b,
        awayTeamId: req.a,
        played: false
      });
    }
  }

  const pool = shuffle(games, rng);
  const ordered: ScheduledGame[] = [];

  while (pool.length > 0) {
    const previous = ordered.length > 0 ? ordered[ordered.length - 1] : undefined;
    const previousPair = previous ? pairKey(previous.homeTeamId, previous.awayTeamId) : null;

    const candidates = pool
      .map((game, index) => ({ game, index }))
      .filter(({ game }) => pairKey(game.homeTeamId, game.awayTeamId) !== previousPair);

    const pickFrom = candidates.length > 0 ? candidates : pool.map((game, index) => ({ game, index }));
    const picked = pickFrom[randomInt(0, pickFrom.length - 1, rng)];

    ordered.push(picked.game);
    pool.splice(picked.index, 1);
  }

  return ordered.map((game, idx) => ({
    ...game,
    gameNumber: idx + 1,
    id: `game-${idx + 1}-${game.awayTeamId}-at-${game.homeTeamId}`
  }));
};


const assignDates = (schedule: ScheduledGame[], startDateISO: string): ScheduledGame[] => {
  const dated: ScheduledGame[] = [];
  const byDateTeam = new Map<string, Set<string>>();

  for (const game of schedule) {
    let dayOffset = 0;
    while (true) {
      const d = new Date(`${startDateISO}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      const iso = d.toISOString().slice(0, 10);
      const key = iso;
      const used = byDateTeam.get(key) ?? new Set<string>();

      if (!used.has(game.homeTeamId) && !used.has(game.awayTeamId) && used.size <= 10) {
        used.add(game.homeTeamId);
        used.add(game.awayTeamId);
        byDateTeam.set(key, used);
        dated.push({ ...game, date: iso, phase: 'regular_season' });
        break;
      }

      dayOffset += 1;
    }
  }

  return dated;
};

const countPairMeetings = (schedule: ScheduledGame[]): Map<string, PairCount> => {
  const counts = new Map<string, PairCount>();

  for (const game of schedule) {
    const key = pairKey(game.homeTeamId, game.awayTeamId);
    const pair = counts.get(key) ?? { meetings: 0, homeByTeam: new Map<string, number>() };
    pair.meetings += 1;
    pair.homeByTeam.set(game.homeTeamId, (pair.homeByTeam.get(game.homeTeamId) ?? 0) + 1);
    counts.set(key, pair);
  }

  return counts;
};

export const validateRegularSeasonSchedule = (schedule: ScheduledGame[], teams: Team[]): ScheduleValidation => {
  const errors: string[] = [];
  const teamIds = new Set(teams.map((t) => t.id));
  const teamById = new Map(teams.map((t) => [t.id, t]));

  if (schedule.length !== 204) errors.push(`Expected 204 total games, got ${schedule.length}.`);

  const byTeam = new Map<string, { total: number; home: number; away: number }>();
  for (const teamId of teamIds) byTeam.set(teamId, { total: 0, home: 0, away: 0 });

  const ids = new Set<string>();
  const teamDateKeys = new Set<string>();

  for (const game of schedule) {
    if (ids.has(game.id)) errors.push(`Duplicate game id ${game.id}.`);
    ids.add(game.id);

    if (game.homeTeamId === game.awayTeamId) errors.push(`Self matchup detected for ${game.homeTeamId}.`);
    if (!teamIds.has(game.homeTeamId) || !teamIds.has(game.awayTeamId)) {
      errors.push(`Unknown team in game ${game.id}.`);
      continue;
    }

    const homeDateKey = `${game.homeTeamId}|${game.date}`;
    const awayDateKey = `${game.awayTeamId}|${game.date}`;
    if (teamDateKeys.has(homeDateKey) || teamDateKeys.has(awayDateKey)) {
      errors.push(`Team scheduled twice on ${game.date} (${game.id}).`);
    }
    teamDateKeys.add(homeDateKey);
    teamDateKeys.add(awayDateKey);

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
    if (Math.abs(counts.home - counts.away) > 2) {
      errors.push(`Team ${teamId} home/away imbalance too high (${counts.home}/${counts.away}).`);
    }
  }

  const pairCounts = countPairMeetings(schedule);
  const rivalryKeys = new Set(rivalryPairs.map(([a, b]) => pairKey(a, b)));

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      const a = teams[i];
      const b = teams[j];
      const key = pairKey(a.id, b.id);
      const meetings = pairCounts.get(key)?.meetings ?? 0;

      if (a.conference !== b.conference) {
        if (meetings !== 2) errors.push(`Cross-conference pair ${key} has ${meetings} games instead of 2.`);
      } else if (rivalryKeys.has(key)) {
        if (meetings !== 6) errors.push(`Rivalry pair ${key} has ${meetings} games instead of 6.`);
      } else if (meetings !== 4) {
        errors.push(`Same-conference non-rival pair ${key} has ${meetings} games instead of 4.`);
      }
    }
  }

  for (const [key, pair] of pairCounts) {
    if (pair.meetings % 2 !== 0) {
      errors.push(`Pair ${key} has odd meetings (${pair.meetings}), cannot balance home/away.`);
      continue;
    }

    const [a, b] = key.split('|');
    const homeA = pair.homeByTeam.get(a) ?? 0;
    const homeB = pair.homeByTeam.get(b) ?? 0;
    if (Math.abs(homeA - homeB) > 1) {
      errors.push(`Pair ${key} home split is not balanced (${homeA}/${homeB}).`);
    }
  }

  for (const [a, b] of rivalryPairs) {
    if (!teamById.has(a) || !teamById.has(b)) {
      errors.push(`Rivalry configuration contains unknown team (${a}/${b}).`);
    }
  }

  if (byTeam.size !== teams.length) errors.push('Not all teams included in schedule.');

  return { valid: errors.length === 0, errors };
};

export const generateRegularSeasonSchedule = (teams: Team[], seed: number, startDateISO = '2026-04-01'): ScheduledGame[] => {
  const rng = createSeededRandom(seed);
  const requirements = buildPairRequirements(teams);
  const baseSchedule = buildGamesFromRequirements(requirements, rng);
  const schedule = assignDates(baseSchedule, startDateISO);

  const validation = validateRegularSeasonSchedule(schedule, teams);
  if (!validation.valid) {
    throw new Error(`Failed to generate valid schedule: ${validation.errors.join(' ')}`);
  }

  return schedule;
};
