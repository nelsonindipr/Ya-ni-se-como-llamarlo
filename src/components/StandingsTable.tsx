import type { Conference, StandingRow } from '../domain/types';

type Props = {
  title: string;
  rows: StandingRow[];
  conference?: Conference;
};

export const StandingsTable = ({ title, rows, conference }: Props) => {
  const filtered = conference ? rows.filter((r) => r.conference === conference) : rows;

  return (
    <section>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Team</th>
            <th>W</th>
            <th>L</th>
            <th>PCT</th>
            <th>PF</th>
            <th>PA</th>
            <th>DIFF</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.wins}</td>
              <td>{row.losses}</td>
              <td>{row.winPct.toFixed(3)}</td>
              <td>{row.pointsFor}</td>
              <td>{row.pointsAgainst}</td>
              <td>{row.pointDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
