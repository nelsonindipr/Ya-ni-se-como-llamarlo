import type { Player, PlayerArchetype, PlayerRatings, PlayerRole, PlayerTendencies, PlayerTier, Position } from '../domain/types';
import { playerRatingOverrides } from './playerRatingOverrides';

const SOURCE_NOTE = 'BSN 2026 roster document updated April 23, 2026';

type PositionProfile = { role: PlayerRole; minutesTarget: number };

const profiles: Record<Position, PositionProfile> = {
  PG: { role: 'primary_ball_handler', minutesTarget: 26 },
  SG: { role: 'wing_scorer', minutesTarget: 24 },
  SF: { role: '3_and_d', minutesTarget: 23 },
  PF: { role: 'stretch_big', minutesTarget: 22 },
  C: { role: 'rim_protector', minutesTarget: 21 }
};

const clamp = (value: number): number => Math.max(25, Math.min(99, Math.round(value)));

const tierBase: Record<PlayerTier, number> = {
  superstar: 91,
  star: 86,
  strong_starter: 82,
  starter: 77,
  rotation: 72,
  bench: 67,
  prospect: 62
};

const ageCurve = (age: number): number => {
  if (age <= 21) return -1;
  if (age <= 25) return 1;
  if (age <= 31) return 0;
  if (age <= 35) return -1;
  if (age <= 38) return -2;
  return -3;
};

const importMod = (isImport: boolean): number => (isImport ? 2 : 0);

const archetypeMods: Record<PlayerArchetype, Partial<Record<keyof PlayerRatings, number>>> = {
  balanced_guard: { passAccuracy: 2, ballHandle: 2, speed: 1, acceleration: 1 },
  playmaker: { passAccuracy: 6, ballHandle: 4, shotCreation: 2, offensiveIQ: 3 },
  movement_shooter: { threePoint: 6, offBallMovement: 5, midRange: 2, drivingDunk: -2 },
  shot_creator: { shotCreation: 5, ballHandle: 3, midRange: 3, drivingLayup: 2, offensiveIQ: 2 },
  slasher: { drivingLayup: 5, drivingDunk: 4, freeThrow: 2, threePoint: -2 },
  '3_and_d_wing': { threePoint: 4, perimeterDefense: 5, steal: 3, offBallMovement: 2 },
  versatile_forward: { closeShot: 3, midRange: 3, perimeterDefense: 2, interiorDefense: 2, offensiveIQ: 2 },
  stretch_big: { threePoint: 5, midRange: 3, standingDunk: -2, postControl: -1 },
  post_scorer: { closeShot: 5, standingDunk: 4, postControl: 5, strength: 3, passAccuracy: -1 },
  rim_protector: { interiorDefense: 6, block: 7, defensiveRebound: 4, standingDunk: 3, threePoint: -4 },
  rebounding_big: { offensiveRebound: 6, defensiveRebound: 7, strength: 3, interiorDefense: 3 },
  energy_big: { offensiveRebound: 4, defensiveRebound: 4, vertical: 3, stamina: 3, shotCreation: -2 }
};

const positionMods: Record<Position, Partial<Record<keyof PlayerRatings, number>>> = {
  PG: { drivingLayup: 2, passAccuracy: 3, ballHandle: 4, speed: 4, acceleration: 4, interiorDefense: -3, block: -4, strength: -3 },
  SG: { threePoint: 2, shotCreation: 2, perimeterDefense: 1, speed: 2, acceleration: 2, interiorDefense: -2, block: -3 },
  SF: { closeShot: 1, drivingDunk: 2, perimeterDefense: 2, defensiveRebound: 1, strength: 1 },
  PF: { closeShot: 3, standingDunk: 3, postControl: 3, interiorDefense: 3, offensiveRebound: 3, defensiveRebound: 3, speed: -1, acceleration: -1 },
  C: { closeShot: 4, standingDunk: 5, postControl: 4, interiorDefense: 5, block: 6, offensiveRebound: 5, defensiveRebound: 5, speed: -3, acceleration: -3, threePoint: -3 }
};

