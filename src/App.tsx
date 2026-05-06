import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { BoxScoreTable } from './components/BoxScoreTable';
import { PlayerProfile } from './components/PlayerProfile';
import { StandingsTable } from './components/StandingsTable';
import { TeamPage } from './components/TeamPage';
import { initialPlayers } from './data/players';
import { initialTeams } from './data/teams';
import { leagueRules } from './domain/rules';
import { toStandingRows } from './simulation/standings';
import {
  autoConfigureTeamRotation,
  createNewGameState,
  simulateByWindow,
  simulateNextPlayoffSeriesForState,
  simulateScheduledGame,
  updatePlayerAvailability,
  updatePlayerMinutesTarget,
  updatePlayerStarter,
  validateTeamRotation,
  type GameState
} from './state/gameState';
import { clearSeasonState, loadSeasonState, saveSeasonState } from './utils/storage';

type AppSection =
  | 'Dashboard'
  | 'Roster'
  | 'Rotation'
  | 'Schedule'
  | 'League'
  | 'Free Agents'
  | 'Imports'
  | 'Finance/Salary Cap'
  | 'Development'
  | 'Staff'
  | 'Stats'
  | 'News'
  | 'Settings';

type SimWindow = 'next_game' | 'one_day' | 'one_week' | 'one_month' | 'rest_regular_season' | 'until_playoffs' | 'full_season';

const initialSeed = 2026;
const MIN_GAMES = 5;
const sections: AppSection[] = ['Dashboard', 'Roster', 'Rotation', 'Schedule', 'League', 'Free Agents', 'Imports', 'Finance/Salary Cap', 'Development', 'Staff', 'Stats', 'News', 'Settings'];

