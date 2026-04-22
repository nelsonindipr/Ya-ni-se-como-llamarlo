import type { Team } from '../domain/types';

type Props = {
  teams: Team[];
  homeId: string;
  awayId: string;
  onHomeChange: (value: string) => void;
  onAwayChange: (value: string) => void;
};

export const MatchupSelector = ({ teams, homeId, awayId, onHomeChange, onAwayChange }: Props) => (
  <section>
    <h2>Matchup Selector</h2>
    <div className="selectors">
      <label>
        Home
        <select value={homeId} onChange={(e) => onHomeChange(e.target.value)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Away
        <select value={awayId} onChange={(e) => onAwayChange(e.target.value)}>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  </section>
);
