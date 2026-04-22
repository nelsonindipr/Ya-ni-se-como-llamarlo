import { useMemo, useState } from 'react';
import './styles.css';
import { BoxScoreTable } from './components/BoxScoreTable';
import { MatchupSelector } from './components/MatchupSelector';
import { StandingsTable } from './components/StandingsTable';
import { initialPlayers } from './data/players';
import { initialTeams } from './data/teams';
import { leagueRules } from './domain/rules';
import type { GameResult, Team } from './domain/types';
import { simulateGame } from './simulation/engine';
import { applyGameToStandings, toStandingRows } from './simulation/standings';

function App() {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [homeId, setHomeId] = useState(initialTeams[0].id);
  const [awayId, setAwayId] = useState(initialTeams[6].id);
  const [game, setGame] = useState<GameResult | null>(null);
  const [showOverall, setShowOverall] = useState(false);

  const standings = useMemo(() => toStandingRows(teams), [teams]);

  const onSimulate = () => {
    const home = teams.find((t) => t.id === homeId);
    const away = teams.find((t) => t.id === awayId);
    if (!home || !away || home.id === away.id) return;

    const result = simulateGame(home, away, initialPlayers);
    setGame(result);
    setTeams((prev) => applyGameToStandings(prev, result));
  };

  return (
    <main>
      <h1>BSN 2026 Manager — v0.1 MVP</h1>
      <p>
        {leagueRules.quarters} x {leagueRules.quarterLengthMinutes}-minute quarters ({leagueRules.gameLengthMinutes}-minute FIBA game)
      </p>

      <MatchupSelector
        teams={teams}
        homeId={homeId}
        awayId={awayId}
        onHomeChange={setHomeId}
        onAwayChange={setAwayId}
      />

      <button disabled={homeId === awayId} onClick={onSimulate} type="button">
        Simulate Game
      </button>

      {game ? (
        <section>
          <h2>
            Final: {game.away.teamName} {game.away.score} - {game.home.score} {game.home.teamName}
          </h2>
          <div className="grid">
            <BoxScoreTable box={game.away} />
            <BoxScoreTable box={game.home} />
          </div>
        </section>
      ) : null}

      <section>
        <h2>Standings</h2>
        <button onClick={() => setShowOverall((s) => !s)} type="button">
          {showOverall ? 'Hide Overall Standings' : 'Show Overall Standings'}
        </button>
        <div className="grid">
          <StandingsTable title="Conference A" rows={standings} conference="A" />
          <StandingsTable title="Conference B" rows={standings} conference="B" />
        </div>
        {showOverall ? <StandingsTable title="Overall" rows={standings} /> : null}
      </section>
    </main>
  );
}

export default App;
