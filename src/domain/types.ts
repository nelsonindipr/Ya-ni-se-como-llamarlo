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
  seasonYear: 2026;
  regularSeasonGames: 34;
  gameLengthMinutes: 40;
  quarters: 4;
  quarterLengthMinutes: 10;
  maxImportsPerTeam: 3;
  playoffTeamsPerConference: 4;
  hasPlayIn: false;
  playoffFormat: 'conference_based';
  finalsFormat: 'conference_champion_vs_conference_champion';
};

export type PlayerBoxScore = {
  playerId: string;
  playerName: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
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

export type StandingRow = Team & {
  gamesPlayed: number;
  winPct: number;
  pointDiff: number;
};