const applyMods = (target: PlayerRatings, mods: Partial<Record<keyof PlayerRatings, number>>) => {
  for (const [key, delta] of Object.entries(mods)) {
    const ratingKey = key as keyof PlayerRatings;
    target[ratingKey] = clamp(target[ratingKey] + (delta ?? 0));
  }
};

const buildRatings = (position: Position, tier: PlayerTier, archetype: PlayerArchetype, age: number, isImport: boolean): PlayerRatings => {
  const base = tierBase[tier] + ageCurve(age) + importMod(isImport);
  const ratings: PlayerRatings = {
    closeShot: clamp(base),
    drivingLayup: clamp(base),
    drivingDunk: clamp(base - 1),
    standingDunk: clamp(base - 1),
    postControl: clamp(base - 1),
    midRange: clamp(base),
    threePoint: clamp(base),
    freeThrow: clamp(base + 1),
    drawFoul: clamp(base),
    shotCreation: clamp(base),
    offBallMovement: clamp(base),
    passAccuracy: clamp(base),
    ballHandle: clamp(base),
    clutch: clamp(base),
    hustle: clamp(base),
    interiorDefense: clamp(base),
    perimeterDefense: clamp(base),
    steal: clamp(base - 1),
    block: clamp(base - 1),
    offensiveRebound: clamp(base - 1),
    defensiveRebound: clamp(base),
    speed: clamp(base),
    acceleration: clamp(base),
    strength: clamp(base),
    vertical: clamp(base),
    stamina: clamp(base + 2),
    offensiveIQ: clamp(base + 1),
    defensiveIQ: clamp(base + 1)
  };

  applyMods(ratings, positionMods[position]);
  applyMods(ratings, archetypeMods[archetype]);
  return ratings;
};

const teamNameToId: Record<string, string> = {
  'Vaqueros de Bayamón': 'bay',
  'Cangrejeros de Santurce': 'san',
  'Criollos de Caguas': 'cag',
  'Gigantes de Carolina/Canóvanas': 'car',
  'Mets de Guaynabo': 'gua',
  'Indios de Mayagüez': 'may',
  'Piratas de Quebradillas': 'que',
  'Capitanes de Arecibo': 'are',
  'Leones de Ponce': 'pon',
  'Atléticos de San Germán': 'sgm',
  'Santeros de Aguada': 'agu',
  'Osos de Manatí': 'man'
};

