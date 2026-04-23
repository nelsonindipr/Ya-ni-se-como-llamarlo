import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { BoxScoreTable } from './components/BoxScoreTable';
import { StandingsTable } from './components/StandingsTable';
import { initialPlayers } from './data/players';
import { initialTeams } from './data/teams';
import { leagueRules } from './domain/rules';
import type { GameResult, PlayoffBracket, ScheduledGame, Team } from './domain/types';
import { simulateGame } from './simulation/engine';
import { generatePlayoffBracket, simulateEntirePlayoffs, simulateNextPlayoffSeries } from './simulation/playoffs';
import { generateRegularSeasonSchedule } from './simulation/schedule';
import { addGameToStats, createEmptySeasonStats, pct, type SeasonStatsState } from './simulation/stats';
import { applyGameToStandings, toStandingRows } from './simulation/standings';
import { clearSeasonState, loadSeasonState, saveSeasonState } from './utils/storage';

const initialSeed = 2026;
const MIN_GAMES = 5;
const MIN_FG_ATTEMPTS = 50;
const MIN_3P_ATTEMPTS = 25;
const MIN_FT_ATTEMPTS = 25;

const resetTeams = (): Team[] =>
  initialTeams.map((team) => ({ ...team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

function App() {
  const [teams, setTeams] = useState<Team[]>(resetTeams);
  const [game, setGame] = useState<GameResult | null>(null);
  const [selectedScheduledGameId, setSelectedScheduledGameId] = useState<string | null>(null);
  const [showOverall, setShowOverall] = useState(false);
  const [scheduleSeed, setScheduleSeed] = useState(initialSeed);
  const [schedule, setSchedule] = useState<ScheduledGame[]>(() => generateRegularSeasonSchedule(initialTeams, initialSeed));
  const [playoffBracket, setPlayoffBracket] = useState<PlayoffBracket | null>(null);
  const [stats, setStats] = useState<SeasonStatsState>(() => createEmptySeasonStats(initialPlayers, initialTeams));
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
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
    nextPlayoffBracket: PlayoffBracket | null,
    nextStats: SeasonStatsState
  ): void => {
    saveSeasonState({
      version: 4,
      scheduleSeed: nextSeed,
      schedule: nextSchedule,
      teams: nextTeams,
      game: nextGame,
      selectedScheduledGameId: nextSelectedScheduledGameId,
      showOverall: nextShowOverall,
      playoffBracket: nextPlayoffBracket,
      stats: nextStats,
      selectedPlayerId
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
    setStats(loaded.stats);
    setSelectedPlayerId(loaded.selectedPlayerId ?? null);
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
    const nextStats = addGameToStats(stats, result, 'regular');
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
    setStats(nextStats);
    persistState(scheduleSeed, nextSchedule, nextTeams, result, scheduledGame.id, showOverall, nextPlayoffBracket, nextStats);
    setStatusMessage(`Game #${scheduledGame.gameNumber} simulated and season auto-saved.`);
  };

  const generateSchedule = (seed: number): void => {
    const nextSchedule = generateRegularSeasonSchedule(initialTeams, seed);
    const nextTeams = resetTeams();
    const nextStats = createEmptySeasonStats(initialPlayers, initialTeams);

    setScheduleSeed(seed);
    setSchedule(nextSchedule);
    setTeams(nextTeams);
    setGame(null);
    setSelectedScheduledGameId(null);
    setPlayoffBracket(null);
    setStats(nextStats);
    setSelectedPlayerId(null);

    persistState(seed, nextSchedule, nextTeams, null, null, showOverall, null, nextStats);
    setStatusMessage(`Generated schedule with seed ${seed} and auto-saved season.`);
  };


  const simulateNextUnplayed = (): void => {
    const next = schedule.find((g) => !g.played);
    if (!next) return;
    playScheduledGame(next);
  };

  const simulateAllRemaining = (): void => {
    let currentTeams = teams;
    let currentStats = stats;
    let finalResult: GameResult | null = null;

    const remaining = schedule.filter((g) => !g.played).sort((a, b) => a.gameNumber - b.gameNumber);
    const updates = new Map<string, { resultId: string; homeScore: number; awayScore: number; result: GameResult }>();

    for (const g of remaining) {
      const home = currentTeams.find((t) => t.id === g.homeTeamId);
      const away = currentTeams.find((t) => t.id === g.awayTeamId);
      if (!home || !away) continue;

      const result = simulateGame(home, away, initialPlayers, scheduleSeed * 10_000 + g.gameNumber);
      currentTeams = applyGameToStandings(currentTeams, result);
      currentStats = addGameToStats(currentStats, result, 'regular');
      updates.set(g.id, { resultId: result.id, homeScore: result.home.score, awayScore: result.away.score, result });
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
    setStats(currentStats);
    const selectedGameStillExists =
      selectedScheduledGameId !== null && nextSchedule.some((scheduled) => scheduled.id === selectedScheduledGameId && scheduled.played);
    const nextSelectedScheduledGameId = selectedGameStillExists
      ? selectedScheduledGameId
      : remaining.length > 0
        ? remaining[remaining.length - 1].id
        : selectedScheduledGameId;
    setSelectedScheduledGameId(nextSelectedScheduledGameId);
    if (finalResult) setGame(finalResult);

    persistState(
      scheduleSeed,
      nextSchedule,
      currentTeams,
      finalResult,
      nextSelectedScheduledGameId,
      showOverall,
      nextPlayoffBracket,
      currentStats
    );
    setStatusMessage('Simulated all remaining games and auto-saved season.');
  };

  const saveSeason = (): void => {
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, showOverall, playoffBracket, stats);
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
    setStats(loaded.stats);
    setSelectedPlayerId(loaded.selectedPlayerId ?? null);
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
    setStats(createEmptySeasonStats(initialPlayers, initialTeams));
    setSelectedPlayerId(null);
    setStatusMessage('Season reset and saved state cleared.');
  };

  const toggleOverall = (): void => {
    const nextShowOverall = !showOverall;
    setShowOverall(nextShowOverall);
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, nextShowOverall, playoffBracket, stats);
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
  const collectPlayoffResults = (next: PlayoffBracket, current: SeasonStatsState): SeasonStatsState => {
    let staged = current;
    const list = [
      next.conferenceSemifinals.a1v4,
      next.conferenceSemifinals.a2v3,
      next.conferenceSemifinals.b1v4,
      next.conferenceSemifinals.b2v3,
      next.conferenceFinals.a,
      next.conferenceFinals.b,
      next.bsnFinal
    ];
    for (const series of list) {
      for (const gameInSeries of series.games) {
        if (gameInSeries.result) staged = addGameToStats(staged, gameInSeries.result, 'playoffs');
      }
    }
    return staged;
  };

  const simulateNextPlayoffRoundSeries = (): void => {
    if (!playoffBracket) return;
    const next = simulateNextPlayoffSeries(playoffBracket, teams, initialPlayers, scheduleSeed);
    const nextStats = collectPlayoffResults(next, stats);
    setPlayoffBracket(next);
    setStats(nextStats);
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, showOverall, next, nextStats);
    setStatusMessage('Simulated next playoff series and auto-saved season.');
  };

  const simulateAllPlayoffs = (): void => {
    if (!playoffBracket) return;
    const next = simulateEntirePlayoffs(playoffBracket, teams, initialPlayers, scheduleSeed);
    const nextStats = collectPlayoffResults(next, stats);
    setPlayoffBracket(next);
    setStats(nextStats);
    persistState(scheduleSeed, schedule, teams, game, selectedScheduledGameId, showOverall, next, nextStats);
    setStatusMessage('Simulated all remaining playoff series and auto-saved season.');
  };

  const selectedScheduledResult = selectedScheduledGameId === null ? null : schedule.find((scheduled) => scheduled.id === selectedScheduledGameId)?.result ?? null;
  const displayedGame = selectedScheduledResult ?? game;

  const leaderRows = useMemo(() => {
    return initialPlayers
      .map((player) => {
        const s = stats.regularPlayerStats[player.id];
        return {
          player,
          gamesPlayed: s.gamesPlayed,
          mpg: s.gamesPlayed ? s.minutes / s.gamesPlayed : 0,
          ppg: s.gamesPlayed ? s.points / s.gamesPlayed : 0,
          rpg: s.gamesPlayed ? s.rebounds / s.gamesPlayed : 0,
          apg: s.gamesPlayed ? s.assists / s.gamesPlayed : 0,
          spg: s.gamesPlayed ? s.steals / s.gamesPlayed : 0,
          bpg: s.gamesPlayed ? s.blocks / s.gamesPlayed : 0,
          fgPct: pct(s.fgm, s.fga),
          threePct: pct(s.tpm, s.tpa),
          ftPct: pct(s.ftm, s.fta),
          fga: s.fga,
          tpa: s.tpa,
          fta: s.fta
        };
      })
      .filter((r) => r.gamesPlayed > 0);
  }, [stats.regularPlayerStats]);

  const top = <T,>(rows: T[], sortFn: (a: T, b: T) => number) => [...rows].sort(sortFn).slice(0, 10);
  const selectedLogs = selectedPlayerId ? stats.playerGameLogs[selectedPlayerId] ?? [] : [];
  const teamStatsRows = initialTeams.map((team) => {
    const reg = stats.regularTeamStats[team.id];
    const po = stats.playoffTeamStats[team.id];
    return { team, reg, po };
  });

  const selectScheduledGame = (scheduledGame: ScheduledGame): void => {
    if (!scheduledGame.played || !scheduledGame.result) return;
    setSelectedScheduledGameId(scheduledGame.id);
    persistState(scheduleSeed, schedule, teams, game, scheduledGame.id, showOverall, playoffBracket, stats);
  };

  return (
    <main>
      <h1>BSN 2026 Manager — v0.1 MVP</h1>
      <p>
        {leagueRules.game.numPeriods} x {leagueRules.game.quarterLength}-minute quarters ({leagueRules.game.numPeriods * leagueRules.game.quarterLength}-minute FIBA game)
      </p>

      <section>
        <h2>Season Schedule</h2>
        <div className="selectors">
          <label>
            Seed
            <input type="number" value={scheduleSeed} onChange={(e) => setScheduleSeed(Number(e.target.value) || 0)} />
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
          <button type="button" onClick={saveSeason}>Save Season</button>
          <button type="button" onClick={loadSeason}>Load Season</button>
          <button type="button" onClick={resetSeason}>Reset Season</button>
        </div>
        {statusMessage ? <p>{statusMessage}</p> : null}
        <p>Regular season games: {schedule.length} | Remaining: {remainingGames}</p>
        <table><thead><tr><th>#</th><th>Away</th><th>Home</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {schedule.map((sg) => (
            <tr key={sg.id} className={[sg.played ? 'played-scheduled-game' : '', sg.id === selectedScheduledGameId ? 'selected-scheduled-game' : ''].filter(Boolean).join(' ')} onClick={() => selectScheduledGame(sg)}>
              <td>{sg.gameNumber}</td><td>{teamNameById.get(sg.awayTeamId)}</td><td>{teamNameById.get(sg.homeTeamId)}</td><td>{sg.played ? `${sg.awayScore} - ${sg.homeScore}` : 'Unplayed'}</td>
              <td><button type="button" onClick={(event) => {event.stopPropagation(); playScheduledGame(sg);}} disabled={sg.played}>Simulate</button></td>
            </tr>
          ))}
        </tbody></table>
      </section>

      {playoffBracket ? <section><h2>BSN 2026 Playoffs</h2><p>{playoffBracket.championTeamId ? `Champion: ${teamName(playoffBracket.championTeamId)}` : `Series remaining: ${remainingPlayoffSeries}`}</p><div className="selectors"><button type="button" onClick={simulateNextPlayoffRoundSeries} disabled={remainingPlayoffSeries === 0}>Simulate Next Playoff Series</button><button type="button" onClick={simulateAllPlayoffs} disabled={remainingPlayoffSeries === 0}>Simulate All Playoff Series</button></div></section> : null}

      {displayedGame ? <section><h2>Final: {displayedGame.away.teamName} {displayedGame.away.score} - {displayedGame.home.score} {displayedGame.home.teamName}</h2><div className="grid"><BoxScoreTable box={displayedGame.away} /><BoxScoreTable box={displayedGame.home} /></div></section> : null}

      <section>
        <h2>League Leaders (Regular Season)</h2>
        <div className="grid">
          <div><h3>Per Game (min {MIN_GAMES} GP)</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.ppg - a.ppg).map((r) => <li key={`ppg-${r.player.id}`}>{r.player.name} {r.ppg.toFixed(1)} PPG</li>)}</ol></div>
          <div><h3>Rebounds</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.rpg - a.rpg).map((r) => <li key={`rpg-${r.player.id}`}>{r.player.name} {r.rpg.toFixed(1)} RPG</li>)}</ol></div>
          <div><h3>Assists</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.apg - a.apg).map((r) => <li key={`apg-${r.player.id}`}>{r.player.name} {r.apg.toFixed(1)} APG</li>)}</ol></div>
          <div><h3>Steals</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.spg - a.spg).map((r) => <li key={`spg-${r.player.id}`}>{r.player.name} {r.spg.toFixed(1)} SPG</li>)}</ol></div>
          <div><h3>Blocks</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.bpg - a.bpg).map((r) => <li key={`bpg-${r.player.id}`}>{r.player.name} {r.bpg.toFixed(1)} BPG</li>)}</ol></div>
          <div><h3>Minutes</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.mpg - a.mpg).map((r) => <li key={`mpg-${r.player.id}`}>{r.player.name} {r.mpg.toFixed(1)} MPG</li>)}</ol></div>
          <div><h3>FG% (min {MIN_FG_ATTEMPTS} FGA)</h3><ol>{top(leaderRows.filter((r) => r.fga >= MIN_FG_ATTEMPTS), (a, b) => b.fgPct - a.fgPct).map((r) => <li key={`fg-${r.player.id}`}>{r.player.name} {(r.fgPct * 100).toFixed(1)}%</li>)}</ol></div>
          <div><h3>3P% (min {MIN_3P_ATTEMPTS} 3PA)</h3><ol>{top(leaderRows.filter((r) => r.tpa >= MIN_3P_ATTEMPTS), (a, b) => b.threePct - a.threePct).map((r) => <li key={`3p-${r.player.id}`}>{r.player.name} {(r.threePct * 100).toFixed(1)}%</li>)}</ol></div>
          <div><h3>FT% (min {MIN_FT_ATTEMPTS} FTA)</h3><ol>{top(leaderRows.filter((r) => r.fta >= MIN_FT_ATTEMPTS), (a, b) => b.ftPct - a.ftPct).map((r) => <li key={`ft-${r.player.id}`}>{r.player.name} {(r.ftPct * 100).toFixed(1)}%</li>)}</ol></div>
        </div>
      </section>

      <section>
        <h2>Player Game Logs</h2>
        <select value={selectedPlayerId ?? ''} onChange={(e) => setSelectedPlayerId(e.target.value || null)}>
          <option value="">Select player</option>
          {initialPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
        </select>
        {selectedPlayerId ? <table><thead><tr><th>Stage</th><th>Opponent</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>Shooting</th></tr></thead><tbody>{selectedLogs.map((log) => <tr key={`${log.gameId}-${log.stage}`}><td>{log.stage}</td><td>{teamNameById.get(log.opponentTeamId)}</td><td>{log.minutes.toFixed(1)}</td><td>{log.points}</td><td>{log.rebounds}</td><td>{log.assists}</td><td>{log.fgm}/{log.fga} FG, {log.tpm}/{log.tpa} 3P, {log.ftm}/{log.fta} FT</td></tr>)}</tbody></table> : null}
      </section>

      <section>
        <h2>Team Season Stats</h2>
        <table><thead><tr><th>Team</th><th>Stage</th><th>GP</th><th>W-L</th><th>PF</th><th>PA</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TOV</th><th>Fouls</th><th>FG%</th><th>3P%</th><th>FT%</th></tr></thead><tbody>
          {teamStatsRows.flatMap(({ team, reg, po }) => ([
            <tr key={`${team.id}-reg`}><td>{team.name}</td><td>Regular</td><td>{reg.gamesPlayed}</td><td>{reg.wins}-{reg.losses}</td><td>{reg.pointsFor}</td><td>{reg.pointsAgainst}</td><td>{reg.rebounds}</td><td>{reg.assists}</td><td>{reg.steals}</td><td>{reg.blocks}</td><td>{reg.turnovers}</td><td>{reg.fouls}</td><td>{(pct(reg.fgm, reg.fga) * 100).toFixed(1)}%</td><td>{(pct(reg.tpm, reg.tpa) * 100).toFixed(1)}%</td><td>{(pct(reg.ftm, reg.fta) * 100).toFixed(1)}%</td></tr>,
            <tr key={`${team.id}-po`}><td>{team.name}</td><td>Playoffs</td><td>{po.gamesPlayed}</td><td>{po.wins}-{po.losses}</td><td>{po.pointsFor}</td><td>{po.pointsAgainst}</td><td>{po.rebounds}</td><td>{po.assists}</td><td>{po.steals}</td><td>{po.blocks}</td><td>{po.turnovers}</td><td>{po.fouls}</td><td>{(pct(po.fgm, po.fga) * 100).toFixed(1)}%</td><td>{(pct(po.tpm, po.tpa) * 100).toFixed(1)}%</td><td>{(pct(po.ftm, po.fta) * 100).toFixed(1)}%</td></tr>
          ]))}
        </tbody></table>
      </section>

      <section>
        <h2>Standings</h2>
        <button onClick={toggleOverall} type="button">{showOverall ? 'Hide Overall Standings' : 'Show Overall Standings'}</button>
        <div className="grid"><StandingsTable title="Conference A" rows={standings} conference="A" /><StandingsTable title="Conference B" rows={standings} conference="B" /></div>
        {showOverall ? <StandingsTable title="Overall" rows={standings} /> : null}
      </section>
    </main>
  );
}

export default App;
