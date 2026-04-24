import { initialPlayers } from '../data/players';
import { initialTeams } from '../data/teams';
import type { GameResult, PlayoffBracket, Player, ScheduledGame, SeasonPhase, Team } from '../domain/types';
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

const applyPostGameFatigueAndInjuries = (state: GameState, result: GameResult, gameNumber: number): Record<string, RuntimePlayerState> => {
  const next = { ...state.runtimePlayers };

  const updatePlayer = (playerId: string, minutes: number) => {
    const current = next[playerId];
    if (!current) return;

    const fatigueGain = Math.max(1.5, minutes * 0.42);
    const fatigue = Math.min(100, current.fatigue + fatigueGain);
    let injury = current.injury;

    if (!injury) {
      const risk = 0.004 + Math.max(0, fatigue - 55) * 0.00018 + (minutes >= 33 ? 0.0015 : 0);
      const seedRoll = ((gameNumber * 97 + playerId.length * 13 + Math.round(minutes * 7)) % 10000) / 10000;
      if (seedRoll < risk) {
        injury = {
          type: injuryTypes[(gameNumber + playerId.length) % injuryTypes.length],
          gamesRemaining: 1 + ((gameNumber + playerId.charCodeAt(0)) % 7),
          startedOnGameNumber: gameNumber
        };
      }
    }

    next[playerId] = { ...current, fatigue, injury };
  };

  for (const box of [...result.home.players, ...result.away.players]) updatePlayer(box.playerId, box.minutes);

  return next;
};

const recoverAndTickInjuries = (runtime: Record<string, RuntimePlayerState>): Record<string, RuntimePlayerState> => {
  const next: Record<string, RuntimePlayerState> = {};
  for (const [playerId, ps] of Object.entries(runtime)) {
    const gamesRemaining = ps.injury ? Math.max(0, ps.injury.gamesRemaining - 1) : 0;
    next[playerId] = {
      ...ps,
      fatigue: Math.max(0, ps.fatigue - 7.5),
      injury: ps.injury ? (gamesRemaining > 0 ? { ...ps.injury, gamesRemaining } : null) : null
    };
  }
  return next;
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

  const result = simulateGame(home, away, initialPlayers, state.seed * 10_000 + scheduledGame.gameNumber);
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
    runtimePlayers: recoverAndTickInjuries(applyPostGameFatigueAndInjuries(state, result, scheduledGame.gameNumber)),
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
