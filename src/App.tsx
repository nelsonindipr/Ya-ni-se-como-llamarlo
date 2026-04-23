import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { BoxScoreTable } from './components/BoxScoreTable';
import { StandingsTable } from './components/StandingsTable';
import { initialPlayers } from './data/players';
import { initialTeams } from './data/teams';
import { leagueRules } from './domain/rules';
import type { GameResult, PlayoffBracket, PlayoffSeries, ScheduledGame, Team } from './domain/types';
import { simulateGame } from './simulation/engine';
import { generatePlayoffBracket, simulateEntirePlayoffs, simulateNextPlayoffSeries } from './simulation/playoffs';
import { generateRegularSeasonSchedule } from './simulation/schedule';
import { applyGameToStandings, toStandingRows } from './simulation/standings';
import { clearSeasonState, loadSeasonState, saveSeasonState } from './utils/storage';

const initialSeed = 2026;

const resetTeams = (): Team[] =>
  initialTeams.map((team) => ({ ...team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

function App() {
  const [teams, setTeams] = useState<Team[]>(resetTeams);
  const [game, setGame] = useState<GameResult | null>(null);
  const [selectedScheduledGameId, setSelectedScheduledGameId] = useState<string | null>(null);
  const [showOverall, setShowOverall] = useState(false);
  const [scheduleSeed, setScheduleSeed] = useState(initialSeed);
  const [schedule, setSchedule] = useState<ScheduledGame[]>(() =>
    generateRegularSeasonSchedule(initialTeams, initialSeed)
  );
  const [playoffBracket, setPlayoffBracket] = useState<PlayoffBracket | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const standings = useMemo(() => toStandingRows(teams), [teams]);
  const teamNameById = useMemo(() => new Map(initialTeams.map((t) => [t.id, t.name])), []);

  const persistState = (
    nextSeed: number,
    nextSchedule: ScheduledGame[],
    nextTeams: Team[],
    nextGame: GameResult | null,
    nextSelectedScheduledGameId: string | null,
    nextShowOverall: boolean,
    nextPlayoffBracket: PlayoffBracket | null
  ): void => {
    saveSeasonState({
      version: 3,
      scheduleSeed: nextSeed,
      schedule: nextSchedule,
      teams: nextTeams,
      game: nextGame,
      selectedScheduledGameId: nextSelectedScheduledGameId,
      showOverall: nextShowOverall,
      playoffBracket: nextPlayoffBracket
    });
  };

  useEffect(() => {
    const loaded = loadSeasonState();
    if (!loaded) return;
    setScheduleSeed(loaded.scheduleSeed);
    setSchedule(loaded.schedule);
    setTeams(loaded.teams);
    setGame(loaded.game);
    setSelectedScheduledGameId(loaded.selectedScheduledGameId ?? null);
    setShowOverall(loaded.showOverall);
    setPlayoffBracket(loaded.playoffBracket);
    setStatusMessage('Loaded saved season from local storage.');
  }, []);

  const maybeGeneratePlayoffs = (nextTeams: Team[], nextSchedule: ScheduledGame[]): PlayoffBracket | null => {
    const regularSeasonComplete = nextSchedule.every((scheduled) => scheduled.played);
    if (!regularSeasonComplete) return playoffBracket;
    if (playoffBracket) return playoffBracket;
    return generatePlayoffBracket(toStandingRows(nextTeams));
  };

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
            awayScore: result.away.score,
            result
          }
        : g
    );
    const nextPlayoffBracket = maybeGeneratePlayoffs(nextTeams, nextSchedule);

    setGame(result);
    setSelectedScheduledGameId(scheduledGame.id);
    setTeams(nextTeams);
    setSchedule(nextSchedule);
    setPlayoffBracket(nextPlayoffBracket);
    persistState(scheduleSeed, nextSchedule, nextTeams, result, scheduledGame.id, showOverall, nextPlayoffBracket);
    setStatusMessage(`Game #${scheduledGame.gameNumber} simulated and season auto-saved.`);
  };

  const generateSchedule = (seed: number): void => {
    const nextSchedule = generateRegularSeasonSchedule(initialTeams, seed);
    const nextTeams = resetTeams();

    setScheduleSeed(seed);
    setSchedule(nextSchedule);
    setTeams(nextTeams);
    setGame(null);
    setSelectedScheduledGameId(null);
    setPlayoffBracket(null);

    persistState(seed, nextSchedule, nextTeams, null, null, showOverall, null);
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
    const updates = new Map<string, { resultId: string; homeScore: number; awayScore: number; result: GameResult }>();

    for (const g of remaining) {
      const home = currentTeams.find((t) => t.id === g.homeTeamId);
      const away = currentTeams.find((t) => t.id === g.awayTeamId);
      if (!home || !away) continue;

      const result = simulateGame(home, away, initialPlayers, scheduleSeed * 10_000 + g.gameNumber);
      currentTeams = applyGameToStandings(currentTeams, result);
      updates.set(g.id, {
        resultId: result.id,
        homeScore: result.home.score,
        awayScore: result.away.score,
        result
      });
      finalResult = result;
    }

    const nextSchedule = schedule.map((g) => {
      const update = updates.get(g.id);
      if (!update) return g;
      return { ...g, played: true, ...update };
    });
    const nextPlayoffBracket = maybeGeneratePlayoffs(currentTeams, nextSchedule);

    setTeams(currentTeams);
    setSchedule(nextSchedule);
    setPlayoffBracket(nextPlayoffBracket);
    const selectedGameStillExists =
      selectedScheduledGameId !== null && nextSchedule.some((scheduled) => scheduled.id === selectedScheduledGameId && scheduled.played);
    const nextSelectedScheduledGameId = selectedGameStillExists
      ? selectedScheduledGameId
      : remaining.length > 0
        ? remaining[remaining.length - 1].id
        : selectedScheduledGameId;
    setSelectedScheduledGameId(nextSelectedScheduledGameId);
    if (finalResult) setGame(finalResult);

    persistState(scheduleSeed, nextSchedule, currentTeams, finalResult, nextSelectedScheduledGameId, showOverall, nextPlayoffBracket);
    setStatusMessage('Simulated all remaining games and auto-saved season.');
  };

  const saveSeason = (): void => {
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, showOverall, playoffBracket);
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
    setSelectedScheduledGameId(loaded.selectedScheduledGameId ?? null);
    setShowOverall(loaded.showOverall);
    setPlayoffBracket(loaded.playoffBracket);
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
    setSelectedScheduledGameId(null);
    setShowOverall(false);
    setPlayoffBracket(null);
    setStatusMessage('Season reset and saved state cleared.');
  };

  const toggleOverall = (): void => {
    const nextShowOverall = !showOverall;
    setShowOverall(nextShowOverall);
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, nextShowOverall, playoffBracket);
  };

  const remainingGames = schedule.filter((g) => !g.played).length;
  const remainingPlayoffSeries = useMemo(() => {
    if (!playoffBracket) return 0;
    const all = [
      playoffBracket.conferenceSemifinals.a1v4,
      playoffBracket.conferenceSemifinals.a2v3,
      playoffBracket.conferenceSemifinals.b1v4,
      playoffBracket.conferenceSemifinals.b2v3,
      playoffBracket.conferenceFinals.a,
      playoffBracket.conferenceFinals.b,
      playoffBracket.bsnFinal
    ];
    return all.filter((series) => (series.higherSeedTeamId && series.lowerSeedTeamId ? !series.winnerTeamId : false)).length;
  }, [playoffBracket]);
  const teamName = (id?: string): string => initialTeams.find((team) => team.id === id)?.name ?? 'TBD';
  const seriesScore = (series: PlayoffSeries): string => {
    const highWins = series.higherSeedTeamId ? series.winsByTeamId[series.higherSeedTeamId] ?? 0 : 0;
    const lowWins = series.lowerSeedTeamId ? series.winsByTeamId[series.lowerSeedTeamId] ?? 0 : 0;
    return `${highWins}-${lowWins}`;
  };

  const simulateNextPlayoffRoundSeries = (): void => {
    if (!playoffBracket) return;
    const next = simulateNextPlayoffSeries(playoffBracket, teams, initialPlayers, scheduleSeed);
    setPlayoffBracket(next);
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, showOverall, next);
    setStatusMessage('Simulated next playoff series and auto-saved season.');
  };

  const simulateAllPlayoffs = (): void => {
    if (!playoffBracket) return;
    const next = simulateEntirePlayoffs(playoffBracket, teams, initialPlayers, scheduleSeed);
    setPlayoffBracket(next);
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, showOverall, next);
    setStatusMessage('Simulated all remaining playoff series and auto-saved season.');
  };

  const selectedScheduledResult =
    selectedScheduledGameId === null
      ? null
      : schedule.find((scheduled) => scheduled.id === selectedScheduledGameId)?.result ?? null;
  const displayedGame = selectedScheduledResult ?? game;

  const selectScheduledGame = (scheduledGame: ScheduledGame): void => {
    if (!scheduledGame.played || !scheduledGame.result) return;
    setSelectedScheduledGameId(scheduledGame.id);
    persistState(scheduleSeed, schedule, teams, game, scheduledGame.id, showOverall, playoffBracket);
  };

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
              <tr
                key={sg.id}
                className={[
                  sg.played ? 'played-scheduled-game' : '',
                  sg.id === selectedScheduledGameId ? 'selected-scheduled-game' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectScheduledGame(sg)}
              >
                <td>{sg.gameNumber}</td>
                <td>{teamNameById.get(sg.awayTeamId)}</td>
                <td>{teamNameById.get(sg.homeTeamId)}</td>
                <td>{sg.played ? `${sg.awayScore} - ${sg.homeScore}` : 'Unplayed'}</td>
                <td>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      playScheduledGame(sg);
                    }}
                    disabled={sg.played}
                  >
                    Simulate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {playoffBracket ? (
        <section>
          <h2>BSN 2026 Playoffs</h2>
          <p>{playoffBracket.championTeamId ? `Champion: ${teamName(playoffBracket.championTeamId)}` : `Series remaining: ${remainingPlayoffSeries}`}</p>
          <div className="selectors">
            <button type="button" onClick={simulateNextPlayoffRoundSeries} disabled={remainingPlayoffSeries === 0}>
              Simulate Next Playoff Series
            </button>
            <button type="button" onClick={simulateAllPlayoffs} disabled={remainingPlayoffSeries === 0}>
              Simulate All Playoff Series
            </button>
          </div>
          <div className="grid">
            <section>
              <h3>Conference A Semifinals</h3>
              <p>({playoffBracket.conferenceSemifinals.a1v4.higherSeed}) {teamName(playoffBracket.conferenceSemifinals.a1v4.higherSeedTeamId)} vs ({playoffBracket.conferenceSemifinals.a1v4.lowerSeed}) {teamName(playoffBracket.conferenceSemifinals.a1v4.lowerSeedTeamId)} — {seriesScore(playoffBracket.conferenceSemifinals.a1v4)}</p>
              <p>({playoffBracket.conferenceSemifinals.a2v3.higherSeed}) {teamName(playoffBracket.conferenceSemifinals.a2v3.higherSeedTeamId)} vs ({playoffBracket.conferenceSemifinals.a2v3.lowerSeed}) {teamName(playoffBracket.conferenceSemifinals.a2v3.lowerSeedTeamId)} — {seriesScore(playoffBracket.conferenceSemifinals.a2v3)}</p>
              <h3>Conference A Final</h3>
              <p>({playoffBracket.conferenceFinals.a.higherSeed}) {teamName(playoffBracket.conferenceFinals.a.higherSeedTeamId)} vs ({playoffBracket.conferenceFinals.a.lowerSeed}) {teamName(playoffBracket.conferenceFinals.a.lowerSeedTeamId)} — {seriesScore(playoffBracket.conferenceFinals.a)}</p>
            </section>
            <section>
              <h3>Conference B Semifinals</h3>
              <p>({playoffBracket.conferenceSemifinals.b1v4.higherSeed}) {teamName(playoffBracket.conferenceSemifinals.b1v4.higherSeedTeamId)} vs ({playoffBracket.conferenceSemifinals.b1v4.lowerSeed}) {teamName(playoffBracket.conferenceSemifinals.b1v4.lowerSeedTeamId)} — {seriesScore(playoffBracket.conferenceSemifinals.b1v4)}</p>
              <p>({playoffBracket.conferenceSemifinals.b2v3.higherSeed}) {teamName(playoffBracket.conferenceSemifinals.b2v3.higherSeedTeamId)} vs ({playoffBracket.conferenceSemifinals.b2v3.lowerSeed}) {teamName(playoffBracket.conferenceSemifinals.b2v3.lowerSeedTeamId)} — {seriesScore(playoffBracket.conferenceSemifinals.b2v3)}</p>
              <h3>Conference B Final</h3>
              <p>({playoffBracket.conferenceFinals.b.higherSeed}) {teamName(playoffBracket.conferenceFinals.b.higherSeedTeamId)} vs ({playoffBracket.conferenceFinals.b.lowerSeed}) {teamName(playoffBracket.conferenceFinals.b.lowerSeedTeamId)} — {seriesScore(playoffBracket.conferenceFinals.b)}</p>
            </section>
          </div>
          <section>
            <h3>BSN Final</h3>
            <p>({playoffBracket.bsnFinal.higherSeed}) {teamName(playoffBracket.bsnFinal.higherSeedTeamId)} vs ({playoffBracket.bsnFinal.lowerSeed}) {teamName(playoffBracket.bsnFinal.lowerSeedTeamId)} — {seriesScore(playoffBracket.bsnFinal)}</p>
            <p>Format: Best-of-7. No play-in. No reseeding.</p>
          </section>
        </section>
      ) : null}

      {displayedGame ? (
        <section>
          <h2>
            Final: {displayedGame.away.teamName} {displayedGame.away.score} - {displayedGame.home.score} {displayedGame.home.teamName}
          </h2>
          <div className="grid">
            <BoxScoreTable box={displayedGame.away} />
            <BoxScoreTable box={displayedGame.home} />
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
