import type { LeagueRules } from './types';

export const leagueRules: LeagueRules = {
  seasonYear: 2026,
  regularSeasonGames: 34,
  gameLengthMinutes: 40,
  quarters: 4,
  quarterLengthMinutes: 10,
  maxImportsPerTeam: 3,
  playoffTeamsPerConference: 4,
  hasPlayIn: false,
  playoffFormat: 'conference_based',
  finalsFormat: 'conference_champion_vs_conference_champion'
};
