import { initialTeams } from '../data/teams';
import type { GameResult, PlayoffBracket, ScheduledGame, Team } from '../domain/types';
import type { SeasonStatsState } from '../simulation/stats';

export const STORAGE_KEY = 'bsn-manager-season-v4';

type PersistedSeasonState = {
  version: 4;
  scheduleSeed: number;
  schedule: ScheduledGame[];
  teams: Team[];
  game: GameResult | null;
  selectedScheduledGameId?: string | null;
  selectedPlayerId?: string | null;
  showOverall: boolean;
  playoffBracket: PlayoffBracket | null;
  stats: SeasonStatsState;
};

const knownTeamIds = new Set(initialTeams.map((t) => t.id));

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isValidGameResult = (result: unknown): result is GameResult => {
  if (!result || typeof result !== 'object') return false;
  const gameResult = result as GameResult;
  if (typeof gameResult.id !== 'string' || !gameResult.id) return false;
  if (!gameResult.home || !gameResult.away) return false;
  if (!isFiniteNumber(gameResult.home.score) || !isFiniteNumber(gameResult.away.score)) return false;
  if (!Array.isArray(gameResult.home.players) || !Array.isArray(gameResult.away.players)) return false;
  return typeof gameResult.winnerTeamId === 'string' && !!gameResult.winnerTeamId;
};

const isValidScheduledGame = (game: unknown): game is ScheduledGame => {
  if (!game || typeof game !== 'object') return false;
  const g = game as ScheduledGame;
  if (typeof g.id !== 'string') return false;
  if (!isFiniteNumber(g.gameNumber)) return false;
  if (typeof g.homeTeamId !== 'string' || typeof g.awayTeamId !== 'string') return false;
  if (g.homeTeamId === g.awayTeamId) return false;
  if (!knownTeamIds.has(g.homeTeamId) || !knownTeamIds.has(g.awayTeamId)) return false;
  if (typeof g.played !== 'boolean') return false;
  if (g.resultId !== undefined && typeof g.resultId !== 'string') return false;
  if (g.homeScore !== undefined && !isFiniteNumber(g.homeScore)) return false;
  if (g.awayScore !== undefined && !isFiniteNumber(g.awayScore)) return false;
  if (g.result !== undefined && !isValidGameResult(g.result)) return false;
  return true;
};

const isValidTeam = (team: unknown): team is Team => {
  if (!team || typeof team !== 'object') return false;
  const t = team as Team;
  if (typeof t.id !== 'string' || !knownTeamIds.has(t.id)) return false;
  return (
    isFiniteNumber(t.wins) &&
    isFiniteNumber(t.losses) &&
    isFiniteNumber(t.pointsFor) &&
    isFiniteNumber(t.pointsAgainst) &&
    typeof t.name === 'string' &&
    typeof t.abbreviation === 'string' &&
    (t.conference === 'A' || t.conference === 'B')
  );
};

const isValidStats = (stats: unknown): stats is SeasonStatsState => {
  if (!stats || typeof stats !== 'object') return false;
  const s = stats as SeasonStatsState;
  return (
    typeof s.regularPlayerStats === 'object' &&
    typeof s.playoffPlayerStats === 'object' &&
    typeof s.regularTeamStats === 'object' &&
    typeof s.playoffTeamStats === 'object' &&
    typeof s.playerGameLogs === 'object' &&
    Array.isArray(s.processedRegularGameIds) &&
    Array.isArray(s.processedPlayoffGameIds)
  );
};

export const isValidPersistedSeasonState = (value: unknown): value is PersistedSeasonState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as PersistedSeasonState;

  if (state.version !== 4) return false;
  if (!isFiniteNumber(state.scheduleSeed)) return false;
  if (!Array.isArray(state.schedule) || state.schedule.length !== 204) return false;
  if (!Array.isArray(state.teams) || state.teams.length !== initialTeams.length) return false;
  if (typeof state.showOverall !== 'boolean') return false;
  if (state.selectedScheduledGameId !== undefined && state.selectedScheduledGameId !== null && typeof state.selectedScheduledGameId !== 'string') return false;
  if (state.selectedPlayerId !== undefined && state.selectedPlayerId !== null && typeof state.selectedPlayerId !== 'string') return false;
  if (state.playoffBracket !== null && (typeof state.playoffBracket !== 'object' || !('generated' in state.playoffBracket))) return false;
  if (!isValidStats(state.stats)) return false;

  if (!state.schedule.every(isValidScheduledGame)) return false;
  if (!state.teams.every(isValidTeam)) return false;

  const teamGameCounts = new Map<string, number>();
  for (const id of knownTeamIds) teamGameCounts.set(id, 0);

  for (const game of state.schedule) {
    teamGameCounts.set(game.homeTeamId, (teamGameCounts.get(game.homeTeamId) ?? 0) + 1);
    teamGameCounts.set(game.awayTeamId, (teamGameCounts.get(game.awayTeamId) ?? 0) + 1);
  }

  if ([...teamGameCounts.values()].some((count) => count !== 34)) return false;

  if (state.game !== null && !isValidGameResult(state.game)) return false;

  if (state.selectedScheduledGameId) {
    const selectedGame = state.schedule.find((game) => game.id === state.selectedScheduledGameId);
    if (!selectedGame || !selectedGame.played || !selectedGame.result) return false;
  }

  return true;
};

export const saveSeasonState = (state: PersistedSeasonState): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const loadSeasonState = (): PersistedSeasonState | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersistedSeasonState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearSeasonState = (): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};

export type { PersistedSeasonState };
