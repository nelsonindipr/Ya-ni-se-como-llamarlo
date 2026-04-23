import { beforeEach, describe, expect, it } from 'vitest';
import { initialTeams } from '../src/data/teams';
import type { ScheduledGame, Team } from '../src/domain/types';
import { generateRegularSeasonSchedule } from '../src/simulation/schedule';
import { clearSeasonState, loadSeasonState, saveSeasonState } from '../src/utils/storage';

const resetTeams = (): Team[] =>
  initialTeams.map((team) => ({ ...team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

beforeEach(() => {
  localStorage.clear();
});

describe('season storage utility', () => {
  it('saving and loading restores schedule progress', () => {
    const schedule = generateRegularSeasonSchedule(initialTeams, 2026);
    const playedSchedule: ScheduledGame[] = schedule.map((g, i) =>
      i < 3 ? { ...g, played: true, resultId: `res-${i}`, homeScore: 80 + i, awayScore: 75 + i } : g
    );

    saveSeasonState({
      version: 1,
      scheduleSeed: 2026,
      schedule: playedSchedule,
      teams: resetTeams(),
      game: null,
      showOverall: true
    });

    const loaded = loadSeasonState();
    expect(loaded).not.toBeNull();
    expect(loaded?.schedule.filter((g) => g.played)).toHaveLength(3);
    expect(loaded?.scheduleSeed).toBe(2026);
    expect(loaded?.showOverall).toBe(true);
  });

  it('saving and loading restores standings', () => {
    const teams = resetTeams();
    teams[0].wins = 10;
    teams[0].losses = 4;
    teams[0].pointsFor = 1200;
    teams[0].pointsAgainst = 1100;

    saveSeasonState({
      version: 1,
      scheduleSeed: 7,
      schedule: generateRegularSeasonSchedule(initialTeams, 7),
      teams,
      game: null,
      showOverall: false
    });

    const loaded = loadSeasonState();
    expect(loaded?.teams[0].wins).toBe(10);
    expect(loaded?.teams[0].losses).toBe(4);
    expect(loaded?.teams[0].pointsFor).toBe(1200);
    expect(loaded?.teams[0].pointsAgainst).toBe(1100);
  });

  it('reset clears stored season state', () => {
    saveSeasonState({
      version: 1,
      scheduleSeed: 8,
      schedule: generateRegularSeasonSchedule(initialTeams, 8),
      teams: resetTeams(),
      game: null,
      showOverall: false
    });

    clearSeasonState();

    expect(loadSeasonState()).toBeNull();
  });

  it('invalid saved state does not crash and fails safely', () => {
    localStorage.setItem('bsn-manager-season-v1', JSON.stringify({ version: 1, schedule: [] }));

    expect(loadSeasonState()).toBeNull();
  });
});
