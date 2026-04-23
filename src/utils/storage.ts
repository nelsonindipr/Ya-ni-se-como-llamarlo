import { initialTeams } from '../data/teams';
import type { GameResult, ScheduledGame, Team } from '../domain/types';

export const STORAGE_KEY = 'bsn-manager-season-v1';

type PersistedSeasonState = {
  version: 1;
  scheduleSeed: number;
  schedule: ScheduledGame[];
  teams: Team[];
  game: GameResult | null;
  showOverall: boolean;
};

const knownTeamIds = new Set(initialTeams.map((t) => t.id));

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

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

export const isValidPersistedSeasonState = (value: unknown): value is PersistedSeasonState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as PersistedSeasonState;

  if (state.version !== 1) return false;
  if (!isFiniteNumber(state.scheduleSeed)) return false;
  if (!Array.isArray(state.schedule) || state.schedule.length !== 204) return false;
  if (!Array.isArray(state.teams) || state.teams.length !== initialTeams.length) return false;
  if (typeof state.showOverall !== 'boolean') return false;

  if (!state.schedule.every(isValidScheduledGame)) return false;
  if (!state.teams.every(isValidTeam)) return false;

  const teamGameCounts = new Map<string, number>();
  for (const id of knownTeamIds) teamGameCounts.set(id, 0);

  for (const game of state.schedule) {
    teamGameCounts.set(game.homeTeamId, (teamGameCounts.get(game.homeTeamId) ?? 0) + 1);
    teamGameCounts.set(game.awayTeamId, (teamGameCounts.get(game.awayTeamId) ?? 0) + 1);
  }

  if ([...teamGameCounts.values()].some((count) => count !== 34)) return false;

  return state.game === null || typeof state.game === 'object';
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
