import type { AvailabilityStatus, Player, ScheduledGame, Team } from '../domain/types';
import type { RuntimePlayerState } from '../state/gameState';
import type { TeamSeasonStats } from '../simulation/stats';
import { pct } from '../simulation/stats';

type Props = {
  team: Team;
  roster: Player[];
  runtimePlayers: Record<string, RuntimePlayerState>;
  regularStats?: TeamSeasonStats;
  playoffStats?: TeamSeasonStats;
  schedule: ScheduledGame[];
  teamNameById: Map<string, string>;
  validationErrors: string[];
  onPlayerClick: (playerId: string) => void;
  onStarterToggle: (playerId: string, starter: boolean) => void;
  onAvailabilityChange: (playerId: string, status: AvailabilityStatus) => void;
  onMinutesChange: (playerId: string, minutes: number | null) => void;
  onAutoRotation: () => void;
  onBack: () => void;
};

const statusLabel = (runtime: RuntimePlayerState): string => {
  if (runtime.injury) return `injured (${runtime.injury.gamesRemaining})`;
  return runtime.availability;
};

export const TeamPage = ({
  team,
  roster,
  runtimePlayers,
  regularStats,
  playoffStats,
  schedule,
  teamNameById,
  validationErrors,
  onPlayerClick,
  onStarterToggle,
  onAvailabilityChange,
  onMinutesChange,
  onAutoRotation,
  onBack
}: Props) => {
  const formatHeight = (heightInches: number): string => {
    const feet = Math.floor(heightInches / 12);
    const inches = heightInches % 12;
    return `${feet}'${inches}"`;
  };

  const rosterRows = [...roster].sort((a, b) => {
    const aRt = runtimePlayers[a.id];
    const bRt = runtimePlayers[b.id];
    return (aRt?.rotationOrder ?? 99) - (bRt?.rotationOrder ?? 99) || b.minutesTarget - a.minutesTarget;
  });

  return (
    <section>
      <button type="button" onClick={onBack}>Back to League View</button>
      <h2>{team.name}</h2>
      <p>
        <strong>City:</strong> {team.city} | <strong>Conference:</strong> {team.conference} | <strong>Arena:</strong> {team.arena} |{' '}
        <strong>Record:</strong> {team.wins}-{team.losses}
      </p>

      <h3>GM Roster Management</h3>
      <button type="button" onClick={onAutoRotation}>Auto Rotation</button>
      {validationErrors.length > 0 ? (
        <ul>
          {validationErrors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Age</th>
            <th>Status</th>
            <th>Starter</th>
            <th>Target Min</th>
            <th>Fatigue</th>
            <th>Injury</th>
            <th>Salary</th>
            <th>Yrs</th>
            <th>Import</th>
            <th>Ratings</th>
            <th>Season</th>
          </tr>
        </thead>
        <tbody>
          {rosterRows.map((player) => {
            const runtime = runtimePlayers[player.id];
            if (!runtime) return null;
            return (
              <tr key={player.id}>
                <td>{player.jerseyNumber}</td>
                <td>
                  <button type="button" onClick={() => onPlayerClick(player.id)}>{player.name}</button>
                </td>
                <td>{player.position}</td>
                <td>{player.age}</td>
                <td>
                  <select
                    value={runtime.injury ? 'injured' : runtime.availability}
                    onChange={(e) => onAvailabilityChange(player.id, e.target.value as AvailabilityStatus)}
                    disabled={Boolean(runtime.injury)}
                  >
                    <option value="active">active</option>
                    <option value="reserve">reserve</option>
                    <option value="inactive">inactive</option>
                    <option value="injured">injured</option>
                  </select>
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={runtime.starter}
                    disabled={runtime.availability !== 'active' || Boolean(runtime.injury)}
                    onChange={(e) => onStarterToggle(player.id, e.target.checked)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={runtime.minutesOverride ?? player.minutesTarget}
                    onChange={(e) => onMinutesChange(player.id, Number(e.target.value))}
                  />
                </td>
                <td>{runtime.fatigue.toFixed(1)}</td>
                <td>{runtime.injury ? `${runtime.injury.type} (${runtime.injury.gamesRemaining})` : 'healthy'}</td>
                <td>${Math.round(runtime.salary).toLocaleString()}</td>
                <td>{runtime.contractYearsRemaining}</td>
                <td>{player.isImport ? 'import' : 'native'}</td>
                <td>O:{player.ratings.offensiveIQ} D:{player.ratings.defensiveIQ} 3:{player.ratings.threePoint}</td>
                <td>{formatHeight(player.height)} / {player.weight}lbs / {statusLabel(runtime)}</td>
              </tr>
            );
          })}
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
                  <td>Regular</td><td>{regularStats.gamesPlayed}</td><td>{regularStats.wins}-{regularStats.losses}</td><td>{regularStats.pointsFor}</td><td>{regularStats.pointsAgainst}</td><td>{regularStats.rebounds}</td><td>{regularStats.assists}</td><td>{(pct(regularStats.fgm, regularStats.fga) * 100).toFixed(1)}%</td><td>{(pct(regularStats.tpm, regularStats.tpa) * 100).toFixed(1)}%</td><td>{(pct(regularStats.ftm, regularStats.fta) * 100).toFixed(1)}%</td>
                </tr>
              ) : null}
              {playoffStats ? (
                <tr>
                  <td>Playoffs</td><td>{playoffStats.gamesPlayed}</td><td>{playoffStats.wins}-{playoffStats.losses}</td><td>{playoffStats.pointsFor}</td><td>{playoffStats.pointsAgainst}</td><td>{playoffStats.rebounds}</td><td>{playoffStats.assists}</td><td>{(pct(playoffStats.fgm, playoffStats.fga) * 100).toFixed(1)}%</td><td>{(pct(playoffStats.tpm, playoffStats.tpa) * 100).toFixed(1)}%</td><td>{(pct(playoffStats.ftm, playoffStats.fta) * 100).toFixed(1)}%</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </>
      ) : null}

      <h3>Schedule / Results</h3>
      {schedule.length > 0 ? (
        <table><thead><tr><th>#</th><th>Opponent</th><th>Venue</th><th>Status</th></tr></thead><tbody>
          {schedule.map((game) => {
            const isHome = game.homeTeamId === team.id;
            const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
            return <tr key={game.id}><td>{game.gameNumber}</td><td>{teamNameById.get(opponentId) ?? opponentId}</td><td>{isHome ? 'Home' : 'Away'}</td><td>{game.played ? `${game.awayScore} - ${game.homeScore}` : 'Unplayed'}</td></tr>;
          })}
        </tbody></table>
      ) : <p>No schedule/results available.</p>}
    </section>
  );
};
