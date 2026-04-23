import type { GameResult, Player, Team } from '../domain/types';

export type SeasonStage = 'regular' | 'playoffs';

export type PlayerSeasonStats = {
  gamesPlayed: number;
  minutes: number;
  points: number;
  rebounds: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  fouls: number;
  turnovers: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
};

export type PlayerGameLog = {
  gameId: string;
  stage: SeasonStage;
  opponentTeamId: string;
  points: number;
  rebounds: number;
  assists: number;
  minutes: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
};

export type TeamSeasonStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
};

export type SeasonStatsState = {
  regularPlayerStats: Record<string, PlayerSeasonStats>;
  playoffPlayerStats: Record<string, PlayerSeasonStats>;
  regularTeamStats: Record<string, TeamSeasonStats>;
  playoffTeamStats: Record<string, TeamSeasonStats>;
  playerGameLogs: Record<string, PlayerGameLog[]>;
  processedRegularGameIds: string[];
  processedPlayoffGameIds: string[];
};

const emptyPlayerStats = (): PlayerSeasonStats => ({
  gamesPlayed: 0,
  minutes: 0,
  points: 0,
  rebounds: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  fouls: 0,
  turnovers: 0,
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0
});

const emptyTeamStats = (): TeamSeasonStats => ({
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0
});

export const createEmptySeasonStats = (players: Player[], teams: Team[]): SeasonStatsState => ({
  regularPlayerStats: Object.fromEntries(players.map((p) => [p.id, emptyPlayerStats()])),
  playoffPlayerStats: Object.fromEntries(players.map((p) => [p.id, emptyPlayerStats()])),
  regularTeamStats: Object.fromEntries(teams.map((t) => [t.id, emptyTeamStats()])),
  playoffTeamStats: Object.fromEntries(teams.map((t) => [t.id, emptyTeamStats()])),
  playerGameLogs: Object.fromEntries(players.map((p) => [p.id, []])),
  processedRegularGameIds: [],
  processedPlayoffGameIds: []
});

export const addGameToStats = (current: SeasonStatsState, result: GameResult, stage: SeasonStage): SeasonStatsState => {
  const gameIdSet = new Set(stage === 'regular' ? current.processedRegularGameIds : current.processedPlayoffGameIds);
  if (gameIdSet.has(result.id)) return current;

  const next: SeasonStatsState = structuredClone(current);
  const playerStats = stage === 'regular' ? next.regularPlayerStats : next.playoffPlayerStats;
  const teamStats = stage === 'regular' ? next.regularTeamStats : next.playoffTeamStats;

  for (const box of [result.home, result.away]) {
    const opponentTeamId = box.teamId === result.home.teamId ? result.away.teamId : result.home.teamId;
    const t = teamStats[box.teamId] ?? emptyTeamStats();
    t.gamesPlayed += 1;
    t.pointsFor += box.score;
    t.pointsAgainst += box.teamId === result.home.teamId ? result.away.score : result.home.score;
    if (result.winnerTeamId === box.teamId) t.wins += 1;
    else t.losses += 1;

    for (const p of box.players) {
      const s = playerStats[p.playerId] ?? emptyPlayerStats();
      s.gamesPlayed += 1;
      s.minutes += p.minutes;
      s.points += p.points;
      s.rebounds += p.rebounds;
      s.offensiveRebounds += p.offensiveRebounds;
      s.defensiveRebounds += p.defensiveRebounds;
      s.assists += p.assists;
      s.steals += p.steals;
      s.blocks += p.blocks;
      s.fouls += p.fouls;
      s.turnovers += p.turnovers;
      s.fgm += p.fgm;
      s.fga += p.fga;
      s.tpm += p.tpm;
      s.tpa += p.tpa;
      s.ftm += p.ftm;
      s.fta += p.fta;
      playerStats[p.playerId] = s;

      const logs = next.playerGameLogs[p.playerId] ?? [];
      logs.push({
        gameId: result.id,
        stage,
        opponentTeamId,
        points: p.points,
        rebounds: p.rebounds,
        assists: p.assists,
        minutes: p.minutes,
        fgm: p.fgm,
        fga: p.fga,
        tpm: p.tpm,
        tpa: p.tpa,
        ftm: p.ftm,
        fta: p.fta
      });
      next.playerGameLogs[p.playerId] = logs;

      t.rebounds += p.rebounds;
      t.assists += p.assists;
      t.steals += p.steals;
      t.blocks += p.blocks;
      t.turnovers += p.turnovers;
      t.fouls += p.fouls;
      t.fgm += p.fgm;
      t.fga += p.fga;
      t.tpm += p.tpm;
      t.tpa += p.tpa;
      t.ftm += p.ftm;
      t.fta += p.fta;
    }

    teamStats[box.teamId] = t;
  }

  if (stage === 'regular') next.processedRegularGameIds.push(result.id);
  else next.processedPlayoffGameIds.push(result.id);

  return next;
};

export const pct = (made: number, attempts: number): number => (attempts > 0 ? made / attempts : 0);


export type LeaderRow = {
  playerId: string;
  gamesPlayed: number;
  mpg: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
  fga: number;
  tpa: number;
  fta: number;
};

export const leaderRowsFromStats = (players: Player[], stats: Record<string, PlayerSeasonStats>): LeaderRow[] =>
  players
    .map((player) => {
      const s = stats[player.id] ?? emptyPlayerStats();
      return {
        playerId: player.id,
        gamesPlayed: s.gamesPlayed,
        mpg: s.gamesPlayed ? s.minutes / s.gamesPlayed : 0,
        ppg: s.gamesPlayed ? s.points / s.gamesPlayed : 0,
        rpg: s.gamesPlayed ? s.rebounds / s.gamesPlayed : 0,
        apg: s.gamesPlayed ? s.assists / s.gamesPlayed : 0,
        spg: s.gamesPlayed ? s.steals / s.gamesPlayed : 0,
        bpg: s.gamesPlayed ? s.blocks / s.gamesPlayed : 0,
        fgPct: pct(s.fgm, s.fga),
        threePct: pct(s.tpm, s.tpa),
        ftPct: pct(s.ftm, s.fta),
        fga: s.fga,
        tpa: s.tpa,
        fta: s.fta
      };
    })
    .filter((row) => row.gamesPlayed > 0);
