import { initialPlayers } from '../data/players';
import { initialTeams } from '../data/teams';
import type {
  AvailabilityStatus,
  GameResult,
  PlayoffBracket,
  Player,
  ScheduledGame,
  SeasonPhase,
  Team
} from '../domain/types';
import { simulateGame } from '../simulation/engine';
import { generatePlayoffBracket, simulateEntirePlayoffs, simulateNextPlayoffSeries } from '../simulation/playoffs';
import { generateRegularSeasonSchedule } from '../simulation/schedule';
import { addGameToStats, createEmptySeasonStats, type SeasonStatsState } from '../simulation/stats';
import { applyGameToStandings, toStandingRows } from '../simulation/standings';

export type InjuryRecord = {
  type: 'ankle' | 'hamstring' | 'knee' | 'wrist' | 'back';
  gamesRemaining: number;
  startedOnGameNumber: number;
};

export type RuntimePlayerState = {
  playerId: string;
  fatigue: number;
  injury: InjuryRecord | null;
  starter: boolean;
  availability: AvailabilityStatus;
  rotationOrder: number;
  minutesOverride: number | null;
  contractYearsRemaining: number;
  salary: number;
};

export type LeagueConfig = {
  salaryCap: number;
  rosterLimit: number;
  maxImports: number;
};

export type GameState = {
  version: 5;
  seed: number;
  seasonYear: number;
  phase: SeasonPhase;
  currentDate: string;
  teams: Team[];
  schedule: ScheduledGame[];
  playoffBracket: PlayoffBracket | null;
  lastGame: GameResult | null;
  selectedScheduledGameId: string | null;
  selectedPlayerId: string | null;
  selectedTeamId: string | null;
  showOverall: boolean;
  stats: SeasonStatsState;
  runtimePlayers: Record<string, RuntimePlayerState>;
  transactions: Array<{ id: string; date: string; type: string; note: string }>;
  league: LeagueConfig;
};