const rosterDocument = `
Vaqueros de Bayamón
Gary Browne|32|6-1 (185 cm)|PG|No
Isiah Gaiter|25|6-4 (193 cm)|PG/G|No*
Javier Ezquerra|24|6-1 (185 cm)|PG/G|No
Khary/Ky Mauras|28|6-0 (183 cm)|PG/G|No
Daniel Ortiz|23|6-0 (183 cm)|G|No
Neftalí Acevedo|26|5-11 (180 cm)|G|No
Javier Mojica|41|6-3 (190 cm)|SG/GF|No
Stephen Thompson Jr.|28|6-4 (193 cm)|SG|No
Isaiah Palermo|25|6-5 (196 cm)|GF/SG|No
Jordan Cintrón|27|6-8 (203 cm)|PF/F|No
Reinaldo Balkman|41|6-8 (203 cm)|PF/F|No
Luis P. Hernández|37|6-8 (203 cm)|C/F|No
Jae Crowder|35|6-6 (198 cm)|SF|Sí
Jaylin Galloway|23|6-6 (198 cm)|SF/F|Sí
Xavier Cooks|30|6-8 (203 cm)|PF/GF|Sí
Cangrejeros de Santurce
Ángel Rodríguez|33|5-11 (180 cm)|PG|No
Walter Hodge|39|6-0 (183 cm)|PG/G|No
Jordan Howard|30|5-11 (180 cm)|G/PG|No
Emmanuel Maldonado|23|6-5 (196 cm)|G|No
David Huertas|38|6-5 (196 cm)|SG/SF|No
Corey McKeithan|24|5-10 (178 cm)|G/SG|No
Malik Beasley|29|6-5 (196 cm)|SG|Sí
Ángel Matías|33|6-4 (193 cm)|F/GF|No
Isaiah Piñeiro|31|6-7 (201 cm)|F/SF|No
Tyler Polo|38|6-7 (201 cm)|F|No
Xavier Zambrana|34|6-4 (193 cm)|F/SF|No
Devon Collier|35|6-8 (203 cm)|PF|No
Davon Jefferson|39|6-8 (203 cm)|PF|Sí
Viktor Lakhin|24|6-11 (211 cm)|F/C|Sí
Criollos de Caguas
Luis Rivera|27|5-11 (180 cm)|PG|No
Michael O'Connell|25|6-2 (188 cm)|PG|No
Travis Trice|33|6-0 (183 cm)|PG|Sí
Christian ‘Cuco’ López|30|6-0 (183 cm)|G/SG|No
Alejandro Ralat|25|6-2 (188 cm)|PG/SG|No
Jeff Early Jr.|37|6-3 (190 cm)|G/PG|No
Hiram Huertas|29|6-2 (188 cm)|SG/PG|No
Joshua Milton Denton|23|6-6 (198 cm)|GF/G|No
Anthony Morales|25|6-8 (203 cm)|SF|No
Isaiah Stone|24|6-9 (206 cm)|SF|No
Alexander Kappos|28|6-10 (208 cm)|PF/C|No
Maurice Harkless|32|6-7 (201 cm)|PF/F|No
Richard Núñez|25|6-9 (206 cm)|PF|No
Oenis Medina|27|6-8 (203 cm)|C/F|No
Jorge Bryan Díaz|36|6-11 (211 cm)|C|No
Louis King|26|6-7 (201 cm)|SF|Sí
Moses Brown|26|7-2 (218 cm)|C|Sí
Gigantes de Carolina/Canóvanas
Evander Ortiz|28|5-11 (180 cm)|PG/G|No
Tremont Waters|28|5-10 (178 cm)|PG|No
Isaac Sosa|36|6-3 (190 cm)|SG|No
Jaylen Nowell|26|6-4 (193 cm)|SG|Sí
Joshua/Josh Rivera|22|6-6 (198 cm)|G/SG|No
Jesús Cruz|28|6-5 (196 cm)|SF/SG|No
Adrián Ocasio|27|6-7 (201 cm)|SF|No
Chad Baker-Mazara|26|6-7 (201 cm)|GF/F|No
Tory San Antonio|24|6-5 (196 cm)|GF/SG|No
Chris Gastón|36|6-7 (201 cm)|PF/F|No
Timajh Parker-Rivera|32|6-8 (203 cm)|PF/F|No
Dyondre Domínguez|25|6-8 (203 cm)|PF|No
Alexander Franklin|37|6-6 (198 cm)|F/GF|No
Daniel Rivera|23|6-7 (201 cm)|F|No
Hunter Tyson|25|6-8 (203 cm)|F/SF|Sí
George Conditt IV|25|6-11 (211 cm)|C/PF|No
Kristian Doolittle|28|6-7 (201 cm)|SF/PF|Sí
Mets de Guaynabo
Javon Bennett|22|5-10 (178 cm)|PG/G|No
KJ Maura|30|5-8 (173 cm)|PG|No
Brandon Knight|34|6-2 (188 cm)|PG/G|Sí
Dante Treacy|25|6-0 (183 cm)|PG|No
Duran ‘DJ’ Alicea|23|6-2 (188 cm)|PG/G|No
Brandon Boyd|30|6-0 (183 cm)|G|No
Jaysean Paige|31|6-2 (188 cm)|G|No
William Martínez|33|6-1 (185 cm)|SG|No
Gianfranco/Pipo Grafals|25|6-5 (196 cm)|SG|No
Eric Ayala|27|6-6 (198 cm)|SG|No
Theo Pinson|30|6-6 (198 cm)|GF/SG|Sí
Gerardo Texeira|27|6-7 (201 cm)|PF/SF|No
Wilfredo Rodríguez|31|6-6 (198 cm)|PF/GF|No
Ryan Pearson|36|6-6 (198 cm)|PF|No
JJ Romer|26|6-9 (206 cm)|PF/C|No
Devin Williams|31|6-9 (206 cm)|PF|Sí
Ismael Romero|34|6-9 (206 cm)|C/F|No
Max Abmas|24|5-11 (180 cm)|G|Sí*
Indios de Mayagüez
Jonathan García|38|6-0 (183 cm)|PG/G|No
Nathan Sobey|35|6-3 (190 cm)|PG/G|Sí
Neftalí Álvarez|26|6-0 (183 cm)|PG|No
Yahir Cordero Meléndez|21|6-2 (188 cm)|PG/SG|No
Nick Lucena|21|6-2 (188 cm)|G|No
Tjader Fernández|32|5-10 (178 cm)|G/PG|No
Benito Santiago Jr.|36|6-6 (198 cm)|SG/F|No
José Placer|25|6-2 (188 cm)|SG/PG|No
Luis Henríquez|30|6-5 (196 cm)|SF/F|No
Miye Oni|28|6-5 (196 cm)|GF/SF|Sí
Bradley Camacho|22|6-7 (201 cm)|F|No
Josué Erazo|30|6-8 (203 cm)|F/C|No
Luis Cuascut|27|6-7 (201 cm)|PF/F|No
Sam Waardenburg|27|6-10 (208 cm)|PF/GF|Sí
Kevin Allen|31|6-11 (211 cm)|C|Sí*
Tyrell Harrison|26|7-0 (213 cm)|C|Sí
Piratas de Quebradillas
Gaby Belardo|36|6-2 (188 cm)|PG/G|No
Josh Vázquez|25|6-3 (190 cm)|PG|No
William Cruz|30|5-11 (180 cm)|PG|No
Jay S. Álvarez|24|6-5 (196 cm)|G|No
Emmanuel Mudiay|29|6-5 (196 cm)|G/SG|Sí
Anthony Cambo Jr.|26|6-3 (190 cm)|SG/G|No
Gian Clavell|32|6-4 (193 cm)|SG/G|No
Víctor Liz|39|6-0 (183 cm)|SG/PG|Sí*
Dimencio Vaughn|29|6-5 (196 cm)|GF/F|No
Carlos Emory|34|6-5 (196 cm)|F/SF|No
Jayden Martínez|26|6-7 (201 cm)|PF/F|No
Phillip Wheeler|23|6-8 (203 cm)|PF/F|No
Derek Reese|32|6-7 (201 cm)|PF/F|No
José Román|31|6-7 (201 cm)|PF/F|No
Ibrahim Sylla|30|6-8 (203 cm)|C/F|Sí
Kendall Munson|24|6-8 (203 cm)|F/C|Sí
Jameer Nelson Jr.|24|6-1 (185 cm)|G|Sí*
Zhaire Smith|26|6-4 (193 cm)|SG|Sí*
Capitanes de Arecibo
Diego González/Pellot|24|6-1 (185 cm)|PG/G|No
Malachi Smith|23|6-1 (185 cm)|PG|No
Derrick Walton Jr.|30|6-1 (185 cm)|PG|Sí
Rafael Pinzón|23|6-6 (198 cm)|G/PG|No
Jevin Muñiz|22|6-6 (198 cm)|G/F|No
Alfonso Plummer|28|6-1 (185 cm)|SG/G|No
Jonathan Zhao|22|6-4 (193 cm)|SG/G|No
Daniel Rosado|21|6-4 (193 cm)|SG/G|No
Fabián Rivera|24|6-4 (193 cm)|PG|No
Juan Pablo Piñeiro|35|6-4 (193 cm)|SG|No
Justin Reyes|30|6-4 (193 cm)|SG/GF|No
Geancarlo Peguero|21|6-5 (196 cm)|GF/F|No
Marvin Mantilla|20|6-7 (201 cm)|SF/F|No
Ramses Meléndez|23|6-7 (201 cm)|SF|No
Emmy Andújar|34|6-6 (198 cm)|F/SF|No
Jack McVeigh|29|6-8 (203 cm)|PF/F|Sí
Félix Rivera Jr.|29|6-9 (206 cm)|PF/F|No
Timothy Soares|29|6-11 (211 cm)|C|Sí
Matt López|33|7-0 (213 cm)|C|No
Thomas Robinson|34|6-10 (208 cm)|C/PF|Sí*
Leones de Ponce
Avry Holmes|32|6-2 (188 cm)|PG/G|Sí
Janpier Lezcano|20|6-2 (188 cm)|PG/G|No
Johned Walker|22|5-11 (180 cm)|PG/G|No
Jezreel De Jesús|34|6-1 (185 cm)|G/PG|No
Omar Figueroa|23|6-0 (183 cm)|G|No
Jared Ruiz|33|6-2 (188 cm)|SG/G|No
Kenneth Santos|27|6-1 (185 cm)|SG/G|No
Terence Davis II|28|6-4 (193 cm)|GF/SF|Sí
Alejandro Vázquez|25|6-4 (193 cm)|G/F|No
Bryan Powell|25|6-7 (201 cm)|SF/F|No
Aleem Ford|28|6-8 (203 cm)|F/SF|No
Jordan Murphy|29|6-7 (201 cm)|PF/SF|No
Christian Negrón|27|6-8 (203 cm)|C/PF|No
Jalen Crutcher|26|6-1 (185 cm)|PG/G|Sí*
Isaiah Hicks|31|6-8 (203 cm)|PF|Sí*
Atléticos de San Germán
Jorge L. Pacheco|27|5-11 (180 cm)|PG/SG|No
André Curbelo|24|6-0 (183 cm)|PG|No
Christian Pizarro|31|5-11 (180 cm)|PG|No
Alex Hamilton|32|6-4 (193 cm)|G|Sí
Kyle Rose|26|6-4 (193 cm)|G|No
Jorge Matos|33|6-3 (190 cm)|G|No
Rico Hopping|25|6-5 (196 cm)|SG|No
Braelee Albert|24|6-5 (196 cm)|SF/GF|No
Joseph Bull|28|6-5 (196 cm)|SF|No
Marlon Hargis|26|6-7 (201 cm)|F|No
Onzie Branch|34|6-6 (198 cm)|F/GF|No
Jorge Torres|25|6-5 (196 cm)|F/PF|No
Montrezl Harrell|32|6-7 (201 cm)|PF|Sí
Antonio Gordon|25|6-9 (206 cm)|PF|No
Chris Brady|30|6-10 (208 cm)|C|No
Julián Torres|28|6-9 (206 cm)|C/PF|No
Nick Perkins|29|6-8 (203 cm)|C/PF|Sí
Santeros de Aguada
Zakai Zeigler|23|5-9 (175 cm)|PG|No
Iván Gandía Rosa|28|6-1 (185 cm)|PG/G|No
Matthew Lee|26|6-0 (183 cm)|PG/G|No
Harold Pérez|22|6-4 (193 cm)|G|No
Robiel Morales|24|6-2 (188 cm)|G/F|No
Rigoberto Mendoza|33|6-3 (190 cm)|SG/G|Sí
Jase Febres|26|6-5 (196 cm)|SG/G|No
John Holland|37|6-5 (196 cm)|SF|No
Manny Camper|26|6-7 (201 cm)|GF|No
Miguel Martínez|24|6-4 (193 cm)|GF|No
Admiral Schofield|28|6-6 (198 cm)|F/SF|Sí
Leandro Allende|27|6-6 (198 cm)|F|No
Owen Pérez|33|6-8 (203 cm)|C/F|No
Arnaldo Toro|28|6-8 (203 cm)|C/FC|No
Giancarlo Rosado|24|6-8 (203 cm)|C/PF|No
John Brown III|34|6-8 (203 cm)|C/GF|Sí
Antonio Ralat|29|6-2 (188 cm)|G|No
Osos de Manatí
Alex Abreu|34|5-11 (180 cm)|PG/G|No
José Gines|26|6-1 (185 cm)|PG/G|No
Brayan Calderón|28|6-0 (183 cm)|PG|No
Ryan Arcidiacono|31|6-3 (190 cm)|PG/G|Sí
Giovanni Santiago|26|6-1 (185 cm)|G/PG|No
Tyquan Rolón|30|6-4 (193 cm)|G|No
Jhivvan Jackson|27|6-0 (183 cm)|G|No
Raymond Cintrón|36|6-0 (183 cm)|SG|No
Ismael Yomar Cruz|25|6-3 (190 cm)|SG|No
Jakair Sánchez|26|6-8 (203 cm)|SG/GF|No
Jonathan Rodríguez|38|6-5 (196 cm)|GF/F|No
Alex Morales|28|6-6 (198 cm)|GF/G|No
EJ Crawford|28|6-6 (198 cm)|GF/SF|No
Mike Bruesewitz|35|6-7 (201 cm)|F|No
Jamil Wilson|35|6-7 (201 cm)|F/SF|Sí
Christopher Ortiz|32|6-8 (203 cm)|F|No
Tyler Cook|28|6-8 (203 cm)|PF/C|Sí
José Guitián|39|6-10 (208 cm)|PF|No
Tyler Davis|28|6-10 (208 cm)|C|No
`;

