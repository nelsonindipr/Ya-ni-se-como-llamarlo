export type Conference = 'A' | 'B';

export type PlayerType = 'native' | 'import' | 'reserved_rights';
export type ContractStatus = 'active' | 'expiring' | 'unsigned';
export type RosterStatus = 'active' | 'reserve' | 'injured_list';
export type PlayerRole =
  | 'primary_ball_handler'
  | 'secondary_creator'
  | 'wing_scorer'
  | 'stretch_big'
  | 'rim_protector'
  | 'energy_big'
  | '3_and_d'
  | 'bench_spark';

export type PlayerTendencies = {
  shot3Rate: number;
  driveRate: number;
  postUpRate: number;
  passRate: number;
  foulDrawRate: number;
};

export type PlayerRatings = {
  insideScoring: number;
  midRangeScoring: number;
  threePointScoring: number;
  playmaking: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  stamina: number;
};

export type Team = {
  id: string;
  name: string;
  city: string;
  abbreviation: string;
  conference: Conference;
  arena: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  importSlotsUsed: number;
  importChangesUsed: number;
};

export type Player = {
  id: string;
  teamId: string;
  name: string;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  age: number;
  role: PlayerRole;
  tendencies: PlayerTendencies;
  ratings: PlayerRatings;
  minutesTarget: number;
  playerType: PlayerType;
  rightsTeamId?: string;
  salary?: number;
  contractStatus?: ContractStatus;
  rosterStatus?: RosterStatus;
  importSlot?: 1 | 2 | 3;
  isImport: boolean;
  importChangeCount: number;
  injurySalaryReliefEligible: boolean;
  technicalFoulCount: number;
};

export type LeagueRules = {
  startingSeason: 2026;
  numGames: 34;
  game: {
    numPeriods: 4;
    quarterLength: 10;
    overtimeLength: 5;
    numPlayersOnCourt: 5;
    foulsNeededToFoulOut: 5;
    foulsUntilBonus: [5, 5, 5, 5];
    threePointers: true;
    homeCourtAdvantage: number;
    neutralSite: 'finals';
  };
  simulation: {
    pace: number;
    paceIsPer48: boolean;
    threePointTendencyFactor: number;
    threePointAccuracyFactor: number;
    twoPointAccuracyFactor: number;
    ftAccuracyFactor: number;
    blockFactor: number;
    stealFactor: number;
    turnoverFactor: number;
    orbFactor: number;
    foulRateFactor: number;
    assistFactor: number;
  };
  playoffs: {
    playIn: false;
    playoffsByConf: true;
    playoffsNumTeamsPerConf: 4;
    playoffsReseed: false;
    numPlayoffByes: 0;
    numGamesPlayoffSeries: [7, 7, 7];
    format: [
      'Conference A semifinals',
      'Conference B semifinals',
      'conference finals',
      'BSN Final'
    ];
    finalsMatchup: 'Conference A champion vs Conference B champion';
  };
  bsnImports: {
    maxImportsPerTeam: 3;
    maxImportChangesBeforeDeadline: 6;
    maxImportChangesAfterDeadline: 2;
    importForImportTradesOnly: true;
  };
};

export type PlayerBoxScore = {
  playerId: string;
  playerName: string;
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

export type TeamGameBox = {
  teamId: string;
  teamName: string;
  score: number;
  byQuarter: [number, number, number, number];
  players: PlayerBoxScore[];
};

export type GameResult = {
  id: string;
  home: TeamGameBox;
  away: TeamGameBox;
  winnerTeamId: string;
};

export type ScheduledGame = {
  id: string;
  gameNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  resultId?: string;
  homeScore?: number;
  awayScore?: number;
};

export type StandingRow = Team & {
  gamesPlayed: number;
  winPct: number;
  pointDiff: number;
};

export type PlayoffRound = 'conference_semifinals' | 'conference_finals' | 'bsn_final';

export type PlayoffSeriesGame = {
  gameNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  seed: number;
  resultId: string;
  homeScore: number;
  awayScore: number;
  winnerTeamId: string;
};

export type PlayoffSeries = {
  id: string;
  round: PlayoffRound;
  conference?: Conference;
  bestOf: number;
  higherSeed: number;
  lowerSeed: number;
  higherSeedTeamId?: string;
  lowerSeedTeamId?: string;
  winsByTeamId: Record<string, number>;
  games: PlayoffSeriesGame[];
  winnerTeamId?: string;
};

export type PlayoffBracket = {
  generated: boolean;
  conferenceSemifinals: {
    a1v4: PlayoffSeries;
    a2v3: PlayoffSeries;
    b1v4: PlayoffSeries;
    b2v3: PlayoffSeries;
  };
  conferenceFinals: {
    a: PlayoffSeries;
    b: PlayoffSeries;
  };
  bsnFinal: PlayoffSeries;
  championTeamId?: string;
};
