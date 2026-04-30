import type { Player, Team } from './types';

const MIN_RATING = 25;
const MAX_RATING = 99;
const REQUIRED_PLAYER_RATINGS = [
  'closeShot', 'drivingLayup', 'drivingDunk', 'standingDunk', 'postControl', 'midRange', 'threePoint', 'freeThrow', 'drawFoul',
  'shotCreation', 'offBallMovement', 'passAccuracy', 'ballHandle', 'interiorDefense', 'perimeterDefense', 'steal', 'block',
  'offensiveRebound', 'defensiveRebound', 'speed', 'acceleration', 'strength', 'vertical', 'stamina', 'offensiveIQ', 'defensiveIQ', 'clutch', 'hustle'
] as const;

const isNonEmpty = (value: string): boolean => value.trim().length > 0;

const isValidRating = (value: number): boolean => Number.isFinite(value) && value >= MIN_RATING && value <= MAX_RATING;
const isValidTendency = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;

export type PlayerValidationResult = {
  valid: boolean;
  errors: string[];
};

export const validatePlayer = (player: Player, validTeamIds: Set<string>): PlayerValidationResult => {
  const errors: string[] = [];

  if (!isNonEmpty(player.firstName) || !isNonEmpty(player.lastName) || !isNonEmpty(player.displayName)) {
    errors.push(`Player ${player.id} is missing required name bio fields.`);
  }
  if (!isNonEmpty(player.birthdate) || !isNonEmpty(player.nationality) || !isNonEmpty(player.hometown)) {
    errors.push(`Player ${player.id} is missing birthdate/nationality/hometown.`);
  }
  if (!isNonEmpty(player.college) || !isNonEmpty(player.previousTeam)) {
    errors.push(`Player ${player.id} is missing college/previousTeam.`);
  }

  if (!validTeamIds.has(player.teamId)) {
    errors.push(`Player ${player.id} has invalid teamId ${player.teamId}.`);
  }

  if (!Number.isInteger(player.jerseyNumber) || player.jerseyNumber < 0 || player.jerseyNumber > 99) {
    errors.push(`Player ${player.id} has invalid jersey number ${player.jerseyNumber}.`);
  }

  if (!Number.isFinite(player.height) || player.height < 60 || player.height > 96) {
    errors.push(`Player ${player.id} has invalid height ${player.height}.`);
  }
  if (!Number.isFinite(player.weight) || player.weight < 120 || player.weight > 400) {
    errors.push(`Player ${player.id} has invalid weight ${player.weight}.`);
  }

  if (player.secondaryPositions.includes(player.position)) {
    errors.push(`Player ${player.id} secondary positions should not duplicate primary position.`);
  }

  if (!Number.isInteger(player.age) || player.age < 16 || player.age > 55) {
    errors.push(`Player ${player.id} has invalid age ${player.age}.`);
  }

  for (const [ratingName, ratingValue] of Object.entries(player.ratings)) {
    if (!isValidRating(ratingValue)) {
      errors.push(`Player ${player.id} rating ${ratingName} is out of range (${ratingValue}).`);
    }
  }

  for (const requiredRating of REQUIRED_PLAYER_RATINGS) {
    if (!(requiredRating in player.ratings)) {
      errors.push(`Player ${player.id} is missing required rating ${requiredRating}.`);
    }
  }

  for (const [tendencyName, tendencyValue] of Object.entries(player.tendencies)) {
    if (!isValidTendency(tendencyValue)) {
      errors.push(`Player ${player.id} tendency ${tendencyName} is out of range (${tendencyValue}).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

export const validatePlayers = (players: Player[], teams: Team[], maxImportsPerTeam = 3): PlayerValidationResult => {
  const errors: string[] = [];
  const validTeamIds = new Set(teams.map((team) => team.id));
  const importsByTeam: Record<string, number> = {};

  for (const player of players) {
    const result = validatePlayer(player, validTeamIds);
    errors.push(...result.errors);

    if ((player.isImport || player.playerType === 'import') && player.rosterStatus !== 'reserve') {
      importsByTeam[player.teamId] = (importsByTeam[player.teamId] ?? 0) + 1;
    }
  }

  for (const [teamId, importCount] of Object.entries(importsByTeam)) {
    if (importCount > maxImportsPerTeam) {
      errors.push(`Team ${teamId} has ${importCount} imports, max is ${maxImportsPerTeam}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