const parseHeightInches = (heightText: string): number => {
  const match = heightText.match(/(\d+)-(\d+)/);
  if (!match) return 78;
  return Number(match[1]) * 12 + Number(match[2]);
};

const parseHeightCm = (heightText: string): number | undefined => {
  const match = heightText.match(/\((\d+)\s*cm\)/i);
  return match ? Number(match[1]) : undefined;
};

const mapPosition = (raw: string): { position: Position; secondaryPositions: Position[] } => {
  const tokens = raw.split('/').map((token) => token.trim()).filter(Boolean);
  const expand = (token: string): Position[] => {
    if (token === 'PG' || token === 'SG' || token === 'SF' || token === 'PF' || token === 'C') return [token];
    if (token === 'G') return ['SG'];
    if (token === 'GF') return ['SG', 'SF'];
    if (token === 'F') return ['SF', 'PF'];
    if (token === 'FC') return ['PF', 'C'];
    return ['SF'];
  };

  const expanded = tokens.flatMap(expand);
  const unique = [...new Set(expanded)] as Position[];
  return {
    position: unique[0] ?? 'SF',
    secondaryPositions: unique.slice(1)
  };
};

type ParsedPlayer = {
  teamId: string;
  displayName: string;
  age: number;
  heightText: string;
  positionText: string;
  refuerzo: string;
};

