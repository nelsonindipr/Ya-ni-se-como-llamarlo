import { beforeEach, describe, expect, it } from 'vitest';
import { createNewGameState } from '../src/state/gameState';
import { clearSeasonState, loadSeasonState, saveSeasonState } from '../src/utils/storage';

const createLocalStorageMock = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    }
  };
};

beforeEach(() => {
  if (typeof localStorage === 'undefined') {
    Object.defineProperty(globalThis, 'localStorage', {
      value: createLocalStorageMock(),
      configurable: true
    });
  }
  localStorage.clear();
});

describe('season storage utility', () => {
  it('saving and loading restores state', () => {
    const state = createNewGameState(2026);
    state.teams[0].wins = 10;
    state.showOverall = true;
    const firstRuntime = Object.keys(state.runtimePlayers)[0];
    state.runtimePlayers[firstRuntime].availability = 'reserve';
    state.runtimePlayers[firstRuntime].fatigue = 42;
    state.runtimePlayers[firstRuntime].minutesOverride = 18;
    state.phase = 'trade_period';
    state.currentDate = '2026-05-15';

    saveSeasonState(state);
    const loaded = loadSeasonState();

    expect(loaded).not.toBeNull();
    expect(loaded?.teams[0].wins).toBe(10);
    expect(loaded?.showOverall).toBe(true);
    expect(loaded?.version).toBe(5);
    expect(loaded?.runtimePlayers[firstRuntime].availability).toBe('reserve');
    expect(loaded?.runtimePlayers[firstRuntime].fatigue).toBe(42);
    expect(loaded?.phase).toBe('trade_period');
    expect(loaded?.currentDate).toBe('2026-05-15');
  });

  it('reset clears stored season state', () => {
    saveSeasonState(createNewGameState(8));
    clearSeasonState();
    expect(loadSeasonState()).toBeNull();
  });

  it('invalid saved state does not crash and fails safely', () => {
    localStorage.setItem('bsn-manager-season-v5', JSON.stringify({ version: 4, schedule: [] }));
    expect(loadSeasonState()).toBeNull();
  });
});
