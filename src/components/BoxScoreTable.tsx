import type { TeamGameBox } from '../domain/types';

type Props = {
  box: TeamGameBox;
};

export const BoxScoreTable = ({ box }: Props) => (
  <section>
    <h3>
      {box.teamName} — {box.score}
    </h3>
    <p>Q1 {box.byQuarter[0]} | Q2 {box.byQuarter[1]} | Q3 {box.byQuarter[2]} | Q4 {box.byQuarter[3]}</p>
    <table>
      <thead>
        <tr>
          <th>Player</th>
          <th>MIN</th>
          <th>PTS</th>
          <th>REB</th>
          <th>AST</th>
          <th>FG</th>
          <th>3P</th>
          <th>FT</th>
          <th>TOV</th>
        </tr>
      </thead>
      <tbody>
        {box.players.map((p) => (
          <tr key={p.playerId}>
            <td>{p.playerName}</td>
            <td>{p.minutes}</td>
            <td>{p.points}</td>
            <td>{p.rebounds}</td>
            <td>{p.assists}</td>
            <td>
              {p.fgm}/{p.fga}
            </td>
            <td>
              {p.tpm}/{p.tpa}
            </td>
            <td>
              {p.ftm}/{p.fta}
            </td>
            <td>{p.turnovers}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