const inferTier = (entry: ParsedPlayer, position: Position, isImport: boolean): PlayerTier => {
  const veteranPenalty = entry.age >= 37 ? -2 : entry.age >= 34 ? -1 : 0;
  const importBoost = isImport ? 2 : 0;
  const primeBoost = entry.age <= 29 && entry.age >= 24 ? 1 : 0;
  const bigBoost = position === 'C' && isImport ? 1 : 0;
  const score = importBoost + primeBoost + bigBoost + veteranPenalty;

  if (score >= 4) return 'superstar';
  if (score >= 3) return 'star';
  if (score >= 2) return 'strong_starter';
  if (score >= 1) return 'starter';
  if (score >= 0) return 'rotation';
  if (score >= -1) return 'bench';
  return 'prospect';
};

const inferArchetype = (position: Position, secondaryPositions: Position[], isImport: boolean, age: number): PlayerArchetype => {
  if (position === 'PG') return isImport ? 'playmaker' : 'balanced_guard';
  if (position === 'SG') return age >= 33 ? 'movement_shooter' : 'shot_creator';
  if (position === 'SF') return isImport ? '3_and_d_wing' : 'versatile_forward';
  if (position === 'PF') return secondaryPositions.includes('C') ? 'rebounding_big' : 'stretch_big';
  if (position === 'C') return isImport ? 'rim_protector' : age <= 26 ? 'energy_big' : 'post_scorer';
  return 'versatile_forward';
};

