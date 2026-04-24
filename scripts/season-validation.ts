import { createNewGameState, simulateScheduledGame } from '../src/state/gameState';

let state = createNewGameState(2030);

const teamSamples: Array<{ score: number; fga: number; tpa: number; fta: number; tov: number; reb: number }> = [];
let injuredUsed = 0;

for (const game of [...state.schedule].sort((a, b) => a.gameNumber - b.gameNumber)) {
  const preRuntime = state.runtimePlayers;
  state = simulateScheduledGame(state, game.id);
  const result = state.schedule.find((g) => g.id === game.id)?.result;
  if (!result) continue;

  for (const side of [result.home, result.away]) {
    const totals = side.players.reduce(
      (acc, p) => {
        acc.fga += p.fga;
        acc.tpa += p.tpa;
        acc.fta += p.fta;
        acc.tov += p.turnovers;
        acc.reb += p.rebounds;
        if ((preRuntime[p.playerId]?.injury?.gamesRemaining ?? 0) > 0 && p.minutes > 0) injuredUsed += 1;
        return acc;
      },
      { fga: 0, tpa: 0, fta: 0, tov: 0, reb: 0 }
    );
    teamSamples.push({ score: side.score, ...totals });
  }
}

const avg = (arr: number[]) => arr.reduce((sum, v) => sum + v, 0) / Math.max(1, arr.length);
const scores = teamSamples.map((s) => s.score);
const standingsGp = state.teams.reduce((sum, t) => sum + t.wins + t.losses, 0);

console.log(
  JSON.stringify(
    {
      gamesSimulated: state.schedule.filter((g) => g.played).length,
      averageTeamScore: avg(scores),
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      averageFGA: avg(teamSamples.map((s) => s.fga)),
      average3PA: avg(teamSamples.map((s) => s.tpa)),
      averageFTA: avg(teamSamples.map((s) => s.fta)),
      averageTOV: avg(teamSamples.map((s) => s.tov)),
      averageREB: avg(teamSamples.map((s) => s.reb)),
      injuredPlayersUsed: injuredUsed,
      standingsConsistency: standingsGp === state.schedule.filter((g) => g.played).length * 2
    },
    null,
    2
  )
);
