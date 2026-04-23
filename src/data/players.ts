import type { Player, PlayerRole, PlayerTendencies, Position, Team } from '../domain/types';
import { initialTeams } from './teams';

type Template = {
  position: Position;
  secondaryPositions: Position[];
  role: PlayerRole;
  ratingsBase: number;
  minutesTarget: number;
  tendencies: PlayerTendencies;
};

const templates: Template[] = [
  { position: 'PG', secondaryPositions: ['SG'], role: 'primary_ball_handler', ratingsBase: 76, minutesTarget: 30, tendencies: { threePointTendency: 0.31, midRangeTendency: 0.16, driveTendency: 0.34, postUpTendency: 0.02, passTendency: 0.57, drawFoulTendency: 0.15, crashOffGlassTendency: 0.06 } },
  { position: 'SG', secondaryPositions: ['SF'], role: 'wing_scorer', ratingsBase: 75, minutesTarget: 28, tendencies: { threePointTendency: 0.37, midRangeTendency: 0.19, driveTendency: 0.31, postUpTendency: 0.03, passTendency: 0.38, drawFoulTendency: 0.14, crashOffGlassTendency: 0.09 } },
  { position: 'SF', secondaryPositions: ['SG', 'PF'], role: '3_and_d', ratingsBase: 74, minutesTarget: 27, tendencies: { threePointTendency: 0.35, midRangeTendency: 0.17, driveTendency: 0.29, postUpTendency: 0.05, passTendency: 0.31, drawFoulTendency: 0.12, crashOffGlassTendency: 0.11 } },
  { position: 'PF', secondaryPositions: ['C'], role: 'stretch_big', ratingsBase: 73, minutesTarget: 25, tendencies: { threePointTendency: 0.28, midRangeTendency: 0.2, driveTendency: 0.27, postUpTendency: 0.16, passTendency: 0.26, drawFoulTendency: 0.13, crashOffGlassTendency: 0.16 } },
  { position: 'C', secondaryPositions: ['PF'], role: 'rim_protector', ratingsBase: 75, minutesTarget: 27, tendencies: { threePointTendency: 0.08, midRangeTendency: 0.12, driveTendency: 0.21, postUpTendency: 0.32, passTendency: 0.2, drawFoulTendency: 0.19, crashOffGlassTendency: 0.24 } },
  { position: 'PG', secondaryPositions: ['SG'], role: 'secondary_creator', ratingsBase: 72, minutesTarget: 20, tendencies: { threePointTendency: 0.3, midRangeTendency: 0.14, driveTendency: 0.3, postUpTendency: 0.01, passTendency: 0.5, drawFoulTendency: 0.11, crashOffGlassTendency: 0.05 } },
  { position: 'SG', secondaryPositions: ['PG'], role: 'bench_spark', ratingsBase: 71, minutesTarget: 18, tendencies: { threePointTendency: 0.38, midRangeTendency: 0.16, driveTendency: 0.26, postUpTendency: 0.02, passTendency: 0.3, drawFoulTendency: 0.1, crashOffGlassTendency: 0.07 } },
  { position: 'SF', secondaryPositions: ['SG'], role: '3_and_d', ratingsBase: 70, minutesTarget: 18, tendencies: { threePointTendency: 0.36, midRangeTendency: 0.15, driveTendency: 0.22, postUpTendency: 0.07, passTendency: 0.26, drawFoulTendency: 0.09, crashOffGlassTendency: 0.12 } },
  { position: 'PF', secondaryPositions: ['C'], role: 'energy_big', ratingsBase: 70, minutesTarget: 16, tendencies: { threePointTendency: 0.14, midRangeTendency: 0.14, driveTendency: 0.24, postUpTendency: 0.21, passTendency: 0.17, drawFoulTendency: 0.12, crashOffGlassTendency: 0.19 } },
  { position: 'C', secondaryPositions: ['PF'], role: 'energy_big', ratingsBase: 69, minutesTarget: 14, tendencies: { threePointTendency: 0.03, midRangeTendency: 0.11, driveTendency: 0.17, postUpTendency: 0.31, passTendency: 0.15, drawFoulTendency: 0.15, crashOffGlassTendency: 0.23 } },
  { position: 'SG', secondaryPositions: ['SF'], role: 'bench_spark', ratingsBase: 68, minutesTarget: 10, tendencies: { threePointTendency: 0.34, midRangeTendency: 0.13, driveTendency: 0.21, postUpTendency: 0.03, passTendency: 0.24, drawFoulTendency: 0.08, crashOffGlassTendency: 0.08 } },
  { position: 'PF', secondaryPositions: ['SF'], role: 'stretch_big', ratingsBase: 68, minutesTarget: 7, tendencies: { threePointTendency: 0.24, midRangeTendency: 0.16, driveTendency: 0.18, postUpTendency: 0.2, passTendency: 0.2, drawFoulTendency: 0.08, crashOffGlassTendency: 0.14 } }
];