const tendenciesByArchetype: Record<PlayerArchetype, PlayerTendencies> = {
  balanced_guard: { threePointTendency: 0.3, midRangeTendency: 0.15, driveTendency: 0.33, postUpTendency: 0.02, passTendency: 0.56, drawFoulTendency: 0.14, crashOffGlassTendency: 0.06 },
  playmaker: { threePointTendency: 0.28, midRangeTendency: 0.12, driveTendency: 0.36, postUpTendency: 0.02, passTendency: 0.62, drawFoulTendency: 0.16, crashOffGlassTendency: 0.05 },
  movement_shooter: { threePointTendency: 0.48, midRangeTendency: 0.17, driveTendency: 0.2, postUpTendency: 0.02, passTendency: 0.3, drawFoulTendency: 0.1, crashOffGlassTendency: 0.06 },
  shot_creator: { threePointTendency: 0.34, midRangeTendency: 0.2, driveTendency: 0.32, postUpTendency: 0.03, passTendency: 0.35, drawFoulTendency: 0.15, crashOffGlassTendency: 0.07 },
  slasher: { threePointTendency: 0.18, midRangeTendency: 0.13, driveTendency: 0.47, postUpTendency: 0.04, passTendency: 0.31, drawFoulTendency: 0.2, crashOffGlassTendency: 0.1 },
  '3_and_d_wing': { threePointTendency: 0.42, midRangeTendency: 0.12, driveTendency: 0.24, postUpTendency: 0.05, passTendency: 0.27, drawFoulTendency: 0.11, crashOffGlassTendency: 0.12 },
  versatile_forward: { threePointTendency: 0.29, midRangeTendency: 0.18, driveTendency: 0.27, postUpTendency: 0.11, passTendency: 0.29, drawFoulTendency: 0.12, crashOffGlassTendency: 0.14 },
  stretch_big: { threePointTendency: 0.34, midRangeTendency: 0.2, driveTendency: 0.17, postUpTendency: 0.16, passTendency: 0.24, drawFoulTendency: 0.12, crashOffGlassTendency: 0.17 },
  post_scorer: { threePointTendency: 0.08, midRangeTendency: 0.14, driveTendency: 0.14, postUpTendency: 0.38, passTendency: 0.2, drawFoulTendency: 0.17, crashOffGlassTendency: 0.24 },
  rim_protector: { threePointTendency: 0.06, midRangeTendency: 0.1, driveTendency: 0.16, postUpTendency: 0.32, passTendency: 0.19, drawFoulTendency: 0.16, crashOffGlassTendency: 0.26 },
  rebounding_big: { threePointTendency: 0.1, midRangeTendency: 0.14, driveTendency: 0.18, postUpTendency: 0.26, passTendency: 0.2, drawFoulTendency: 0.15, crashOffGlassTendency: 0.28 },
  energy_big: { threePointTendency: 0.09, midRangeTendency: 0.11, driveTendency: 0.22, postUpTendency: 0.2, passTendency: 0.18, drawFoulTendency: 0.16, crashOffGlassTendency: 0.3 }
};