function App() {
  const [state, setState] = useState<GameState>(() => createNewGameState(initialSeed));
  const [statusMessage, setStatusMessage] = useState('');
  const [activeSection, setActiveSection] = useState<AppSection>('Dashboard');
  const [simOption, setSimOption] = useState<SimWindow>('next_game');
  const [rosterSort, setRosterSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'overall', direction: 'desc' });
  const [rosterFilter, setRosterFilter] = useState('');

  useEffect(() => {
    const loaded = loadSeasonState();
    if (!loaded) return;
    setState(loaded);
    setStatusMessage('Loaded saved season from local storage.');
  }, []);

  const persist = (next: GameState, message?: string): void => {
    setState(next);
    saveSeasonState(next);
    if (message) setStatusMessage(message);
  };

  const standings = useMemo(() => toStandingRows(state.teams), [state.teams]);
  const teamNameById = useMemo(() => new Map(initialTeams.map((t) => [t.id, t.name])), []);
  const remainingGames = state.schedule.filter((g) => !g.played).length;

  const selectedScheduledResult = state.selectedScheduledGameId === null ? null : state.schedule.find((scheduled) => scheduled.id === state.selectedScheduledGameId)?.result ?? null;
  const displayedGame = selectedScheduledResult ?? state.lastGame;
  const userTeam = state.selectedTeamId ? state.teams.find((team) => team.id === state.selectedTeamId) ?? state.teams[0] : state.teams[0];

  const selectedPlayer = state.selectedPlayerId ? initialPlayers.find((player) => player.id === state.selectedPlayerId) ?? null : null;

  const leaderRows = useMemo(() => initialPlayers
    .map((player) => {
      const s = state.stats.regularPlayerStats[player.id];
      return { player, gamesPlayed: s.gamesPlayed, ppg: s.gamesPlayed ? s.points / s.gamesPlayed : 0, rpg: s.gamesPlayed ? s.rebounds / s.gamesPlayed : 0, apg: s.gamesPlayed ? s.assists / s.gamesPlayed : 0 };
    })
    .filter((r) => r.gamesPlayed > 0), [state.stats.regularPlayerStats]);

  const injuryRows = useMemo(() => Object.values(state.runtimePlayers).filter((p) => p.injury).sort((a, b) => (b.injury?.gamesRemaining ?? 0) - (a.injury?.gamesRemaining ?? 0)), [state.runtimePlayers]);

  const activeTeamPayrolls = useMemo(() => initialTeams
    .map((team) => {
      const roster = initialPlayers.filter((p) => p.teamId === team.id);
      const payroll = roster.reduce((sum, p) => sum + (state.runtimePlayers[p.id]?.salary ?? 0), 0);
      const imports = roster.filter((p) => p.isImport).length;
      return { team, payroll, imports };
    })
    .sort((a, b) => b.payroll - a.payroll), [state.runtimePlayers]);

  const nextGame = state.schedule.find((g) => !g.played);
  const userTeamStats = state.stats.regularTeamStats[userTeam.id];
  const conferenceRows = standings.filter((row) => row.conference === userTeam.conference);
  const userTeamStanding = conferenceRows.findIndex((row) => row.id === userTeam.id) + 1;
  const userRoster = initialPlayers.filter((p) => p.teamId === userTeam.id);
  const userTeamPayroll = activeTeamPayrolls.find((p) => p.team.id === userTeam.id);

  const rosterRows = useMemo(() => {
    const rows = userRoster.map((player) => {
      const rp = state.runtimePlayers[player.id];
      const stats = state.stats.regularPlayerStats[player.id];
      return {
        ...player,
        role: player.role,
        overall: Math.round((player.ratings.midRange + player.ratings.threePoint + player.ratings.perimeterDefense + player.ratings.offensiveIQ + player.ratings.defensiveIQ) / 5),
        potential: Math.min(99, Math.round((player.ratings.hustle + player.ratings.stamina + player.ratings.offensiveIQ + player.ratings.defensiveIQ) / 4 + 5)),
        minutes: rp?.minutesOverride ?? player.minutesTarget,
        ppg: stats.gamesPlayed ? stats.points / stats.gamesPlayed : 0,
        rpg: stats.gamesPlayed ? stats.rebounds / stats.gamesPlayed : 0,
        apg: stats.gamesPlayed ? stats.assists / stats.gamesPlayed : 0,
        status: rp?.availability ?? 'active'
      };
    }).filter((row) => row.displayName.toLowerCase().includes(rosterFilter.toLowerCase()));

    const dir = rosterSort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, string | number>)[rosterSort.key];
      const bv = (b as unknown as Record<string, string | number>)[rosterSort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [userRoster, state.runtimePlayers, state.stats.regularPlayerStats, rosterFilter, rosterSort]);

  const top = <T,>(rows: T[], sortFn: (a: T, b: T) => number) => [...rows].sort(sortFn).slice(0, 10);
  const lastFive = state.schedule.filter((g) => g.played && (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)).slice(-5);
  const hottest = top(leaderRows.filter((r) => userRoster.some((p) => p.id === r.player.id)), (a, b) => b.ppg - a.ppg)[0];
  const coldest = top(leaderRows.filter((r) => userRoster.some((p) => p.id === r.player.id)), (a, b) => a.ppg - b.ppg)[0];

  const renderDashboard = () => (
    <div className="cards-grid">
      <article className="card"><h3>Team Record</h3><p>{userTeamStats.wins}-{userTeamStats.losses}</p></article>
      <article className="card"><h3>Standings Position</h3><p>{userTeamStanding ? `#${userTeamStanding} ${userTeam.conference}` : 'N/A'}</p></article>
      <article className="card"><h3>Last 5 Games</h3><ul>{lastFive.map((g) => <li key={g.id}>{g.date}: {teamNameById.get(g.awayTeamId)} {g.awayScore} - {g.homeScore} {teamNameById.get(g.homeTeamId)}</li>)}</ul></article>
      <article className="card"><h3>Next Opponent</h3><p>{nextGame ? `${teamNameById.get(nextGame.awayTeamId)} @ ${teamNameById.get(nextGame.homeTeamId)}` : 'Season Complete'}</p></article>
      <article className="card"><h3>Player in Good Form</h3><p>{hottest ? `${hottest.player.displayName} (${hottest.ppg.toFixed(1)} PPG)` : 'No games played'}</p></article>
      <article className="card"><h3>Player in Slump</h3><p>{coldest ? `${coldest.player.displayName} (${coldest.ppg.toFixed(1)} PPG)` : 'No games played'}</p></article>
      <article className="card"><h3>Salary Cap Status</h3><p>{userTeamPayroll ? `$${Math.round(userTeamPayroll.payroll).toLocaleString()} / $${state.league.salaryCap.toLocaleString()}` : 'N/A'}</p></article>
      <article className="card"><h3>Import Slots Status</h3><p>{userTeamPayroll ? `${userTeamPayroll.imports}/${state.league.maxImports} imports` : 'N/A'}</p></article>
    </div>
  );

  const renderRoster = () => (
    <section>
      <div className="row-between"><h2>Roster</h2><input placeholder="Filter player..." value={rosterFilter} onChange={(e) => setRosterFilter(e.target.value)} /></div>
      <table>
        <thead><tr>{['displayName','position','age','nationality','role','overall','potential','minutes','ppg','rpg','apg','status'].map((col) => <th key={col}><button className="sort-btn" onClick={() => setRosterSort((prev) => ({ key: col, direction: prev.key === col && prev.direction === 'desc' ? 'asc' : 'desc' }))}>{col.toUpperCase()}</button></th>)}</tr></thead>
        <tbody>{rosterRows.map((row) => <tr key={row.id} onClick={() => setState((s) => ({ ...s, selectedPlayerId: row.id }))}><td>{row.displayName}</td><td>{row.position}</td><td>{row.age}</td><td>{row.nationality}</td><td>{row.role}</td><td>{row.overall}</td><td>{row.potential}</td><td>{row.minutes}</td><td>{row.ppg.toFixed(1)}</td><td>{row.rpg.toFixed(1)}</td><td>{row.apg.toFixed(1)}</td><td>{row.status}</td></tr>)}</tbody>
      </table>
    </section>
  );

  const renderSection = () => {
    if (activeSection === 'Dashboard') return renderDashboard();
    if (activeSection === 'Roster') return renderRoster();
    if (activeSection === 'Rotation') return <TeamPage team={userTeam} roster={userRoster} runtimePlayers={state.runtimePlayers} regularStats={state.stats.regularTeamStats[userTeam.id]} playoffStats={state.stats.playoffTeamStats[userTeam.id]} schedule={state.schedule.filter((g) => g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)} teamNameById={teamNameById} validationErrors={validateTeamRotation(state, userTeam.id).errors} onPlayerClick={(playerId) => setState((s) => ({ ...s, selectedPlayerId: playerId }))} onStarterToggle={(playerId, starter) => persist(updatePlayerStarter(state, userTeam.id, playerId, starter), 'Updated starter.')} onAvailabilityChange={(playerId, status) => persist(updatePlayerAvailability(state, playerId, status), 'Updated availability.')} onMinutesChange={(playerId, minutes) => persist(updatePlayerMinutesTarget(state, playerId, Number.isFinite(minutes) ? minutes : null), 'Updated minutes target.')} onAutoRotation={() => persist(autoConfigureTeamRotation(state, userTeam.id), 'Auto rotation applied.')} onBack={() => undefined} />;
    if (activeSection === 'Schedule') return <section><h2>Schedule</h2><table><thead><tr><th>Date</th><th>#</th><th>Away</th><th>Home</th><th>Status</th><th>Action</th></tr></thead><tbody>{state.schedule.map((sg) => <tr key={sg.id}><td>{sg.date}</td><td>{sg.gameNumber}</td><td>{teamNameById.get(sg.awayTeamId)}</td><td>{teamNameById.get(sg.homeTeamId)}</td><td>{sg.played ? `${sg.awayScore} - ${sg.homeScore}` : 'Unplayed'}</td><td><button onClick={() => persist(simulateScheduledGame(state, sg.id), `Game #${sg.gameNumber} simulated.`)} disabled={sg.played}>Simulate</button></td></tr>)}</tbody></table></section>;
    if (activeSection === 'League') return <div className="grid"><StandingsTable title="Conference A" rows={standings} conference="A" onTeamClick={() => undefined} /><StandingsTable title="Conference B" rows={standings} conference="B" onTeamClick={() => undefined} /></div>;
    if (activeSection === 'Stats') return <section><h2>League Leaders</h2><div className="grid"><div><h3>Points</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.ppg - a.ppg).map((r) => <li key={r.player.id}>{r.player.displayName} {r.ppg.toFixed(1)}</li>)}</ol></div></div></section>;
    return <section><h2>{activeSection}</h2><p>Module scaffold ready for BSN management workflows.</p></section>;
  };

  return <main className="app-shell">
    <header className="top-nav">
      <div><strong>{userTeam.name}</strong> | {userTeamStats.wins}-{userTeamStats.losses}</div>
      <div>{state.currentDate} · {state.phase}</div>
      <div>Next: {nextGame ? `${teamNameById.get(nextGame.awayTeamId)} @ ${teamNameById.get(nextGame.homeTeamId)}` : 'Complete'}</div>
      <div className="sim-controls"><select value={simOption} onChange={(e) => setSimOption(e.target.value as SimWindow)}><option value="next_game">Next Game</option><option value="one_day">1 Day</option><option value="one_week">1 Week</option><option value="one_month">1 Month</option><option value="rest_regular_season">Rest Regular Season</option><option value="until_playoffs">Until Playoffs</option><option value="full_season">Full Season</option></select><button onClick={() => persist(simulateByWindow(state, simOption), 'Simulation complete.')} disabled={remainingGames === 0 && simOption !== 'full_season'}>{simOption === 'next_game' ? 'Simulate Next Game' : 'Simulate'}</button></div>
    </header>
    <div className="layout">
      <aside className="left-sidebar">{sections.map((section) => <button key={section} className={activeSection === section ? 'active' : ''} onClick={() => setActiveSection(section)}>{section}</button>)}</aside>
      <section className="content-area">
        {statusMessage ? <p className="status">{statusMessage}</p> : null}
        {renderSection()}
        {displayedGame ? <section><h2>Latest Box Score</h2><div className="grid"><BoxScoreTable box={displayedGame.away} /><BoxScoreTable box={displayedGame.home} /></div></section> : null}
      </section>
      <aside className="right-panel">
        <h3>Next Game</h3><p>{nextGame ? `${nextGame.date} · ${teamNameById.get(nextGame.awayTeamId)} @ ${teamNameById.get(nextGame.homeTeamId)}` : 'No remaining games'}</p>
        <h3>Injuries</h3><ul>{injuryRows.slice(0, 5).map((row) => { const player = initialPlayers.find((p) => p.id === row.playerId); return player && row.injury ? <li key={row.playerId}>{player.displayName}: {row.injury.type} ({row.injury.gamesRemaining})</li> : null; })}</ul>
        <h3>Important Alerts</h3><p>Cap: ${state.league.salaryCap.toLocaleString()} | Imports: {state.league.maxImports}</p>
        <h3>Hot / Cold</h3><p>🔥 {hottest?.player.displayName ?? '-'} | 🧊 {coldest?.player.displayName ?? '-'}</p>
        <h3>League News</h3><p>{state.lastGame ? 'Latest result posted.' : 'No news yet.'}</p>
      </aside>
    </div>
    {selectedPlayer ? <div className="modal-overlay" onClick={() => setState((s) => ({ ...s, selectedPlayerId: null }))}><div className="modal-content" onClick={(e) => e.stopPropagation()}><PlayerProfile player={selectedPlayer} teamName={teamNameById.get(selectedPlayer.teamId) ?? selectedPlayer.teamId} regularStats={state.stats.regularPlayerStats[selectedPlayer.id]} playoffStats={state.stats.playoffPlayerStats[selectedPlayer.id]} gameLogs={state.stats.playerGameLogs[selectedPlayer.id] ?? []} teamNameById={teamNameById} onBack={() => setState((s) => ({ ...s, selectedPlayerId: null }))} /></div></div> : null}
    <footer className="footer-controls"><button onClick={() => { saveSeasonState(state); setStatusMessage('Season saved.'); }}>Save Game</button><button onClick={() => { const loaded = loadSeasonState(); if (loaded) { setState(loaded); setStatusMessage('Season loaded.'); } }}>Load Game</button><button onClick={() => { clearSeasonState(); const next = createNewGameState(initialSeed); setState(next); setStatusMessage('Season reset.'); }}>New Game</button><button onClick={() => persist(simulateNextPlayoffSeriesForState(state), 'Simulated next playoff series.')} disabled={!state.playoffBracket}>Sim Next Playoff Series</button><small>Rules: {leagueRules.game.numPeriods} x {leagueRules.game.quarterLength} min</small></footer>
  </main>;
}

export default App;
