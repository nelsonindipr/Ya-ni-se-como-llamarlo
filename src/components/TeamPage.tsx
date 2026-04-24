import type { Player, ScheduledGame, Team } from '../domain/types';
import type { TeamSeasonStats } from '../simulation/stats';
import { pct } from '../simulation/stats';

type Props = {
  team: Team;
  roster: Player[];
  regularStats?: TeamSeasonStats;
  playoffStats?: TeamSeasonStats;
  schedule: ScheduledGame[];
  teamNameById: Map<string, string>;
  onPlayerClick: (playerId: string) => void;
  onBack: () => void;
};

export const TeamPage = ({
  team,
  roster,
  regularStats,
  playoffStats,
  schedule,
  teamNameById,
  onPlayerClick,
  onBack
}: Props) => {
  const formatHeight = (heightInches: number): string => {
    const feet = Math.floor(heightInches / 12);
    const inches = heightInches % 12;
    return `${feet}'${inches}"`;
  };

  return (
    <section>
      <button type="button" onClick={onBack}>Back to League View</button>
      <h2>{team.name}</h2>
      <p>
        <strong>City:</strong> {team.city} | <strong>Conference:</strong> {team.conference} | <strong>Arena:</strong> {team.arena} |{' '}
        <strong>Record:</strong> {team.wins}-{team.losses}
      </p>

      <h3>Roster</h3>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Secondary</th>
            <th>Age</th>
            <th>Height</th>
            <th>Weight</th>
            <th>Nationality</th>
            <th>Type</th>
            <th>Role</th>
            <th>Salary</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((player) => (
            <tr key={player.id}>
              <td>{player.jerseyNumber}</td>
              <td>
                <button type="button" onClick={() => onPlayerClick(player.id)}>
                  {player.name}
                </button>
              </td>
              <td>{player.position}</td>
              <td>{player.secondaryPositions.join(', ')}</td>
              <td>{player.age}</td>
              <td>{formatHeight(player.height)}</td>
              <td>{player.weight} lbs</td>
              <td>{player.nationality}</td>
              <td>{player.playerType}</td>
              <td>{player.role}</td>
              <td>{player.salary ? `$${player.salary.toLocaleString()}` : 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {(regularStats || playoffStats) ? (
        <>
          <h3>Team Stats</h3>
          <table>
            <thead>
              <tr>
                <th>Stage</th>
                <th>GP</th>
                <th>W-L</th>
                <th>PF</th>
                <th>PA</th>
                <th>REB</th>
                <th>AST</th>
                <th>FG%</th>
                <th>3P%</th>
                <th>FT%</th>
              </tr>
            </thead>
            <tbody>
              {regularStats ? (
                <tr>
                  <td>Regular</td>
                  <td>{regularStats.gamesPlayed}</td>
                  <td>{regularStats.wins}-{regularStats.losses}</td>
                  <td>{regularStats.pointsFor}</td>
                  <td>{regularStats.pointsAgainst}</td>
                  <td>{regularStats.rebounds}</td>
                  <td>{regularStats.assists}</td>
                  <td>{(pct(regularStats.fgm, regularStats.fga) * 100).toFixed(1)}%</td>
                  <td>{(pct(regularStats.tpm, regularStats.tpa) * 100).toFixed(1)}%</td>
                  <td>{(pct(regularStats.ftm, regularStats.fta) * 100).toFixed(1)}%</td>
                </tr>
              ) : null}
              {playoffStats ? (
                <tr>
                  <td>Playoffs</td>
                  <td>{playoffStats.gamesPlayed}</td>
                  <td>{playoffStats.wins}-{playoffStats.losses}</td>
                  <td>{playoffStats.pointsFor}</td>
                  <td>{playoffStats.pointsAgainst}</td>
                  <td>{playoffStats.rebounds}</td>
                  <td>{playoffStats.assists}</td>
                  <td>{(pct(playoffStats.fgm, playoffStats.fga) * 100).toFixed(1)}%</td>
                  <td>{(pct(playoffStats.tpm, playoffStats.tpa) * 100).toFixed(1)}%</td>
                  <td>{(pct(playoffStats.ftm, playoffStats.fta) * 100).toFixed(1)}%</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      ) : null}

      <h3>Schedule / Results</h3>
      {schedule.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Opponent</th>
              <th>Venue</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((game) => {
              const isHome = game.homeTeamId === team.id;
              const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
              return (
                <tr key={game.id}>
                  <td>{game.gameNumber}</td>
                  <td>{teamNameById.get(opponentId) ?? opponentId}</td>
                  <td>{isHome ? 'Home' : 'Away'}</td>
                  <td>{game.played ? `${game.awayScore} - ${game.homeScore}` : 'Unplayed'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p>No schedule/results available.</p>
      )}
    </section>
  );
};