const parsedPlayers: ParsedPlayer[] = [];
let currentTeamId = '';
for (const rawLine of rosterDocument.split('\n')) {
  const line = rawLine.trim();
  if (!line) continue;
  if (teamNameToId[line]) {
    currentTeamId = teamNameToId[line];
    continue;
  }

  const parts = line.split('|');
  if (parts.length !== 5 || !currentTeamId) continue;
  parsedPlayers.push({
    teamId: currentTeamId,
    displayName: parts[0].trim(),
    age: Number(parts[1]),
    heightText: parts[2].trim(),
    positionText: parts[3].trim(),
    refuerzo: parts[4].trim()
  });
}

const importCountByTeam: Record<string, number> = {};


const normalizeRatings = (ratings: Partial<PlayerRatings> & { speedWithBall?: number }, fallback: PlayerRatings): PlayerRatings => {
  const merged = { ...fallback, ...ratings } as PlayerRatings & { speedWithBall?: number };
  const clutch = merged.clutch ?? merged.offensiveIQ;
  const hustle = merged.hustle ?? Math.round((merged.stamina + merged.defensiveRebound + merged.defensiveIQ) / 3);
  return { ...merged, clutch: clamp(clutch), hustle: clamp(hustle) };
};

const splitName = (displayName: string): { firstName: string; lastName: string } => {
  const chunks = displayName.replace(/[‘’]/g, "'").split(' ').filter(Boolean);
  if (chunks.length === 1) return { firstName: chunks[0], lastName: chunks[0] };
  return { firstName: chunks[0], lastName: chunks.slice(1).join(' ') };
};