const iso = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (dateISO: string, days: number): string => {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

const daysBetween = (aISO: string, bISO: string): number => {
  const a = Date.parse(`${aISO}T00:00:00.000Z`);
  const b = Date.parse(`${bISO}T00:00:00.000Z`);
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
};

const teamPlayers = (teamId: string): Player[] => initialPlayers.filter((p) => p.teamId === teamId);

const resetTeams = (): Team[] =>
  initialTeams.map((team) => ({ ...team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

const starterByTeamPosition = (teamId: string, players: Player[]): Set<string> => {
  const pool = players
    .filter((p) => p.teamId === teamId)
    .sort((a, b) => b.minutesTarget - a.minutesTarget);
  return new Set(pool.slice(0, 5).map((p) => p.id));
};

const buildRuntimePlayers = (): Record<string, RuntimePlayerState> => {
  const runtime: Record<string, RuntimePlayerState> = {};
  const startersByTeam = new Map<string, Set<string>>();

  for (const team of initialTeams) startersByTeam.set(team.id, starterByTeamPosition(team.id, initialPlayers));

  for (const player of initialPlayers) {
    const starterSet = startersByTeam.get(player.teamId) ?? new Set<string>();
    runtime[player.id] = {
      playerId: player.id,
      fatigue: 0,
      injury: null,
      starter: starterSet.has(player.id),
      availability: 'active',
      rotationOrder: Math.max(1, Math.round(40 - player.minutesTarget)),
      minutesOverride: null,
      contractYearsRemaining: player.contractStatus === 'unsigned' ? 0 : 1 + ((player.age + player.id.length) % 3),
      salary: player.salary ?? (player.isImport ? 165000 : 95000)
    };
  }

  return runtime;
};

export const createNewGameState = (seed: number, seasonYear = 2026): GameState => {
  const schedule = generateRegularSeasonSchedule(initialTeams, seed, `${seasonYear}-04-01`);
  return {
    version: 5,
    seed,
    seasonYear,
    phase: 'preseason',
    currentDate: schedule[0]?.date ?? `${seasonYear}-04-01`,
    teams: resetTeams(),
    schedule,
    playoffBracket: null,
    lastGame: null,
    selectedScheduledGameId: null,
    selectedPlayerId: null,
    selectedTeamId: null,
    showOverall: false,
    stats: createEmptySeasonStats(initialPlayers, initialTeams),
    runtimePlayers: buildRuntimePlayers(),
    transactions: [],
    league: {
      salaryCap: 1500000,
      rosterLimit: 15,
      maxImports: 3
    }
  };
};

const injuryTypes: InjuryRecord['type'][] = ['ankle', 'hamstring', 'knee', 'wrist', 'back'];

const previousPlayedGameDate = (schedule: ScheduledGame[], teamId: string, gameNumber: number): string | null => {
  const prev = schedule
    .filter((g) => g.played && g.gameNumber < gameNumber && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => b.gameNumber - a.gameNumber)[0];
  return prev?.date ?? null;
};

const applyPreGameRecovery = (state: GameState, scheduledGame: ScheduledGame): Record<string, RuntimePlayerState> => {
  const next = { ...state.runtimePlayers };
  const teamsInGame = [scheduledGame.homeTeamId, scheduledGame.awayTeamId];

  for (const teamId of teamsInGame) {
    const prevDate = previousPlayedGameDate(state.schedule, teamId, scheduledGame.gameNumber);
    const daysRest = prevDate ? Math.max(0, daysBetween(prevDate, scheduledGame.date) - 1) : 2;
    const recovery = 3 + Math.min(10, daysRest * 2.5);
    const shortRestTax = daysRest === 0 ? 4.5 : daysRest === 1 ? 1.5 : 0;

    for (const player of teamPlayers(teamId)) {
      const runtime = next[player.id];
      if (!runtime) continue;
      const fatigue = Math.max(0, runtime.fatigue - recovery + shortRestTax);
      next[player.id] = {
        ...runtime,
        fatigue,
        injury:
          runtime.injury && runtime.injury.gamesRemaining > 0
            ? { ...runtime.injury, gamesRemaining: Math.max(0, runtime.injury.gamesRemaining - 1) }
            : null
      };
    }
  }

  return next;
};

const applyPostGameFatigueAndInjuries = (runtimePlayers: Record<string, RuntimePlayerState>, result: GameResult, gameNumber: number): Record<string, RuntimePlayerState> => {
  const next = { ...runtimePlayers };

  const updatePlayer = (playerId: string, minutes: number) => {
    const current = next[playerId];
    if (!current) return;

    const fatigueGain = Math.max(1, minutes * 0.36);
    const fatigue = Math.min(100, current.fatigue + fatigueGain);
    let injury = current.injury;

    if (!injury) {
      const risk = 0.003 + Math.max(0, fatigue - 60) * 0.00015 + (minutes >= 34 ? 0.0012 : 0);
      const seedRoll = ((gameNumber * 97 + playerId.length * 13 + Math.round(minutes * 7)) % 10000) / 10000;
      if (seedRoll < risk) {
        injury = {
          type: injuryTypes[(gameNumber + playerId.length) % injuryTypes.length],
          gamesRemaining: 1 + ((gameNumber + playerId.charCodeAt(0)) % 7),
          startedOnGameNumber: gameNumber
        };
      }
    }

    next[playerId] = {
      ...current,
      fatigue,
      injury,
      availability: injury ? 'injured' : current.availability === 'injured' ? 'active' : current.availability
    };
  };

  for (const box of [...result.home.players, ...result.away.players]) updatePlayer(box.playerId, box.minutes);

  return next;
};

const teamRuntime = (state: GameState, teamId: string): Array<{ player: Player; runtime: RuntimePlayerState }> =>
  teamPlayers(teamId)
    .map((player) => ({ player, runtime: state.runtimePlayers[player.id] }))
    .filter((row): row is { player: Player; runtime: RuntimePlayerState } => Boolean(row.runtime));

export const autoConfigureTeamRotation = (state: GameState, teamId: string): GameState => {
  const pool = teamRuntime(state, teamId).sort((a, b) => b.player.minutesTarget - a.player.minutesTarget || a.player.id.localeCompare(b.player.id));
  const next = { ...state.runtimePlayers };

  for (const [index, row] of pool.entries()) {
    const autoStarter = index < 5;
    next[row.player.id] = {
      ...row.runtime,
      starter: autoStarter,
      rotationOrder: index + 1,
      minutesOverride: null,
      availability: row.runtime.injury ? 'injured' : index < 10 ? 'active' : 'reserve'
    };
  }

  return { ...state, runtimePlayers: next };
};

export const updatePlayerAvailability = (state: GameState, playerId: string, availability: AvailabilityStatus): GameState => {
  const runtime = state.runtimePlayers[playerId];
  if (!runtime) return state;
  if (runtime.injury && availability !== 'injured') return state;

  return {
    ...state,
    runtimePlayers: {
      ...state.runtimePlayers,
      [playerId]: {
        ...runtime,
        availability,
        starter: availability === 'active' ? runtime.starter : false
      }
    }
  };
};

export const updatePlayerStarter = (state: GameState, teamId: string, playerId: string, starter: boolean): GameState => {
  const roster = teamRuntime(state, teamId);
  const runtime = state.runtimePlayers[playerId];
  if (!runtime || !roster.some((p) => p.player.id === playerId)) return state;
  if (runtime.injury || runtime.availability !== 'active') return state;

  const activeEligible = roster.filter((r) => r.runtime.availability === 'active' && !r.runtime.injury).map((r) => r.player.id);
  if (!activeEligible.includes(playerId)) return state;

  const next = { ...state.runtimePlayers, [playerId]: { ...runtime, starter } };

  if (starter) {
    const starters = activeEligible
      .filter((id) => next[id]?.starter)
      .sort((a, b) => (next[a]?.rotationOrder ?? 99) - (next[b]?.rotationOrder ?? 99));
    if (starters.length > 5) {
      const demoteId = starters[starters.length - 1];
      if (demoteId !== playerId && next[demoteId]) next[demoteId] = { ...next[demoteId], starter: false };
    }
  }

  return { ...state, runtimePlayers: next };
};

export const updatePlayerMinutesTarget = (state: GameState, playerId: string, minutes: number | null): GameState => {
  const runtime = state.runtimePlayers[playerId];
  if (!runtime) return state;
  const normalized = minutes === null ? null : Math.max(0, Math.min(40, Math.round(minutes)));
  return {
    ...state,
    runtimePlayers: {
      ...state.runtimePlayers,
      [playerId]: {
        ...runtime,
        minutesOverride: normalized
      }
    }
  };
};

export const updatePlayerRotationOrder = (state: GameState, playerId: string, rotationOrder: number): GameState => {
  const runtime = state.runtimePlayers[playerId];
  if (!runtime) return state;
  return {
    ...state,
    runtimePlayers: {
      ...state.runtimePlayers,
      [playerId]: {
        ...runtime,
        rotationOrder: Math.max(1, Math.min(15, Math.round(rotationOrder)))
      }
    }
  };
};

export const validateTeamRotation = (
  state: GameState,
  teamId: string
): {
  valid: boolean;
  errors: string[];
} => {
  const roster = teamRuntime(state, teamId);
  const active = roster.filter((r) => r.runtime.availability === 'active' && !r.runtime.injury);
  const starters = active.filter((r) => r.runtime.starter);

  const errors: string[] = [];
  if (active.length < 5) errors.push('Team has fewer than 5 available active players.');
  if (starters.length !== 5 && active.length >= 5) errors.push('Exactly 5 active starters are required.');

  const totalTargets = active.reduce((sum, r) => sum + (r.runtime.minutesOverride ?? r.player.minutesTarget), 0);
  if (totalTargets > 240) errors.push('Target minutes exceed 240 team minutes by too much.');

  return { valid: errors.length === 0, errors };
};

export const maybeAdvancePhase = (state: GameState): GameState => {
  const allRegularDone = state.schedule.every((g) => g.played);
  if (state.phase === 'preseason') return { ...state, phase: 'regular_season' };
  if ((state.phase === 'regular_season' || state.phase === 'trade_period') && allRegularDone) return { ...state, phase: 'playoffs' };
  if (state.phase === 'playoffs' && state.playoffBracket?.championTeamId) return { ...state, phase: 'offseason' };
  return state;
};

const generatePlayoffsIfReady = (state: GameState): PlayoffBracket | null => {
  if (state.playoffBracket) return state.playoffBracket;
  const regularSeasonComplete = state.schedule.every((scheduled) => scheduled.played);
  if (!regularSeasonComplete) return null;
  return generatePlayoffBracket(toStandingRows(state.teams));
};

export const simulateScheduledGame = (state: GameState, gameId: string): GameState => {
  const scheduledGame = state.schedule.find((g) => g.id === gameId);
  if (!scheduledGame || scheduledGame.played) return state;

  const home = state.teams.find((t) => t.id === scheduledGame.homeTeamId);
  const away = state.teams.find((t) => t.id === scheduledGame.awayTeamId);
  if (!home || !away) return state;

  const preGameRuntime = applyPreGameRecovery(state, scheduledGame);

  const result = simulateGame(home, away, initialPlayers, state.seed * 10_000 + scheduledGame.gameNumber, {
    runtimePlayers: preGameRuntime,
    gameDate: scheduledGame.date,
    schedule: state.schedule,
    gameNumber: scheduledGame.gameNumber
  });
  const nextTeams = applyGameToStandings(state.teams, result);
  const nextStats = addGameToStats(state.stats, result, 'regular');
  const nextSchedule = state.schedule.map((g) =>
    g.id === scheduledGame.id
      ? { ...g, played: true, resultId: result.id, homeScore: result.home.score, awayScore: result.away.score, result }
      : g
  );

  const nextState: GameState = {
    ...state,
    teams: nextTeams,
    schedule: nextSchedule,
    stats: nextStats,
    selectedScheduledGameId: scheduledGame.id,
    lastGame: result,
    currentDate: scheduledGame.date,
    runtimePlayers: applyPostGameFatigueAndInjuries(preGameRuntime, result, scheduledGame.gameNumber),
    playoffBracket: generatePlayoffsIfReady({ ...state, teams: nextTeams, schedule: nextSchedule })
  };

  return maybeAdvancePhase(nextState);
};

const nextUnplayedOnOrBefore = (state: GameState, date: string): ScheduledGame[] =>
  state.schedule.filter((g) => !g.played && g.date <= date).sort((a, b) => (a.gameNumber < b.gameNumber ? -1 : 1));

export const simulateByWindow = (
  state: GameState,
  mode: 'next_game' | 'one_day' | 'one_week' | 'one_month' | 'rest_regular_season' | 'until_playoffs' | 'full_season'
): GameState => {
  if (mode === 'next_game') {
    const next = state.schedule.find((g) => !g.played);
    return next ? simulateScheduledGame(state, next.id) : state;
  }

  let working = state;

  if (mode === 'rest_regular_season' || mode === 'until_playoffs' || mode === 'full_season') {
    for (const game of working.schedule.filter((g) => !g.played).sort((a, b) => a.gameNumber - b.gameNumber)) {
      working = simulateScheduledGame(working, game.id);
    }
  } else {
    const stepDays = mode === 'one_day' ? 1 : mode === 'one_week' ? 7 : 30;
    const targetDate = addDays(working.currentDate, stepDays);
    for (const game of nextUnplayedOnOrBefore(working, targetDate)) {
      working = simulateScheduledGame(working, game.id);
    }
    working = { ...working, currentDate: targetDate };
  }

  if ((mode === 'until_playoffs' || mode === 'full_season') && working.playoffBracket && !working.playoffBracket.championTeamId) {
    const playoffsDone = simulateEntirePlayoffs(working.playoffBracket, working.teams, initialPlayers, working.seed);
    let nextStats = working.stats;
    const seriesList = [
      playoffsDone.conferenceSemifinals.a1v4,
      playoffsDone.conferenceSemifinals.a2v3,
      playoffsDone.conferenceSemifinals.b1v4,
      playoffsDone.conferenceSemifinals.b2v3,
      playoffsDone.conferenceFinals.a,
      playoffsDone.conferenceFinals.b,
      playoffsDone.bsnFinal
    ];
    for (const series of seriesList) {
      for (const game of series.games) {
        if (game.result) nextStats = addGameToStats(nextStats, game.result, 'playoffs');
      }
    }
    working = { ...working, playoffBracket: playoffsDone, stats: nextStats };
  }

  return maybeAdvancePhase(working);
};

export const simulateNextPlayoffSeriesForState = (state: GameState): GameState => {
  if (!state.playoffBracket) return state;
  const next = simulateNextPlayoffSeries(state.playoffBracket, state.teams, initialPlayers, state.seed);
  let nextStats = state.stats;
  const seriesList = [
    next.conferenceSemifinals.a1v4,
    next.conferenceSemifinals.a2v3,
    next.conferenceSemifinals.b1v4,
    next.conferenceSemifinals.b2v3,
    next.conferenceFinals.a,
    next.conferenceFinals.b,
    next.bsnFinal
  ];
  for (const series of seriesList) {
    for (const game of series.games) {
      if (game.result) nextStats = addGameToStats(nextStats, game.result, 'playoffs');
    }
  }

  return maybeAdvancePhase({ ...state, playoffBracket: next, stats: nextStats });
};
