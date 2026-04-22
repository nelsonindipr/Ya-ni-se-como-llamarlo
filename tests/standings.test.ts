import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import { simulateGame } from '../src/simulation/engine';
import { applyGameToStandings, toStandingRows } from '../src/simulation/standings';

describe('standings update', () => {
  it('updates wins/losses and keeps conference standings available', () => {
    const result = simulateGame(initialTeams[0], initialTeams[6], initialPlayers, 99);
    const teams = applyGameToStandings(initialTeams, result);
    const rows = toStandingRows(teams);
    const played = rows.filter((r) => r.gamesPlayed === 1);

    expect(played).toHaveLength(2);
    expect(rows.filter((r) => r.conference === 'A')).toHaveLength(6);
    expect(rows.filter((r) => r.conference === 'B')).toHaveLength(6);
  });
});