const firstNames = ['Luis', 'Carlos', 'Javier', 'Andre', 'Miguel', 'Jose', 'Ramon', 'Eric', 'Pedro', 'Isaiah', 'Mateo', 'Derrick'];
const lastNames = ['Rivera', 'Santiago', 'Rodriguez', 'Morales', 'Ortiz', 'Lopez', 'Torres', 'Diaz', 'Ramos', 'Cruz', 'Vazquez', 'Colon'];

const clamp = (value: number): number => Math.max(25, Math.min(99, Math.round(value)));

const teamAdjustment = (team: Team): number => {
  const charCode = team.id.charCodeAt(0) + team.id.charCodeAt(1) + team.id.charCodeAt(2);
  return (charCode % 7) - 3;
};

const ratingsFromTemplate = (template: Template, boost: number) => ({
  closeShot: clamp(template.ratingsBase + (template.position === 'C' || template.position === 'PF' ? 4 : 0) + boost),
  drivingLayup: clamp(template.ratingsBase + (template.position === 'PG' || template.position === 'SG' ? 5 : 1) + boost),
  drivingDunk: clamp(template.ratingsBase + (template.position === 'SF' || template.position === 'PF' ? 3 : template.position === 'C' ? 5 : -2) + boost),
  standingDunk: clamp(template.ratingsBase + (template.position === 'C' ? 8 : template.position === 'PF' ? 5 : -5) + boost),
  postControl: clamp(template.ratingsBase + (template.position === 'C' || template.position === 'PF' ? 6 : -2) + boost),
  midRange: clamp(template.ratingsBase + 1 + boost),
  threePoint: clamp(template.ratingsBase + (template.position === 'PG' || template.position === 'SG' || template.role === '3_and_d' ? 4 : -3) + boost),
  freeThrow: clamp(template.ratingsBase + 3 + boost),
  shotCreation: clamp(template.ratingsBase + (template.position === 'PG' || template.position === 'SG' ? 5 : -2) + boost),
  offBallMovement: clamp(template.ratingsBase + (template.position === 'SG' || template.position === 'SF' ? 3 : 0) + boost),
  passAccuracy: clamp(template.ratingsBase + (template.position === 'PG' ? 8 : template.position === 'SG' ? 2 : -1) + boost),
  ballHandle: clamp(template.ratingsBase + (template.position === 'PG' ? 9 : template.position === 'SG' ? 3 : -2) + boost),
  speedWithBall: clamp(template.ratingsBase + (template.position === 'PG' ? 8 : template.position === 'SG' ? 4 : -1) + boost),
  interiorDefense: clamp(template.ratingsBase + (template.position === 'C' || template.position === 'PF' ? 6 : -3) + boost),
  perimeterDefense: clamp(template.ratingsBase + (template.position === 'SF' || template.position === 'SG' ? 4 : -1) + boost),
  steal: clamp(template.ratingsBase + (template.position === 'PG' || template.position === 'SG' ? 4 : -2) + boost),
  block: clamp(template.ratingsBase + (template.position === 'C' ? 9 : template.position === 'PF' ? 5 : -5) + boost),
  offensiveRebound: clamp(template.ratingsBase + (template.position === 'C' ? 8 : template.position === 'PF' ? 5 : -3) + boost),
  defensiveRebound: clamp(template.ratingsBase + (template.position === 'C' ? 8 : template.position === 'PF' ? 5 : -1) + boost),
  speed: clamp(template.ratingsBase + (template.position === 'PG' ? 8 : template.position === 'SG' ? 5 : -1) + boost),
  acceleration: clamp(template.ratingsBase + (template.position === 'PG' ? 8 : template.position === 'SG' ? 5 : -1) + boost),
  strength: clamp(template.ratingsBase + (template.position === 'C' ? 8 : template.position === 'PF' ? 5 : -2) + boost),
  vertical: clamp(template.ratingsBase + (template.position === 'SF' || template.position === 'PF' ? 4 : template.position === 'C' ? 2 : 3) + boost),
  stamina: clamp(76 + (template.minutesTarget > 24 ? 5 : 0) + boost),
  offensiveIQ: clamp(template.ratingsBase + 2 + boost),
  defensiveIQ: clamp(template.ratingsBase + (template.position === 'C' || template.position === 'PF' ? 3 : 1) + boost)
});