export const initialPlayers: Player[] = parsedPlayers.map((entry, index) => {
  const isImport = entry.refuerzo.startsWith('Sí');
  const importTag = entry.refuerzo.includes('*');
  const importIndex = isImport ? (importCountByTeam[entry.teamId] = (importCountByTeam[entry.teamId] ?? 0) + 1) : 0;
  const activeImport = isImport && importIndex <= 3;

  const { position, secondaryPositions } = mapPosition(entry.positionText);
  const { firstName, lastName } = splitName(entry.displayName);
  const profile = profiles[position];
  const tier = inferTier(entry, position, isImport);
  const archetype = inferArchetype(position, secondaryPositions, isImport, entry.age);

  const playerType = isImport ? 'import' : 'native';
  const notes: string[] = [];
  if (importTag) notes.push(`Refuerzo flag had suffix (*): ${entry.refuerzo}`);
  if (isImport && !activeImport) notes.push('Possible extra import beyond 3 active slots; marked reserve for review.');

  const playerId = `${entry.teamId}-${String(index + 1).padStart(3, '0')}`;
  const override = playerRatingOverrides[playerId] ?? playerRatingOverrides[entry.displayName];
  if (override?.ratingSource) notes.push(`Rating override source: ${override.ratingSource}`);
  if (override?.ratingConfidence) notes.push(`Rating override confidence: ${override.ratingConfidence}`);
  if (override?.ratingNotes?.length) notes.push(...override.ratingNotes);

  return {
    id: playerId,
    teamId: entry.teamId,
    name: entry.displayName,
    firstName,
    lastName,
    displayName: entry.displayName,
    birthdate: 'N/D',
    age: entry.age,
    nationality: isImport ? 'Import' : 'Puerto Rico',
    hometown: 'N/D',
    height: parseHeightInches(entry.heightText),
    heightCm: parseHeightCm(entry.heightText),
    weight: position === 'PG' ? 180 : position === 'SG' ? 195 : position === 'SF' ? 210 : position === 'PF' ? 228 : 245,
    position,
    secondaryPositions,
    shootingHand: 'right',
    jerseyNumber: (index % 99) + 1,
    college: 'N/D',
    previousTeam: 'N/D',
    yearsPro: Math.max(0, entry.age - 21),
    role: profile.role,
    tier,
    archetype,
    tendencies: override?.tendencies ?? tendenciesByArchetype[archetype],
    ratings: normalizeRatings((override?.ratings ?? {}) as Partial<PlayerRatings> & { speedWithBall?: number }, buildRatings(position, tier, archetype, entry.age, isImport)),
    minutesTarget: profile.minutesTarget,
    playerType,
    contractStatus: 'active',
    rosterStatus: isImport && !activeImport ? 'reserve' : 'active',
    importSlot: activeImport ? (importIndex as 1 | 2 | 3) : undefined,
    isImport,
    importChangeCount: 0,
    injurySalaryReliefEligible: false,
    technicalFoulCount: 0,
    originalPositionText: entry.positionText,
    sourceNote: SOURCE_NOTE,
    notes: notes.length > 0 ? notes : undefined
  };
});
