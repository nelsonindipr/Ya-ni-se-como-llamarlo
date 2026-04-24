import type { GameState } from '../state/gameState';

export const STORAGE_KEY = 'bsn-manager-season-v5';

type PersistedSeasonState = GameState;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const isValidPersistedSeasonState = (value: unknown): value is PersistedSeasonState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as PersistedSeasonState;

  if (state.version !== 5) return false;
  if (!isFiniteNumber(state.seed) || !isFiniteNumber(state.seasonYear)) return false;
  if (typeof state.currentDate !== 'string') return false;
  if (!Array.isArray(state.schedule) || state.schedule.length !== 204) return false;
  if (!Array.isArray(state.teams) || state.teams.length !== 12) return false;
  if (typeof state.showOverall !== 'boolean') return false;
  if (typeof state.runtimePlayers !== 'object') return false;
  if (!Array.isArray(state.transactions)) return false;

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
