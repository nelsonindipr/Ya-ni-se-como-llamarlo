import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../data/players';
import { initialTeams } from '../data/teams';
import { simulateGame } from './engine';
import { addGameToStats, createEmptySeasonStats, leaderRowsFromStats } from './stats';

describe('season stats accumulation', () => {
  it('simulating one regular-season game updates player stats', () => {
    const home = initialTeams[0];
    const away = initialTeams[1];
    const result = simulateGame(home, away, initialPlayers, 1111);
    const stats = addGameToStats(createEmptySeasonStats(initialPlayers, initialTeams), result, 'regular');
    const first = result.home.players[0];
    expect(stats.regularPlayerStats[first.playerId].gamesPlayed).toBe(1);
    expect(stats.regularPlayerStats[first.playerId].points).toBe(first.points);
    expect(stats.playoffPlayerStats[first.playerId].gamesPlayed).toBe(0);
  });

  it('playoff games update playoff stats separately', () => {
    const home = initialTeams[0];
    const away = initialTeams[1];
    const result = simulateGame(home, away, initialPlayers, 2222);
    const stats = addGameToStats(createEmptySeasonStats(initialPlayers, initialTeams), result, 'playoffs');
    const first = result.home.players[0];
    expect(stats.playoffPlayerStats[first.playerId].gamesPlayed).toBe(1);
    expect(stats.regularPlayerStats[first.playerId].gamesPlayed).toBe(0);
  });

  it('no double-counting happens when same game is applied twice', () => {
    const home = initialTeams[0];
    const away = initialTeams[1];
    const result = simulateGame(home, away, initialPlayers, 3333);
    const once = addGameToStats(createEmptySeasonStats(initialPlayers, initialTeams), result, 'regular');
    const twice = addGameToStats(once, result, 'regular');
    expect(twice.processedRegularGameIds).toHaveLength(1);
    expect(twice.regularTeamStats[home.id].gamesPlayed + twice.regularTeamStats[away.id].gamesPlayed).toBe(2);
  });
});

it('leaders sort correctly and percentage filters can be applied', () => {
  const base = createEmptySeasonStats(initialPlayers, initialTeams);
  const p1 = initialPlayers[0].id;
  const p2 = initialPlayers[1].id;
  base.regularPlayerStats[p1] = {
    ...base.regularPlayerStats[p1],
    gamesPlayed: 6,
    minutes: 180,
    points: 120,
    rebounds: 30,
    assists: 18,
    steals: 9,
    blocks: 6,
    fgm: 40,
    fga: 70,
    tpm: 10,
    tpa: 20,
    ftm: 30,
    fta: 35
  };
  base.regularPlayerStats[p2] = {
    ...base.regularPlayerStats[p2],
    gamesPlayed: 6,
    minutes: 160,
    points: 90,
    rebounds: 20,
    assists: 24,
    steals: 8,
    blocks: 3,
    fgm: 15,
    fga: 20,
    tpm: 2,
    tpa: 4,
    ftm: 10,
    fta: 12
  };
  const rows = leaderRowsFromStats(initialPlayers, base.regularPlayerStats);
  const ppgSorted = [...rows].sort((a, b) => b.ppg - a.ppg);
  expect(ppgSorted[0].playerId).toBe(p1);
  const fgQualified = rows.filter((r) => r.fga >= 50).sort((a, b) => b.fgPct - a.fgPct);
  expect(fgQualified.map((r) => r.playerId)).toContain(p1);
  expect(fgQualified.map((r) => r.playerId)).not.toContain(p2);
});
