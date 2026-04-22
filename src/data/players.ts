import type { Player, PlayerRole, PlayerTendencies, Team } from '../domain/types';
import { initialTeams } from './teams';

type Template = {
  position: Player['position'];
  role: PlayerRole;
  ratingsBase: number;
  minutesTarget: number;
  tendencies: PlayerTendencies;
};

const templates: Template[] = [
  { position: 'PG', role: 'primary_ball_handler', ratingsBase: 76, minutesTarget: 30, tendencies: { shot3Rate: 0.31, driveRate: 0.34, postUpRate: 0.02, passRate: 0.57, foulDrawRate: 0.15 } },
  { position: 'SG', role: 'wing_scorer', ratingsBase: 75, minutesTarget: 28, tendencies: { shot3Rate: 0.37, driveRate: 0.31, postUpRate: 0.03, passRate: 0.38, foulDrawRate: 0.14 } },
  { position: 'SF', role: '3_and_d', ratingsBase: 74, minutesTarget: 27, tendencies: { shot3Rate: 0.35, driveRate: 0.29, postUpRate: 0.05, passRate: 0.31, foulDrawRate: 0.12 } },
  { position: 'PF', role: 'stretch_big', ratingsBase: 73, minutesTarget: 25, tendencies: { shot3Rate: 0.28, driveRate: 0.27, postUpRate: 0.16, passRate: 0.26, foulDrawRate: 0.13 } },
  { position: 'C', role: 'rim_protector', ratingsBase: 75, minutesTarget: 27, tendencies: { shot3Rate: 0.08, driveRate: 0.21, postUpRate: 0.32, passRate: 0.2, foulDrawRate: 0.19 } },
  { position: 'PG', role: 'secondary_creator', ratingsBase: 72, minutesTarget: 20, tendencies: { shot3Rate: 0.3, driveRate: 0.3, postUpRate: 0.01, passRate: 0.5, foulDrawRate: 0.11 } },
  { position: 'SG', role: 'bench_spark', ratingsBase: 71, minutesTarget: 18, tendencies: { shot3Rate: 0.38, driveRate: 0.26, postUpRate: 0.02, passRate: 0.3, foulDrawRate: 0.1 } },
  { position: 'SF', role: '3_and_d', ratingsBase: 70, minutesTarget: 18, tendencies: { shot3Rate: 0.36, driveRate: 0.22, postUpRate: 0.07, passRate: 0.26, foulDrawRate: 0.09 } },
  { position: 'PF', role: 'energy_big', ratingsBase: 70, minutesTarget: 16, tendencies: { shot3Rate: 0.14, driveRate: 0.24, postUpRate: 0.21, passRate: 0.17, foulDrawRate: 0.12 } },
  { position: 'C', role: 'energy_big', ratingsBase: 69, minutesTarget: 14, tendencies: { shot3Rate: 0.03, driveRate: 0.17, postUpRate: 0.31, passRate: 0.15, foulDrawRate: 0.15 } },
  { position: 'SG', role: 'bench_spark', ratingsBase: 68, minutesTarget: 10, tendencies: { shot3Rate: 0.34, driveRate: 0.21, postUpRate: 0.03, passRate: 0.24, foulDrawRate: 0.08 } },
  { position: 'PF', role: 'stretch_big', ratingsBase: 68, minutesTarget: 7, tendencies: { shot3Rate: 0.24, driveRate: 0.18, postUpRate: 0.2, passRate: 0.2, foulDrawRate: 0.08 } }
];

const clamp = (value: number): number => Math.max(55, Math.min(92, Math.round(value)));

const teamAdjustment = (team: Team): number => {
  const charCode = team.id.charCodeAt(0) + team.id.charCodeAt(1) + team.id.charCodeAt(2);
  return (charCode % 7) - 3;
};

const ratingsFromTemplate = (template: Template, boost: number) => ({
  insideScoring: clamp(template.ratingsBase + (template.position === 'C' || template.position === 'PF' ? 4 : 0) + boost),
  midRangeScoring: clamp(template.ratingsBase + 1 + boost),
  threePointScoring: clamp(template.ratingsBase + (template.position === 'PG' || template.position === 'SG' || template.role === '3_and_d' ? 4 : -3) + boost),
  playmaking: clamp(template.ratingsBase + (template.position === 'PG' ? 8 : template.position === 'SG' ? 1 : -2) + boost),
  perimeterDefense: clamp(template.ratingsBase + (template.position === 'SF' || template.position === 'SG' ? 4 : -1) + boost),
  interiorDefense: clamp(template.ratingsBase + (template.position === 'C' || template.position === 'PF' ? 6 : -3) + boost),
  rebounding: clamp(template.ratingsBase + (template.position === 'C' ? 7 : template.position === 'PF' ? 4 : -2) + boost),
  stamina: clamp(76 + (template.minutesTarget > 24 ? 5 : 0) + boost)
});

const playerTypeForIndex = (index: number) => {
  if (index < 3) return 'import' as const;
  if (index === 11) return 'reserved_rights' as const;
  return 'native' as const;
};

const createTeamRoster = (team: Team): Player[] => {
  const adjust = teamAdjustment(team);

  return templates.map((template, index) => {
    const pType = playerTypeForIndex(index);
    const isImport = pType === 'import';
    return {
      id: `${team.id}-p${index + 1}`,
      teamId: team.id,
      name: `${team.abbreviation} Player ${index + 1}`,
      position: template.position,
      age: 22 + ((index + adjust + 12) % 12),
      role: template.role,
      tendencies: template.tendencies,
      ratings: ratingsFromTemplate(template, adjust),
      minutesTarget: template.minutesTarget,
      playerType: pType,
      rightsTeamId: pType === 'reserved_rights' ? team.id : undefined,
      salary: 18000 + index * 4500,
      contractStatus: 'active',
      rosterStatus: 'active',
      importSlot: isImport ? ((index + 1) as 1 | 2 | 3) : undefined,
      isImport,
      importChangeCount: 0,
      injurySalaryReliefEligible: false,
      technicalFoulCount: 0
    };
  });
};

export const initialPlayers: Player[] = initialTeams.flatMap(createTeamRoster);
