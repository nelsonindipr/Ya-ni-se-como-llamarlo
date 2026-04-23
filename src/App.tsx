import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { BoxScoreTable } from './components/BoxScoreTable';
import { StandingsTable } from './components/StandingsTable';
import { initialPlayers } from './data/players';
import { initialTeams } from './data/teams';
import { leagueRules } from './domain/rules';
import type { GameResult, ScheduledGame, Team } from './domain/types';
import { simulateGame } from './simulation/engine';
import { generateRegularSeasonSchedule } from './simulation/schedule';
import { applyGameToStandings, toStandingRows } from './simulation/standings';
import { clearSeasonState, loadSeasonState, saveSeasonState } from './utils/storage';

const initialSeed = 2026;

const resetTeams = (): Team[] =>
  initialTeams.map((team) => ({ ...team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

const initialSeed = 2026;

const resetTeams = (): Team[] => initialTeams.map((team) => ({ ...team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

function App() {
  const [teams, setTeams] = useState<Team[]>(resetTeams);
  const [game, setGame] = useState<GameResult | null>(null);
  const [showOverall, setShowOverall] = useState(false);
  const [scheduleSeed, setScheduleSeed] = useState(initialSeed);
  const [schedule, setSchedule] = useState<ScheduledGame[]>(() =>
    generateRegularSeasonSchedule(initialTeams, initialSeed)
  );
  const [statusMessage, setStatusMessage] = useState('');
  const [schedule, setSchedule] = useState<ScheduledGame[]>(() => generateRegularSeasonSchedule(initialTeams, initialSeed));

  const standings = useMemo(() => toStandingRows(teams), [teams]);
  const teamNameById = useMemo(() => new Map(initialTeams.map((t) => [t.id, t.name])), []);

  const persistState = (
    nextSeed: number,
    nextSchedule: ScheduledGame[],
    nextTeams: Team[],
    nextGame: GameResult | null,
    nextShowOverall: boolean
  ): void => {
    saveSeasonState({
      version: 1,
      scheduleSeed: nextSeed,
      schedule: nextSchedule,
      teams: nextTeams,
      game: nextGame,
      showOverall: nextShowOverall
    });
  };

  useEffect(() => {
    const loaded = loadSeasonState();
    if (!loaded) return;
    setScheduleSeed(loaded.scheduleSeed);
    setSchedule(loaded.schedule);
    setTeams(loaded.teams);
    setGame(loaded.game);
    setShowOverall(loaded.showOverall);
    setStatusMessage('Loaded saved season from local storage.');
  }, []);

  const playScheduledGame = (scheduledGame: ScheduledGame): void => {
    if (scheduledGame.played) return;
    const home = teams.find((t) => t.id === scheduledGame.homeTeamId);
    const away = teams.find((t) => t.id === scheduledGame.awayTeamId);
    if (!home || !away) return;

    const result = simulateGame(home, away, initialPlayers, scheduleSeed * 10_000 + scheduledGame.gameNumber);
    const nextTeams = applyGameToStandings(teams, result);
    const nextSchedule = schedule.map((g) =>
      g.id === scheduledGame.id
        ? {
            ...g,
            played: true,
            resultId: result.id,
            homeScore: result.home.score,
            awayScore: result.away.score
          }
        : g
    );

    setGame(result);
    setTeams(nextTeams);
    setSchedule(nextSchedule);
    persistState(scheduleSeed, nextSchedule, nextTeams, result, showOverall);
    setStatusMessage(`Game #${scheduledGame.gameNumber} simulated and season auto-saved.`);
  };

  const generateSchedule = (seed: number): void => {
    const nextSchedule = generateRegularSeasonSchedule(initialTeams, seed);
    const nextTeams = resetTeams();

    setScheduleSeed(seed);
    setSchedule(nextSchedule);
    setTeams(nextTeams);
    setGame(null);

    persistState(seed, nextSchedule, nextTeams, null, showOverall);
    setStatusMessage(`Generated schedule with seed ${seed} and auto-saved season.`);
  };

  const simulateNextUnplayed = (): void => {
    const next = schedule.find((g) => !g.played);
    if (!next) return;
    playScheduledGame(next);
  };

  const simulateAllRemaining = (): void => {
    let currentTeams = teams;
    let finalResult: GameResult | null = null;

    const remaining = schedule
      .filter((g) => !g.played)
      .sort((a, b) => a.gameNumber - b.gameNumber);
    const updates = new Map<string, { resultId: string; homeScore: number; awayScore: number }>();

    for (const g of remaining) {
      const home = currentTeams.find((t) => t.id === g.homeTeamId);
      const away = currentTeams.find((t) => t.id === g.awayTeamId);
      if (!home || !away) continue;

      const result = simulateGame(home, away, initialPlayers, scheduleSeed * 10_000 + g.gameNumber);
      currentTeams = applyGameToStandings(currentTeams, result);
      updates.set(g.id, {
        resultId: result.id,
        homeScore: result.home.score,
        awayScore: result.away.score
      });
      finalResult = result;
    }

    const nextSchedule = schedule.map((g) => {
      const update = updates.get(g.id);
      if (!update) return g;
      return { ...g, played: true, ...update };
    });

    setTeams(currentTeams);
    setSchedule(nextSchedule);
    if (finalResult) setGame(finalResult);

    persistState(scheduleSeed, nextSchedule, currentTeams, finalResult, showOverall);
    setStatusMessage('Simulated all remaining games and auto-saved season.');
  };

  const saveSeason = (): void => {
    persistState(scheduleSeed, schedule, teams, game, showOverall);
    setStatusMessage('Season saved to local storage.');
  };

  const loadSeason = (): void => {
    const loaded = loadSeasonState();
    if (!loaded) {
      setStatusMessage('No valid saved season found to load.');
      return;
    }

    setScheduleSeed(loaded.scheduleSeed);
    setSchedule(loaded.schedule);
    setTeams(loaded.teams);
    setGame(loaded.game);
    setShowOverall(loaded.showOverall);
    setStatusMessage('Season loaded from local storage.');
  };

  const resetSeason = (): void => {
    clearSeasonState();
    const nextTeams = resetTeams();
    const nextSchedule = generateRegularSeasonSchedule(initialTeams, initialSeed);

    setScheduleSeed(initialSeed);
    setSchedule(nextSchedule);
    setTeams(nextTeams);
    setGame(null);
    setShowOverall(false);
    setStatusMessage('Season reset and saved state cleared.');
  };

  const toggleOverall = (): void => {
    const nextShowOverall = !showOverall;
    setShowOverall(nextShowOverall);
    persistState(scheduleSeed, schedule, teams, game, nextShowOverall);
  const playScheduledGame = (scheduledGame: ScheduledGame): void => {
    if (scheduledGame.played) return;
    const home = teams.find((t) => t.id === scheduledGame.homeTeamId);
    const away = teams.find((t) => t.id === scheduledGame.awayTeamId);
    if (!home || !away) return;

    const result = simulateGame(home, away, initialPlayers, scheduleSeed * 10_000 + scheduledGame.gameNumber);

    setGame(result);
    setTeams((prev) => applyGameToStandings(prev, result));
    setSchedule((prev) =>
      prev.map((g) =>
        g.id === scheduledGame.id
          ? {
              ...g,
              played: true,
              resultId: result.id,
              homeScore: result.home.score,
              awayScore: result.away.score
            }
          : g
      )
    );
  };

  const generateSchedule = (seed: number): void => {
    setScheduleSeed(seed);
    setSchedule(generateRegularSeasonSchedule(initialTeams, seed));
    setTeams(resetTeams());
    setGame(null);
  };

  const simulateNextUnplayed = (): void => {
    const next = schedule.find((g) => !g.played);
    if (!next) return;
    playScheduledGame(next);
  };

  const simulateAllRemaining = (): void => {
    let currentTeams = teams;
    let finalResult: GameResult | null = null;

    const remaining = schedule.filter((g) => !g.played).sort((a, b) => a.gameNumber - b.gameNumber);
    const updates = new Map<string, { resultId: string; homeScore: number; awayScore: number }>();

    for (const g of remaining) {
      const home = currentTeams.find((t) => t.id === g.homeTeamId);
      const away = currentTeams.find((t) => t.id === g.awayTeamId);
      if (!home || !away) continue;

      const result = simulateGame(home, away, initialPlayers, scheduleSeed * 10_000 + g.gameNumber);
      currentTeams = applyGameToStandings(currentTeams, result);
      updates.set(g.id, { resultId: result.id, homeScore: result.home.score, awayScore: result.away.score });
      finalResult = result;
    }

    setTeams(currentTeams);
    setSchedule((prev) =>
      prev.map((g) => {
        const update = updates.get(g.id);
        if (!update) return g;
        return { ...g, played: true, ...update };
      })
    );
    if (finalResult) setGame(finalResult);
  };

  const remainingGames = schedule.filter((g) => !g.played).length;

  return (
    <main>
      <h1>BSN 2026 Manager — v0.1 MVP</h1>
      <p>
        {leagueRules.game.numPeriods} x {leagueRules.game.quarterLength}-minute quarters (
        {leagueRules.game.numPeriods * leagueRules.game.quarterLength}-minute FIBA game)
      </p>

      <section>
        <h2>Season Schedule</h2>
        <div className="selectors">
          <label>
            Seed
            <input
              type="number"
              value={scheduleSeed}
              onChange={(e) => setScheduleSeed(Number(e.target.value) || 0)}
            />
          </label>
          <button type="button" onClick={() => generateSchedule(scheduleSeed)}>
            Generate / Regenerate Schedule
          </button>
          <button type="button" onClick={simulateNextUnplayed} disabled={remainingGames === 0}>
            Simulate Next Unplayed
          </button>
          <button type="button" onClick={simulateAllRemaining} disabled={remainingGames === 0}>
            Simulate All Remaining
          </button>
          <button type="button" onClick={saveSeason}>
            Save Season
          </button>
          <button type="button" onClick={loadSeason}>
            Load Season
          </button>
          <button type="button" onClick={resetSeason}>
            Reset Season
          </button>
        </div>
        {statusMessage ? <p>{statusMessage}</p> : null}
        </div>
        <p>
          Regular season games: {schedule.length} | Remaining: {remainingGames}
        </p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Away</th>
              <th>Home</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((sg) => (
              <tr key={sg.id}>
                <td>{sg.gameNumber}</td>
                <td>{teamNameById.get(sg.awayTeamId)}</td>
                <td>{teamNameById.get(sg.homeTeamId)}</td>
                <td>{sg.played ? `${sg.awayScore} - ${sg.homeScore}` : 'Unplayed'}</td>
                <td>
                  <button type="button" onClick={() => playScheduledGame(sg)} disabled={sg.played}>
                    Simulate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

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
        <button onClick={toggleOverall} type="button">
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
