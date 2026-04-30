import type { Player } from '../domain/types';
import type { PlayerGameLog, PlayerSeasonStats } from '../simulation/stats';
import { pct } from '../simulation/stats';

type Props = {
  player: Player;
  teamName: string;
  regularStats?: PlayerSeasonStats;
  playoffStats?: PlayerSeasonStats;
  gameLogs: PlayerGameLog[];
  teamNameById: Map<string, string>;
  onBack: () => void;
};

const safePerGame = (total: number, gp: number): string => (gp > 0 ? (total / gp).toFixed(1) : '0.0');

export const PlayerProfile = ({ player, teamName, regularStats, playoffStats, gameLogs, teamNameById, onBack }: Props) => {
  const groupedRatings: Array<{ title: string; rows: Array<[string, number]> }> = [
    {
      title: 'Scoring',
      rows: [
        ['Close Shot', player.ratings.closeShot],
        ['Driving Layup', player.ratings.drivingLayup],
        ['Driving Dunk', player.ratings.drivingDunk],
        ['Standing Dunk', player.ratings.standingDunk],
        ['Post Control', player.ratings.postControl],
        ['Mid-Range', player.ratings.midRange],
        ['Three-Point', player.ratings.threePoint],
        ['Free Throw', player.ratings.freeThrow]
      ]
    },
    {
      title: 'Playmaking',
      rows: [
        ['Shot Creation', player.ratings.shotCreation],
        ['Off-Ball Movement', player.ratings.offBallMovement],
        ['Pass Accuracy', player.ratings.passAccuracy],
        ['Ball Handle', player.ratings.ballHandle],
        ['Clutch', player.ratings.clutch],
        ['Hustle', player.ratings.hustle]
      ]
    },
    {
      title: 'Defense & Rebounding',
      rows: [
        ['Interior Defense', player.ratings.interiorDefense],
        ['Perimeter Defense', player.ratings.perimeterDefense],
        ['Steal', player.ratings.steal],
        ['Block', player.ratings.block],
        ['Offensive Rebound', player.ratings.offensiveRebound],
        ['Defensive Rebound', player.ratings.defensiveRebound]
      ]
    },
    {
      title: 'Athleticism & IQ',
      rows: [
        ['Speed', player.ratings.speed],
        ['Acceleration', player.ratings.acceleration],
        ['Strength', player.ratings.strength],
        ['Vertical', player.ratings.vertical],
        ['Stamina', player.ratings.stamina],
        ['Offensive IQ', player.ratings.offensiveIQ],
        ['Defensive IQ', player.ratings.defensiveIQ]
      ]
    }
  ];

  const statRows: Array<{ stage: string; stat?: PlayerSeasonStats }> = [
    { stage: 'Regular', stat: regularStats },
    { stage: 'Playoffs', stat: playoffStats }
  ];

  return (
    <section>
      <button type="button" onClick={onBack}>Back</button>
      <h2>{player.displayName} Profile</h2>

      <h3>Bio</h3>
      <p>
        <strong>Team:</strong> {teamName} | <strong>Position:</strong> {player.position} ({player.secondaryPositions.join(', ')}) | <strong>Age:</strong> {player.age} |
        <strong> Birthdate:</strong> {player.birthdate} | <strong>Height:</strong> {Math.floor(player.height / 12)}'{player.height % 12}" | <strong>Weight:</strong> {player.weight} lbs |
        <strong> Nationality:</strong> {player.nationality} | <strong>Hometown:</strong> {player.hometown} | <strong>College:</strong> {player.college} |
        <strong> Previous Team:</strong> {player.previousTeam} | <strong>Years Pro:</strong> {player.yearsPro} | <strong>Shoots:</strong> {player.shootingHand}
      </p>

      <h3>BSN Status</h3>
      <ul>
        <li>Player Type: {player.playerType}</li>
        <li>Is Import: {player.isImport ? 'yes' : 'no'}</li>
        <li>Import Slot: {player.importSlot ?? 'N/A'}</li>
        <li>Rights Team: {player.rightsTeamId ?? 'N/A'}</li>
        <li>Contract Status: {player.contractStatus ?? 'N/A'}</li>
        <li>Roster Status: {player.rosterStatus ?? 'N/A'}</li>
        <li>Import Changes Used: {player.importChangeCount}</li>
        <li>Injury Salary Relief Eligible: {player.injurySalaryReliefEligible ? 'yes' : 'no'}</li>
        <li>Technical Fouls: {player.technicalFoulCount}</li>
        <li>Salary: {player.salary ? `$${player.salary.toLocaleString()}` : 'N/A'}</li>
      </ul>

      <h3>Attributes by Category</h3>
      <div className="grid">
        {groupedRatings.map((group) => (
          <div key={group.title}>
            <h4>{group.title}</h4>
            <table>
              <tbody>
                {group.rows.map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <h3>Tendencies</h3>
      <table>
        <tbody>
          {Object.entries(player.tendencies).map(([label, value]) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{(value * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Season Stats</h3>
      <table>
        <thead>
          <tr>
            <th>Stage</th>
            <th>GP</th>
            <th>PPG</th>
            <th>RPG</th>
            <th>APG</th>
            <th>FG%</th>
            <th>3P%</th>
            <th>FT%</th>
          </tr>
        </thead>
        <tbody>
          {statRows.map(({ stage, stat }) => {
            const gp = stat?.gamesPlayed ?? 0;
            return (
              <tr key={stage}>
                <td>{stage}</td>
                <td>{gp}</td>
                <td>{safePerGame(stat?.points ?? 0, gp)}</td>
                <td>{safePerGame(stat?.rebounds ?? 0, gp)}</td>
                <td>{safePerGame(stat?.assists ?? 0, gp)}</td>
                <td>{((pct(stat?.fgm ?? 0, stat?.fga ?? 0) || 0) * 100).toFixed(1)}%</td>
                <td>{((pct(stat?.tpm ?? 0, stat?.tpa ?? 0) || 0) * 100).toFixed(1)}%</td>
                <td>{((pct(stat?.ftm ?? 0, stat?.fta ?? 0) || 0) * 100).toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h3>Game Log</h3>
      {gameLogs.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Opponent</th>
              <th>MIN</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>Shooting</th>
            </tr>
          </thead>
          <tbody>
            {gameLogs.map((log) => (
              <tr key={`${log.gameId}-${log.stage}`}>
                <td>{log.stage}</td>
                <td>{teamNameById.get(log.opponentTeamId) ?? log.opponentTeamId}</td>
                <td>{log.minutes.toFixed(1)}</td>
                <td>{log.points}</td>
                <td>{log.rebounds}</td>
                <td>{log.assists}</td>
                <td>{log.fgm}/{log.fga} FG, {log.tpm}/{log.tpa} 3P, {log.ftm}/{log.fta} FT</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>No game log available.</p>
      )}
    </section>
  );
};
