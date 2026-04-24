import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamPage } from '../src/components/TeamPage';
import { PlayerProfile } from '../src/components/PlayerProfile';
import { initialPlayers } from '../src/data/players';
import { initialTeams } from '../src/data/teams';
import { createEmptySeasonStats } from '../src/simulation/stats';
import { generateRegularSeasonSchedule } from '../src/simulation/schedule';
import { createNewGameState } from '../src/state/gameState';

const team = initialTeams[0];
const roster = initialPlayers.filter((player) => player.teamId === team.id);
const stats = createEmptySeasonStats(initialPlayers, initialTeams);
const schedule = generateRegularSeasonSchedule(initialTeams, 2026).filter(
  (game) => game.homeTeamId === team.id || game.awayTeamId === team.id
);
const teamNameById = new Map(initialTeams.map((entry) => [entry.id, entry.name]));
const state = createNewGameState(2026);

describe('team and player pages', () => {
  it('team page renders roster', () => {
    const html = renderToStaticMarkup(
      <TeamPage
        team={team}
        roster={roster}
        runtimePlayers={state.runtimePlayers}
        regularStats={stats.regularTeamStats[team.id]}
        playoffStats={stats.playoffTeamStats[team.id]}
        schedule={schedule}
        teamNameById={teamNameById}
        validationErrors={[]}
        onPlayerClick={() => {}}
        onStarterToggle={() => {}}
        onAvailabilityChange={() => {}}
        onMinutesChange={() => {}}
        onAutoRotation={() => {}}
        onBack={() => {}}
      />
    );

    expect(html).toContain('GM Roster Management');
    expect(html).toContain('Target Min');
    expect(html).toContain(roster[0].name);
  });

  it('player profile renders bio and attributes', () => {
    const player = roster[0];
    const html = renderToStaticMarkup(
      <PlayerProfile
        player={player}
        teamName={team.name}
        regularStats={stats.regularPlayerStats[player.id]}
        playoffStats={stats.playoffPlayerStats[player.id]}
        gameLogs={stats.playerGameLogs[player.id]}
        teamNameById={teamNameById}
        onBack={() => {}}
      />
    );

    expect(html).toContain('Bio');
    expect(html).toContain('Attributes by Category');
    expect(html).toContain('BSN Status');
  });

  it('native/import status displays correctly', () => {
    const html = renderToStaticMarkup(
      <TeamPage
        team={team}
        roster={roster}
        runtimePlayers={state.runtimePlayers}
        regularStats={stats.regularTeamStats[team.id]}
        playoffStats={stats.playoffTeamStats[team.id]}
        schedule={schedule}
        teamNameById={teamNameById}
        validationErrors={[]}
        onPlayerClick={() => {}}
        onStarterToggle={() => {}}
        onAvailabilityChange={() => {}}
        onMinutesChange={() => {}}
        onAutoRotation={() => {}}
        onBack={() => {}}
      />
    );

    expect(html).toContain('import');
    expect(html).toContain('native');
  });
});
