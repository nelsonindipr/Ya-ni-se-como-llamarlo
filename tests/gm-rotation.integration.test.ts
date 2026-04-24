import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../src/data/players';
import { createNewGameState, simulateScheduledGame, updatePlayerAvailability, updatePlayerMinutesTarget, updatePlayerStarter } from '../src/state/gameState';

const firstTeamId = 'bay';

describe('GM runtime controls impact simulation', () => {
  it('injured players are excluded from box score', () => {
    let state = createNewGameState(2026);
    const game = state.schedule.find((g) => g.homeTeamId === firstTeamId || g.awayTeamId === firstTeamId);
    expect(game).toBeTruthy();

    const teamRoster = initialPlayers.filter((p) => p.teamId === firstTeamId).slice(0, 2);
    for (const player of teamRoster) {
      state = {
        ...state,
        runtimePlayers: {
          ...state.runtimePlayers,
          [player.id]: { ...state.runtimePlayers[player.id], injury: { type: 'knee', gamesRemaining: 2, startedOnGameNumber: 1 }, availability: 'injured' }
        }
      };
    }

    const next = simulateScheduledGame(state, game!.id);
    const result = next.schedule.find((g) => g.id === game!.id)?.result;
    expect(result).toBeTruthy();

    const allBoxIds = new Set([...(result?.home.players ?? []), ...(result?.away.players ?? [])].map((p) => p.playerId));
    expect(allBoxIds.has(teamRoster[0].id)).toBe(false);
    expect(allBoxIds.has(teamRoster[1].id)).toBe(false);
  });

  it('reserve/inactive players do not play unless emergency', () => {
    let state = createNewGameState(2027);
    const targetTeam = initialPlayers.filter((p) => p.teamId === firstTeamId);
    for (const player of targetTeam.slice(5)) {
      state = updatePlayerAvailability(state, player.id, 'inactive');
    }

    const game = state.schedule.find((g) => g.homeTeamId === firstTeamId || g.awayTeamId === firstTeamId);
    const next = simulateScheduledGame(state, game!.id);
    const result = next.schedule.find((g) => g.id === game!.id)?.result;
    const box = result?.home.teamId === firstTeamId ? result.home.players : result?.away.players ?? [];

    expect(box.length).toBeLessThanOrEqual(5);
  });

  it('starter and target minutes influence minutes distribution and totals', () => {
    let state = createNewGameState(2028);
    const roster = initialPlayers.filter((p) => p.teamId === firstTeamId);
    const star = roster[0];
    const bench = roster[10];

    state = updatePlayerStarter(state, firstTeamId, star.id, true);
    state = updatePlayerMinutesTarget(state, star.id, 38);
    state = updatePlayerMinutesTarget(state, bench.id, 4);

    const game = state.schedule.find((g) => g.homeTeamId === firstTeamId || g.awayTeamId === firstTeamId);
    const next = simulateScheduledGame(state, game!.id);
    const result = next.schedule.find((g) => g.id === game!.id)?.result;
    const box = result?.home.teamId === firstTeamId ? result.home.players : result?.away.players ?? [];

    const starRow = box.find((p) => p.playerId === star.id);
    const benchRow = box.find((p) => p.playerId === bench.id);
    const totalMinutes = box.reduce((sum, p) => sum + p.minutes, 0);

    expect(starRow?.minutes ?? 0).toBeGreaterThan(24);
    expect((benchRow?.minutes ?? 0) < (starRow?.minutes ?? 0)).toBe(true);
    expect(totalMinutes).toBeGreaterThanOrEqual(194);
    expect(totalMinutes).toBeLessThanOrEqual(202);
  });
});
