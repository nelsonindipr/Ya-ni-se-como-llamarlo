import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { BoxScoreTable } from './components/BoxScoreTable';
import { PlayerProfile } from './components/PlayerProfile';
import { StandingsTable } from './components/StandingsTable';
import { TeamPage } from './components/TeamPage';
import { initialPlayers } from './data/players';
import { initialTeams } from './data/teams';
import { leagueRules } from './domain/rules';
import { calculateAllPositionOveralls, calculatePlayerOverall } from './domain/playerRatings';
import { toStandingRows } from './simulation/standings';
import {
  autoConfigureTeamRotation,
  createNewGameState,
  findNextUnplayedGameForTeam,
  simulateByWindow,
  simulateNextPlayoffSeriesForState,
  simulateScheduledGame,
  updatePlayerAvailability,
  updatePlayerMinutesTarget,
  updatePlayerStarter,
  validateTeamRotation,
  type GameState
} from './state/gameState';
import { autosaveCurrentSave, createNewSave, deleteSave, duplicateSave, getActiveSaveId, getCurrentSave, getSavesIndex, loadSave, renameSave, saveGame, setActiveSave, type FullSave } from './utils/storage';

type AppSection = 'Dashboard' | 'Roster' | 'Rotation' | 'Schedule' | 'League' | 'Stats' | 'Free Agents' | 'Finance' | 'Development' | 'Staff' | 'News' | 'Settings';
type SimWindow = 'next_game' | 'one_day' | 'one_week' | 'one_month' | 'rest_regular_season' | 'until_playoffs' | 'full_season';
const sections: { key: AppSection; icon: string }[] = [
  { key: 'Dashboard', icon: '🏠' }, { key: 'Roster', icon: '📋' }, { key: 'Rotation', icon: '🧠' }, { key: 'Schedule', icon: '📅' },
  { key: 'League', icon: '🏆' }, { key: 'Stats', icon: '📊' }, { key: 'Free Agents', icon: '🛒' }, { key: 'Finance', icon: '💰' },
  { key: 'Development', icon: '📈' }, { key: 'Staff', icon: '🧑‍💼' }, { key: 'News', icon: '📰' }, { key: 'Settings', icon: '⚙️' }
];

const initialSeed = 2026;
const MIN_GAMES = 5;
const teamAccents: Record<string, string> = { bay: '#f7c845', san: '#4db5ff', cag: '#ef5e5e', car: '#5de2af', gua: '#6a8bff', man: '#ff9c4d', may: '#90e6ff', que: '#a778ff', pon: '#ff5d85', are: '#69daff', sgm: '#f67f4f', agu: '#84dd8f' };

