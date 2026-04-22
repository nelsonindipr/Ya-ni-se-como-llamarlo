import type { GameResult, StandingRow, Team } from '../domain/types';

export const applyGameToStandings = (teams: Team[], result: GameResult): Team[] =>
  teams.map((team) => {
    if (team.id !== result.home.teamId && team.id !== result.away.teamId) return team;

    const isHome = team.id === result.home.teamId;
    const scored = isHome ? result.home.score : result.away.score;
    const allowed = isHome ? result.away.score : result.home.score;
    const won = result.winnerTeamId === team.id;

    return {
      ...team,
      wins: team.wins + (won ? 1 : 0),
      losses: team.losses + (won ? 0 : 1),
      pointsFor: team.pointsFor + scored,
      pointsAgainst: team.pointsAgainst + allowed
    };
  });

export const toStandingRows = (teams: Team[]): StandingRow[] =>
  teams
    .map((team) => {
      const gamesPlayed = team.wins + team.losses;
      return {
        ...team,
        gamesPlayed,
        winPct: gamesPlayed === 0 ? 0 : team.wins / gamesPlayed,
        pointDiff: team.pointsFor - team.pointsAgainst
      };
    })
    .sort((a, b) => b.winPct - a.winPct || b.pointDiff - a.pointDiff || b.pointsFor - a.pointsFor);
