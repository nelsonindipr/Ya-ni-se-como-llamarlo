import { describe, expect, it } from 'vitest';
import { initialPlayers } from '../data/players';
import { initialTeams } from '../data/teams';
import type { Team } from '../domain/types';
import { generatePlayoffBracket, simulateEntirePlayoffs } from './playoffs';
import { toStandingRows } from './standings';

const seededTeams = (): Team[] =>
  initialTeams.map((team) => {
    const seedByTeam: Record<string, number> = {
      bay: 30,
      san: 28,
      cag: 26,
      car: 24,
      gua: 20,
      man: 18,
      may: 29,
      que: 27,
      pon: 25,
      are: 23,
      sgm: 21,
      agu: 19
    };
    const wins = seedByTeam[team.id] ?? 0;
    return {
      ...team,
      wins,
      losses: 34 - wins,
      pointsFor: 3000 + wins,
      pointsAgainst: 2900
    };
  });

describe('BSN playoffs bracket generation', () => {
  it('qualifies top 4 teams from each conference and builds 1v4 + 2v3 with no play-in', () => {
    const bracket = generatePlayoffBracket(toStandingRows(seededTeams()));

    expect(bracket.conferenceSemifinals.a1v4.higherSeed).toBe(1);
    expect(bracket.conferenceSemifinals.a1v4.lowerSeed).toBe(4);
    expect(bracket.conferenceSemifinals.a2v3.higherSeed).toBe(2);
    expect(bracket.conferenceSemifinals.a2v3.lowerSeed).toBe(3);

    expect(bracket.conferenceSemifinals.b1v4.higherSeed).toBe(1);
    expect(bracket.conferenceSemifinals.b1v4.lowerSeed).toBe(4);
    expect(bracket.conferenceSemifinals.b2v3.higherSeed).toBe(2);
    expect(bracket.conferenceSemifinals.b2v3.lowerSeed).toBe(3);

    const semifinalTeamIds = [
      bracket.conferenceSemifinals.a1v4.higherSeedTeamId,
      bracket.conferenceSemifinals.a1v4.lowerSeedTeamId,
      bracket.conferenceSemifinals.a2v3.higherSeedTeamId,
      bracket.conferenceSemifinals.a2v3.lowerSeedTeamId,
      bracket.conferenceSemifinals.b1v4.higherSeedTeamId,
      bracket.conferenceSemifinals.b1v4.lowerSeedTeamId,
      bracket.conferenceSemifinals.b2v3.higherSeedTeamId,
      bracket.conferenceSemifinals.b2v3.lowerSeedTeamId
    ];

    expect(semifinalTeamIds.filter((id) => id === 'gua' || id === 'man' || id === 'sgm' || id === 'agu')).toHaveLength(0);
    expect(bracket.conferenceFinals.a.higherSeedTeamId).toBeUndefined();
    expect(bracket.conferenceFinals.b.higherSeedTeamId).toBeUndefined();
  });

  it('advances winners correctly with no reseeding and produces A champ vs B champ in BSN Final', () => {
    const bracket = generatePlayoffBracket(toStandingRows(seededTeams()));
    const finished = simulateEntirePlayoffs(bracket, seededTeams(), initialPlayers, 2026);

    expect(finished.conferenceFinals.a.higherSeedTeamId).toBeDefined();
    expect(finished.conferenceFinals.a.lowerSeedTeamId).toBeDefined();
    expect(finished.conferenceFinals.b.higherSeedTeamId).toBeDefined();
    expect(finished.conferenceFinals.b.lowerSeedTeamId).toBeDefined();
    expect(finished.conferenceFinals.a.winnerTeamId).toBeDefined();
    expect(finished.conferenceFinals.b.winnerTeamId).toBeDefined();

    expect(finished.bsnFinal.higherSeedTeamId).toBeDefined();
    expect(finished.bsnFinal.lowerSeedTeamId).toBeDefined();
    expect(finished.bsnFinal.winnerTeamId).toBeDefined();
    expect(finished.championTeamId).toBe(finished.bsnFinal.winnerTeamId);

    const teamById = new Map(initialTeams.map((team) => [team.id, team]));
    const finalHighConf = teamById.get(finished.bsnFinal.higherSeedTeamId ?? '')?.conference;
    const finalLowConf = teamById.get(finished.bsnFinal.lowerSeedTeamId ?? '')?.conference;
    expect(finalHighConf).toBeDefined();
    expect(finalLowConf).toBeDefined();
    expect(finalHighConf).not.toBe(finalLowConf);
  });
});
