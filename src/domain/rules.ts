import type { LeagueRules } from './types';

export const leagueRules: LeagueRules = {
  startingSeason: 2026,
  numGames: 34,
  game: {
    numPeriods: 4,
    quarterLength: 10,
    overtimeLength: 5,
    numPlayersOnCourt: 5,
    foulsNeededToFoulOut: 5,
    foulsUntilBonus: [5, 5, 5],
    threePointers: true,
    homeCourtAdvantage: 1.1,
    neutralSite: 'finals'
  },
  simulation: {
    pace: 81,
    paceIsPer48: true,
    threePointTendencyFactor: 1.5,
    threePointAccuracyFactor: 0.89,
    twoPointAccuracyFactor: 1,
    ftAccuracyFactor: 0.9,
    blockFactor: 7,
    stealFactor: 1.2,
    turnoverFactor: 1.18,
    orbFactor: 1.6,
    foulRateFactor: 2.1,
    assistFactor: 1.1
  },
  playoffs: {
    playIn: false,
    playoffsByConf: true,
    playoffsNumTeamsPerConf: 4,
    playoffsReseed: false,
    numPlayoffByes: 0,
    numGamesPlayoffSeries: [7, 7, 7],
    format: ['Conference A semifinals', 'Conference B semifinals', 'conference finals', 'BSN Final'],
    finalsMatchup: 'Conference A champion vs Conference B champion'
  },
  bsnImports: {
    maxImportsPerTeam: 3,
    maxImportChangesBeforeDeadline: 6,
    maxImportChangesAfterDeadline: 2,
    importForImportTradesOnly: true
  }
};