const playerTypeForIndex = (index: number) => {
  if (index < 3) return 'import' as const;
  if (index === 11) return 'reserved_rights' as const;
  return 'native' as const;
};

const yearsProForAge = (age: number): number => Math.max(0, age - 21);

const createTeamRoster = (team: Team): Player[] => {
  const adjust = teamAdjustment(team);

  return templates.map((template, index) => {
    const pType = playerTypeForIndex(index);
    const isImport = pType === 'import';
    const age = 22 + ((index + adjust + 12) % 12);
    const firstName = firstNames[(index + adjust + 12) % firstNames.length];
    const lastName = lastNames[(index + team.name.length) % lastNames.length];
    const displayName = `${firstName} ${lastName}`;

    return {
      id: `${team.id}-p${index + 1}`,
      teamId: team.id,
      name: displayName,
      firstName,
      lastName,
      displayName,
      birthdate: `${2026 - age}-07-01`,
      age,
      nationality: isImport ? 'USA' : 'Puerto Rico',
      hometown: isImport ? 'Miami, FL' : `${team.city}, PR`,
      height: template.position === 'PG' ? 74 : template.position === 'SG' ? 77 : template.position === 'SF' ? 79 : template.position === 'PF' ? 81 : 83,
      weight: template.position === 'PG' ? 180 : template.position === 'SG' ? 198 : template.position === 'SF' ? 215 : template.position === 'PF' ? 232 : 250,
      position: template.position,
      secondaryPositions: template.secondaryPositions,
      shootingHand: index % 7 === 0 ? 'left' : 'right',
      jerseyNumber: index + 1,
      college: isImport ? 'NCAA Program' : 'UPR',
      previousTeam: index === 0 ? 'Overseas Club' : team.name,
      yearsPro: yearsProForAge(age),
      role: template.role,
      tendencies: template.tendencies,
      ratings: ratingsFromTemplate(template, adjust),
      minutesTarget: template.minutesTarget,
      playerType: pType,
      rightsTeamId: pType === 'reserved_rights' ? team.id : undefined,
      salary: 18000 + index * 4500,
      contractStatus: 'active',
      rosterStatus: pType === 'reserved_rights' ? 'reserve' : 'active',
      importSlot: isImport ? ((index + 1) as 1 | 2 | 3) : undefined,
      isImport,
      importChangeCount: 0,
      injurySalaryReliefEligible: false,
      technicalFoulCount: 0
    };
  });
};

export const initialPlayers: Player[] = initialTeams.flatMap(createTeamRoster);
