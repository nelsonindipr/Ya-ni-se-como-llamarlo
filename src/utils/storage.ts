import type { GameState } from '../state/gameState';
import { initialTeams } from '../data/teams';

export const STORAGE_KEY = 'bsn-manager-season-v5';
export const SAVES_INDEX_KEY = 'bsn_gm_saves_index';
export const ACTIVE_SAVE_KEY = 'bsn_gm_active_save_id';

export type SaveSummary = {
  saveId: string;
  saveName: string;
  userTeamId: string;
  teamName: string;
  currentDate: string;
  record: string;
  updatedAt: string;
};

export type FullSave = {
  saveId: string;
  saveName: string;
  createdAt: string;
  updatedAt: string;
  gameState: {
    userTeamId: string;
    currentDate: string;
    seasonYear: number;
    phase: string;
  };
  teams: GameState['teams'];
  players: unknown[];
  schedule: GameState['schedule'];
  standings: ReturnType<typeof Object.values>;
  stats: GameState['stats'];
  transactions: GameState['transactions'];
  injuries: unknown[];
  news: unknown[];
  rotations: Record<string, unknown>;
  contracts: Record<string, unknown>;
  importSlots: Record<string, unknown>;
  coreState: GameState;
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const deepClone = <T,>(value: T): T => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));

export const generateSaveId = (): string => `save_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const getSavesIndex = (): SaveSummary[] => {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(SAVES_INDEX_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as SaveSummary[]; } catch { return []; }
};

export const updateSavesIndex = (saveData: SaveSummary): void => {
  const next = getSavesIndex().filter((s) => s.saveId !== saveData.saveId);
  next.push(saveData);
  next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(next));
};

export const setActiveSave = (saveId: string): void => localStorage.setItem(ACTIVE_SAVE_KEY, saveId);
export const getActiveSaveId = (): string | null => typeof localStorage === 'undefined' ? null : localStorage.getItem(ACTIVE_SAVE_KEY);

const getSaveSummaryFromFull = (save: FullSave): SaveSummary => {
  const team = save.teams.find((t) => t.id === save.gameState.userTeamId) ?? initialTeams[0];
  return {
    saveId: save.saveId,
    saveName: save.saveName,
    userTeamId: save.gameState.userTeamId,
    teamName: team.name,
    currentDate: save.gameState.currentDate,
    record: `${team.wins}-${team.losses}`,
    updatedAt: save.updatedAt
  };
};

export const saveGame = (saveData: FullSave): void => {
  const now = new Date().toISOString();
  const full = { ...saveData, updatedAt: now };
  localStorage.setItem(`bsn_gm_save_${full.saveId}`, JSON.stringify(full));
  updateSavesIndex(getSaveSummaryFromFull(full));
};

export const loadSave = (saveId: string): FullSave | null => {
  const raw = localStorage.getItem(`bsn_gm_save_${saveId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as FullSave; } catch { return null; }
};

export const deleteSave = (saveId: string): void => {
  localStorage.removeItem(`bsn_gm_save_${saveId}`);
  localStorage.setItem(SAVES_INDEX_KEY, JSON.stringify(getSavesIndex().filter((s) => s.saveId !== saveId)));
  if (getActiveSaveId() === saveId) localStorage.removeItem(ACTIVE_SAVE_KEY);
};

export const renameSave = (saveId: string, newName: string): FullSave | null => {
  const save = loadSave(saveId);
  if (!save) return null;
  const next = { ...save, saveName: newName };
  saveGame(next);
  return next;
};

export const duplicateSave = (saveId: string): FullSave | null => {
  const save = loadSave(saveId);
  if (!save) return null;
  const now = new Date().toISOString();
  const duplicated = deepClone({ ...save, saveId: generateSaveId(), saveName: `${save.saveName} Copy`, createdAt: now, updatedAt: now });
  saveGame(duplicated);
  return duplicated;
};

export const createNewSave = (saveName: string, userTeamId: string, gameState: GameState, players: unknown[]): FullSave => {
  const now = new Date().toISOString();
  const full: FullSave = {
    saveId: generateSaveId(),
    saveName,
    createdAt: now,
    updatedAt: now,
    gameState: { userTeamId, currentDate: gameState.currentDate, seasonYear: gameState.seasonYear, phase: gameState.phase },
    teams: deepClone(gameState.teams),
    players: deepClone(players),
    schedule: deepClone(gameState.schedule),
    standings: [],
    stats: deepClone(gameState.stats),
    transactions: deepClone(gameState.transactions),
    injuries: [], news: [], rotations: {}, contracts: {}, importSlots: {},
    coreState: { ...gameState, selectedTeamId: userTeamId }
  };
  saveGame(full); setActiveSave(full.saveId);
  return full;
};

export const getCurrentSave = (): FullSave | null => {
  const active = getActiveSaveId();
  return active ? loadSave(active) : null;
};

export const autosaveCurrentSave = (save: FullSave): void => saveGame(save);

export const isValidPersistedSeasonState = (value: unknown): value is GameState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as GameState;
  if (state.version !== 5) return false;
  if (!isFiniteNumber(state.seed) || !isFiniteNumber(state.seasonYear)) return false;
  if (typeof state.currentDate !== 'string') return false;
  if (!Array.isArray(state.schedule) || !Array.isArray(state.teams)) return false;
  if (typeof state.showOverall !== 'boolean') return false;
  return true;
};

export const saveSeasonState = (state: GameState): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
export const loadSeasonState = (): GameState | null => {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try { const parsed: unknown = JSON.parse(raw); return isValidPersistedSeasonState(parsed) ? parsed : null; } catch { return null; }
};
export const clearSeasonState = (): void => { if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY); };