function App() {
  const [state, setState] = useState<GameState>(() => createNewGameState(initialSeed));
  const [currentSave, setCurrentSave] = useState<FullSave | null>(null);
  const [view, setView] = useState<'main_menu'|'new_game'|'team_select'|'save_manager'|'in_game'>('main_menu');
  const [newSaveName, setNewSaveName] = useState('My BSN Career');
  const [statusMessage, setStatusMessage] = useState('');
  const [activeSection, setActiveSection] = useState<AppSection>('Dashboard');
  const [simOption, setSimOption] = useState<SimWindow>('next_game');
  const [rosterSort, setRosterSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'overall', direction: 'desc' });
  const [rosterFilter, setRosterFilter] = useState('');

  useEffect(() => {
    const activeId = getActiveSaveId(); if (!activeId) return;
    const loaded = loadSave(activeId); if (!loaded) return;
    setCurrentSave(loaded); setState(loaded.coreState);
  }, []);

  const persist = (next: GameState, message?: string): void => {
    setState(next);
    if (currentSave) {
      const updated = { ...currentSave, coreState: next, teams: next.teams, schedule: next.schedule, stats: next.stats, transactions: next.transactions, gameState: { ...currentSave.gameState, currentDate: next.currentDate, phase: next.phase, seasonYear: next.seasonYear } };
      autosaveCurrentSave(updated); setCurrentSave(updated);
    }
    if (message) setStatusMessage(message);
  };

  const standings = useMemo(() => toStandingRows(state.teams), [state.teams]);
  const teamNameById = useMemo(() => new Map(initialTeams.map((t) => [t.id, t.name])), []);
  const remainingGames = state.schedule.filter((g) => !g.played).length;
  const selectedScheduledResult = state.selectedScheduledGameId === null ? null : state.schedule.find((scheduled) => scheduled.id === state.selectedScheduledGameId)?.result ?? null;
  const displayedGame = selectedScheduledResult ?? state.lastGame;
  const userTeam = state.selectedTeamId ? state.teams.find((team) => team.id === state.selectedTeamId) ?? state.teams[0] : state.teams[0];
  const selectedPlayer = state.selectedPlayerId ? initialPlayers.find((player) => player.id === state.selectedPlayerId) ?? null : null;
  const nextGame = findNextUnplayedGameForTeam(state, state.selectedTeamId);

  const leaderRows = useMemo(() => initialPlayers.map((player) => {
    const s = state.stats.regularPlayerStats[player.id];
    return { player, gamesPlayed: s.gamesPlayed, ppg: s.gamesPlayed ? s.points / s.gamesPlayed : 0, rpg: s.gamesPlayed ? s.rebounds / s.gamesPlayed : 0, apg: s.gamesPlayed ? s.assists / s.gamesPlayed : 0 };
  }).filter((r) => r.gamesPlayed > 0), [state.stats.regularPlayerStats]);

  const injuryRows = useMemo(() => Object.values(state.runtimePlayers).filter((p) => p.injury).sort((a, b) => (b.injury?.gamesRemaining ?? 0) - (a.injury?.gamesRemaining ?? 0)), [state.runtimePlayers]);
  const userTeamStats = state.stats.regularTeamStats[userTeam.id];
  const userRoster = initialPlayers.filter((p) => p.teamId === userTeam.id);
  const conferenceRows = standings.filter((row) => row.conference === userTeam.conference);
  const userTeamStanding = conferenceRows.findIndex((row) => row.id === userTeam.id) + 1;

  const teamPayroll = userRoster.reduce((sum, p) => sum + (state.runtimePlayers[p.id]?.salary ?? 0), 0);
  const importCount = userRoster.filter((p) => p.isImport).length;

  const rosterRows = useMemo(() => {
    const rows = userRoster.map((player) => {
      const rp = state.runtimePlayers[player.id]; const stats = state.stats.regularPlayerStats[player.id];
      return { ...player, overall: calculatePlayerOverall(player), positionOveralls: calculateAllPositionOveralls(player), potential: Math.min(99, Math.round((player.ratings.hustle + player.ratings.stamina + player.ratings.offensiveIQ + player.ratings.defensiveIQ) / 4 + 5)), minutes: rp?.minutesOverride ?? player.minutesTarget, ppg: stats.gamesPlayed ? stats.points / stats.gamesPlayed : 0, rpg: stats.gamesPlayed ? stats.rebounds / stats.gamesPlayed : 0, apg: stats.gamesPlayed ? stats.assists / stats.gamesPlayed : 0, status: rp?.availability ?? 'active', fatigue: rp?.fatigue ?? 0, health: rp?.injury ? `Injured (${rp.injury.gamesRemaining})` : 'Healthy' };
    }).filter((row) => row.displayName.toLowerCase().includes(rosterFilter.toLowerCase()));
    const dir = rosterSort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, number | string>)[rosterSort.key]; const bv = (b as unknown as Record<string, number | string>)[rosterSort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [userRoster, state.runtimePlayers, state.stats.regularPlayerStats, rosterFilter, rosterSort]);

  const top = <T,>(rows: T[], sortFn: (a: T, b: T) => number) => [...rows].sort(sortFn).slice(0, 10);
  const lastFive = state.schedule.filter((g) => g.played && (g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)).slice(-5);
  const hottest = top(leaderRows.filter((r) => userRoster.some((p) => p.id === r.player.id)), (a, b) => b.ppg - a.ppg)[0];
  const coldest = top(leaderRows.filter((r) => userRoster.some((p) => p.id === r.player.id)), (a, b) => a.ppg - b.ppg)[0];

  const renderDashboard = () => <div className="cards-grid">{[
    ['Team Record', `${userTeamStats.wins}-${userTeamStats.losses}`],
    ['Conference Standing', userTeamStanding ? `#${userTeamStanding} in ${userTeam.conference}` : 'N/A'],
    ['Next Opponent', nextGame ? `${teamNameById.get(nextGame.awayTeamId)} @ ${teamNameById.get(nextGame.homeTeamId)}` : 'Season complete'],
    ['Salary Cap', `$${Math.round(teamPayroll).toLocaleString()} / $${state.league.salaryCap.toLocaleString()}`],
    ['Import Slots', `${importCount}/${state.league.maxImports} used`],
    ['Hot Player', hottest ? `${hottest.player.displayName} (${hottest.ppg.toFixed(1)} PPG)` : 'No games'],
    ['Cold Player', coldest ? `${coldest.player.displayName} (${coldest.ppg.toFixed(1)} PPG)` : 'No games'],
    ['Injuries', `${injuryRows.filter((i) => userRoster.some((p) => p.id === i.playerId)).length} active`]
  ].map(([title, value]) => <article className="card" key={title}><h3>{title}</h3><p>{value}</p></article>)}
  <article className="card card-wide"><h3>Last 5 Games</h3><ul>{lastFive.length ? lastFive.map((g) => <li key={g.id}>{g.date} · {teamNameById.get(g.awayTeamId)} {g.awayScore} - {g.homeScore} {teamNameById.get(g.homeTeamId)}</li>) : <li>No recent games.</li>}</ul></article>
</div>;

  const renderRoster = () => <section>
    <div className="section-head"><h2>Roster Management</h2><div className="toolbar"><input placeholder="Filter player..." value={rosterFilter} onChange={(e) => setRosterFilter(e.target.value)} /></div></div>
    <div className="table-wrap"><table className="premium-table"><thead><tr>{['displayName','position','role','overall','minutes','ppg','rpg','apg','fatigue','health','status'].map((col) => <th key={col}><button className="sort-btn" onClick={() => setRosterSort((prev) => ({ key: col, direction: prev.key === col && prev.direction === 'desc' ? 'asc' : 'desc' }))}>{col.toUpperCase()}</button></th>)}</tr></thead>
      <tbody>{rosterRows.map((row) => <tr key={row.id} onClick={() => setState((s) => ({ ...s, selectedPlayerId: row.id }))}><td><strong>{row.displayName}</strong><span className="sub">{row.nationality} · {row.age} yrs</span></td><td><span className="badge">{row.position}</span></td><td>{row.role}</td><td><strong>{row.overall}</strong><span className="sub">PG {row.positionOveralls.PG} · SG {row.positionOveralls.SG} · SF {row.positionOveralls.SF} · PF {row.positionOveralls.PF} · C {row.positionOveralls.C}</span></td><td>{row.minutes}</td><td>{row.ppg.toFixed(1)}</td><td>{row.rpg.toFixed(1)}</td><td>{row.apg.toFixed(1)}</td><td>{row.fatigue.toFixed(1)}</td><td>{row.health}</td><td><span className="badge">{row.isImport ? 'Import' : 'Native'}</span> <span className="badge">{row.status}</span></td></tr>)}</tbody></table></div>
  </section>;

  const renderSection = () => {
    if (activeSection === 'Dashboard') return renderDashboard();
    if (activeSection === 'Roster') return renderRoster();
    if (activeSection === 'Rotation') return <TeamPage team={userTeam} roster={userRoster} runtimePlayers={state.runtimePlayers} regularStats={state.stats.regularTeamStats[userTeam.id]} playoffStats={state.stats.playoffTeamStats[userTeam.id]} schedule={state.schedule.filter((g) => g.homeTeamId === userTeam.id || g.awayTeamId === userTeam.id)} teamNameById={teamNameById} validationErrors={validateTeamRotation(state, userTeam.id).errors} onPlayerClick={(playerId) => setState((s) => ({ ...s, selectedPlayerId: playerId }))} onStarterToggle={(playerId, starter) => persist(updatePlayerStarter(state, userTeam.id, playerId, starter), 'Updated starter.')} onAvailabilityChange={(playerId, status) => persist(updatePlayerAvailability(state, playerId, status), 'Updated availability.')} onMinutesChange={(playerId, minutes) => persist(updatePlayerMinutesTarget(state, playerId, Number.isFinite(minutes) ? minutes : null), 'Updated minutes target.')} onAutoRotation={() => persist(autoConfigureTeamRotation(state, userTeam.id), 'Auto rotation applied.')} onBack={() => undefined} />;
    if (activeSection === 'Schedule') return <section><div className="section-head"><h2>My Team Schedule</h2></div><div className="table-wrap"><table className="premium-table"><thead><tr><th>Date</th><th>#</th><th>Matchup</th><th>Status</th><th>Action</th></tr></thead><tbody>{state.schedule.map((sg) => <tr key={sg.id}><td>{sg.date}</td><td>{sg.gameNumber}</td><td>{teamNameById.get(sg.awayTeamId)} @ {teamNameById.get(sg.homeTeamId)}</td><td>{sg.played ? `${sg.awayScore} - ${sg.homeScore}` : 'Upcoming'}</td><td><button onClick={() => persist(simulateScheduledGame(state, sg.id), `Game #${sg.gameNumber} simulated.`)} disabled={sg.played}>Simulate</button></td></tr>)}</tbody></table></div></section>;
    if (activeSection === 'League') return <div className="grid"><StandingsTable title="Conference A" rows={standings} conference="A" onTeamClick={() => undefined} /><StandingsTable title="Conference B" rows={standings} conference="B" onTeamClick={() => undefined} /></div>;
    if (activeSection === 'Stats') return <section><h2>League Leaders</h2><article className="card"><h3>Points Per Game</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.ppg - a.ppg).map((r) => <li key={r.player.id}>{r.player.displayName} — {r.ppg.toFixed(1)}</li>)}</ol></article></section>;
    return <section><h2>{activeSection}</h2><p>Module scaffold ready for BSN management workflows.</p></section>;
  };

  if (view !== 'in_game') return <main className="menu-shell"><section className="menu-card">{view === 'main_menu' ? <><h1>BSN Franchise Mode</h1><button disabled={!getCurrentSave()} onClick={() => { const loaded = getCurrentSave(); if (!loaded) return; setCurrentSave(loaded); setState(loaded.coreState); setView('in_game'); }}>Continue</button><button onClick={() => setView('new_game')}>New Game</button><button onClick={() => setView('save_manager')}>Load Game</button></> : null}
    {view === 'new_game' ? <><h2>Create New Game</h2><input value={newSaveName} onChange={(e)=>setNewSaveName(e.target.value)} placeholder="Save Name" /><button onClick={() => setView('team_select')}>Next: Choose Your Team</button><button onClick={()=>setView('main_menu')}>Back</button></> : null}
    {view === 'team_select' ? <><h2>Choose Your Team</h2><div className="cards-grid">{initialTeams.map((t)=><article key={t.id} className="card"><h3>{t.name}</h3><p>{t.city}</p><button onClick={()=>{ const next=createNewGameState(initialSeed); next.selectedTeamId=t.id; const full=createNewSave(newSaveName||`${t.name} Career`, t.id, next, initialPlayers); setCurrentSave(full); setState(full.coreState); setActiveSave(full.saveId); setView('in_game'); setStatusMessage('New save created.'); }}>Start Career</button></article>)}</div><button onClick={()=>setView('new_game')}>Back</button></> : null}
    {view === 'save_manager' ? <><h2>Save Manager</h2>{getSavesIndex().map((s)=><article key={s.saveId} className="card"><h3>{s.saveName}</h3><p>{s.teamName} | {s.currentDate} | {s.record}</p><button onClick={()=>{ const loaded=loadSave(s.saveId); if(!loaded) return; setCurrentSave(loaded); setState(loaded.coreState); setActiveSave(s.saveId); setView('in_game'); }}>Continue</button><button onClick={()=>{ const n=prompt('Rename save', s.saveName); if(n) renameSave(s.saveId,n); setView('save_manager'); }}>Rename</button><button onClick={()=>{ duplicateSave(s.saveId); setView('save_manager'); }}>Duplicate</button><button onClick={()=>{ if(confirm('Delete this save?')) { deleteSave(s.saveId); setView('save_manager'); } }}>Delete</button></article>)}<button onClick={()=>setView('main_menu')}>Back</button></> : null}</section></main>;

  return <main className="app-shell" style={{ ['--team-accent' as string]: teamAccents[userTeam.id] ?? '#4aa3ff' }}>
    <header className="top-nav">
      <div><strong>{userTeam.name}</strong><span className="sub">{currentSave?.saveName ?? 'Unsaved'}</span></div>
      <div><strong>{userTeamStats.wins}-{userTeamStats.losses}</strong><span className="sub">Record</span></div>
      <div><strong>{state.currentDate}</strong><span className="sub">{state.phase}</span></div>
      <div><strong>{nextGame ? `${teamNameById.get(nextGame.awayTeamId)} @ ${teamNameById.get(nextGame.homeTeamId)}` : 'Complete'}</strong><span className="sub">Next Game</span></div>
      <div className="sim-controls"><select value={simOption} onChange={(e) => setSimOption(e.target.value as SimWindow)}><option value="next_game">Next Game</option><option value="one_day">1 Day</option><option value="one_week">1 Week</option><option value="one_month">1 Month</option><option value="rest_regular_season">Rest Season</option><option value="until_playoffs">Until Playoffs</option><option value="full_season">Full Season</option></select><button onClick={() => persist(simulateByWindow(state, simOption), 'Simulation complete.')} disabled={remainingGames === 0 && simOption !== 'full_season'}>Simulate</button></div>
    </header>
    <div className="layout"><aside className="left-sidebar">{sections.map((section) => <button key={section.key} className={activeSection === section.key ? 'active' : ''} onClick={() => setActiveSection(section.key)}><span>{section.icon}</span> {section.key}</button>)}</aside>
      <section className="content-area">{statusMessage ? <p className="status">{statusMessage}</p> : null}{renderSection()}{displayedGame ? <section><h2>Latest Box Score</h2><div className="grid"><BoxScoreTable box={displayedGame.away} /><BoxScoreTable box={displayedGame.home} /></div></section> : null}</section>
      <aside className="right-panel"><h3>Context Panel</h3><p className="badge">Cap ${state.league.salaryCap.toLocaleString()}</p><p className="badge">Imports {importCount}/{state.league.maxImports}</p><h3>Injuries</h3><ul>{injuryRows.slice(0, 5).map((row) => { const player = initialPlayers.find((p) => p.id === row.playerId); return player && row.injury ? <li key={row.playerId}>{player.displayName}: {row.injury.type} ({row.injury.gamesRemaining})</li> : null; })}</ul><h3>News</h3><p>{state.lastGame ? 'Latest result posted.' : 'No news yet.'}</p></aside></div>
    {selectedPlayer ? <div className="modal-overlay" onClick={() => setState((s) => ({ ...s, selectedPlayerId: null }))}><div className="modal-content" onClick={(e) => e.stopPropagation()}><PlayerProfile player={selectedPlayer} teamName={teamNameById.get(selectedPlayer.teamId) ?? selectedPlayer.teamId} regularStats={state.stats.regularPlayerStats[selectedPlayer.id]} playoffStats={state.stats.playoffPlayerStats[selectedPlayer.id]} gameLogs={state.stats.playerGameLogs[selectedPlayer.id] ?? []} teamNameById={teamNameById} onBack={() => setState((s) => ({ ...s, selectedPlayerId: null }))} /></div></div> : null}
    <footer className="footer-controls"><button onClick={() => { if (!currentSave) return; const updated = { ...currentSave, coreState: state }; saveGame(updated); setCurrentSave(updated); setStatusMessage('Game saved.'); }}>Save Game</button><button onClick={() => persist(simulateNextPlayoffSeriesForState(state), 'Simulated next playoff series.')} disabled={!state.playoffBracket}>Sim Next Playoff Series</button><button onClick={() => setView('main_menu')}>Exit to Main Menu</button><small>Rules: {leagueRules.game.numPeriods} x {leagueRules.game.quarterLength} min</small></footer>
  </main>;
}

export default App;
