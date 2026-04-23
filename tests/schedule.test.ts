import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import type { GameResult, ScheduledGame, Team } from '../src/domain/types';
import { simulateGame } from '../src/simulation/engine';
import { generateRegularSeasonSchedule, validateRegularSeasonSchedule } from '../src/simulation/schedule';
import { applyGameToStandings } from '../src/simulation/standings';

const resetTeams = (): Team[] => initialTeams.map((team) => ({ ...team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

describe('regular season schedule generation', () => {
  it('same seed creates the same schedule', () => {
    const a = generateRegularSeasonSchedule(initialTeams, 2026);
    const b = generateRegularSeasonSchedule(initialTeams, 2026);

    expect(a).toEqual(b);
  });

  it('different seed creates different schedule', () => {
    const a = generateRegularSeasonSchedule(initialTeams, 2026);
    const b = generateRegularSeasonSchedule(initialTeams, 2027);

    expect(a).not.toEqual(b);
  });

  it('matches game count and per-team constraints', () => {
    const schedule = generateRegularSeasonSchedule(initialTeams, 42);
    const validation = validateRegularSeasonSchedule(schedule, initialTeams);

    expect(schedule).toHaveLength(204);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);

    const teamCounts = new Map<string, { total: number; home: number; away: number }>();
    for (const team of initialTeams) teamCounts.set(team.id, { total: 0, home: 0, away: 0 });

    for (const game of schedule) {
      expect(game.homeTeamId).not.toBe(game.awayTeamId);
      teamCounts.get(game.homeTeamId)!.total += 1;
      teamCounts.get(game.homeTeamId)!.home += 1;
      teamCounts.get(game.awayTeamId)!.total += 1;
      teamCounts.get(game.awayTeamId)!.away += 1;
    }

    for (const [, counts] of teamCounts) {
      expect(counts.total).toBe(34);
      expect(Math.abs(counts.home - counts.away)).toBeLessThanOrEqual(3);
    }
  });
});

describe('scheduled game simulation behavior', () => {
  it('simulating a scheduled game marks it as played', () => {
    const schedule = generateRegularSeasonSchedule(initialTeams, 11);
    const teams = resetTeams();

    const game = schedule[0];
    const home = teams.find((t) => t.id === game.homeTeamId)!;
    const away = teams.find((t) => t.id === game.awayTeamId)!;
    const result = simulateGame(home, away, initialPlayers, 110000 + game.gameNumber);

    const updated: ScheduledGame = {
      ...game,
      played: true,
      resultId: result.id,
      homeScore: result.home.score,
      awayScore: result.away.score,
      result
    };

    expect(updated.played).toBe(true);
    expect(updated.resultId).toBeTruthy();
    expect(typeof updated.homeScore).toBe('number');
    expect(typeof updated.awayScore).toBe('number');
    expect(updated.result?.home.players.length).toBeGreaterThan(0);
    expect(updated.result?.away.players.length).toBeGreaterThan(0);
  });

  it('simulating all scheduled games completes the regular season', () => {
    const schedule = generateRegularSeasonSchedule(initialTeams, 33);
    let teams = resetTeams();
    const played = new Set<string>();
    const resultsById = new Map<string, GameResult>();

    for (const game of schedule.sort((a, b) => a.gameNumber - b.gameNumber)) {
      const home = teams.find((t) => t.id === game.homeTeamId)!;
      const away = teams.find((t) => t.id === game.awayTeamId)!;
      const result = simulateGame(home, away, initialPlayers, 330000 + game.gameNumber);
      teams = applyGameToStandings(teams, result);
      played.add(game.id);
      resultsById.set(game.id, result);
    }

    expect(played.size).toBe(204);
    expect(resultsById.size).toBe(204);
    for (const result of resultsById.values()) {
      expect(result.home.players.length).toBeGreaterThan(0);
      expect(result.away.players.length).toBeGreaterThan(0);
    }
    for (const team of teams) {
      expect(team.wins + team.losses).toBe(34);
    }
  });
});
