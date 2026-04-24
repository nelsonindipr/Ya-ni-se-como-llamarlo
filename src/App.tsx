import { useEffect, useMemo, useState } from 'react';
import './styles.css';
import { BoxScoreTable } from './components/BoxScoreTable';
import { PlayerProfile } from './components/PlayerProfile';
import { StandingsTable } from './components/StandingsTable';
import { TeamPage } from './components/TeamPage';
import { initialPlayers } from './data/players';
import { initialTeams } from './data/teams';
import { leagueRules } from './domain/rules';
import { pct } from './simulation/stats';
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

const initialSeed = 2026;
const MIN_GAMES = 5;

function App() {
  const [state, setState] = useState<GameState>(() => createNewGameState(initialSeed));
  const [statusMessage, setStatusMessage] = useState('');

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
  const selectedScheduledResult =
    state.selectedScheduledGameId === null
      ? null
      : state.schedule.find((scheduled) => scheduled.id === state.selectedScheduledGameId)?.result ?? null;
  const displayedGame = selectedScheduledResult ?? state.lastGame;

  const selectedTeam = state.selectedTeamId ? state.teams.find((team) => team.id === state.selectedTeamId) ?? null : null;
  const selectedPlayer = state.selectedPlayerId
    ? initialPlayers.find((player) => player.id === state.selectedPlayerId) ?? null
    : null;

  const leaderRows = useMemo(() => {
    return initialPlayers
      .map((player) => {
        const s = state.stats.regularPlayerStats[player.id];
        return {
          player,
          gamesPlayed: s.gamesPlayed,
          ppg: s.gamesPlayed ? s.points / s.gamesPlayed : 0,
          rpg: s.gamesPlayed ? s.rebounds / s.gamesPlayed : 0,
          apg: s.gamesPlayed ? s.assists / s.gamesPlayed : 0
        };
      })
      .filter((r) => r.gamesPlayed > 0);
  }, [state.stats.regularPlayerStats]);

  const injuryRows = useMemo(
    () =>
      Object.values(state.runtimePlayers)
        .filter((p) => p.injury)
        .sort((a, b) => (b.injury?.gamesRemaining ?? 0) - (a.injury?.gamesRemaining ?? 0)),
    [state.runtimePlayers]
  );

  const activeTeamPayrolls = useMemo(() => {
    return initialTeams
      .map((team) => {
        const roster = initialPlayers.filter((p) => p.teamId === team.id);
        const payroll = roster.reduce((sum, p) => sum + (state.runtimePlayers[p.id]?.salary ?? 0), 0);
        const imports = roster.filter((p) => p.isImport).length;
        return { team, payroll, imports };
      })
      .sort((a, b) => b.payroll - a.payroll);
  }, [state.runtimePlayers]);

  const top = <T,>(rows: T[], sortFn: (a: T, b: T) => number) => [...rows].sort(sortFn).slice(0, 10);

  if (selectedPlayer) {
    const team = initialTeams.find((item) => item.id === selectedPlayer.teamId);
    return (
      <main>
        <h1>BSN GM Simulation — Foundation Build</h1>
        <PlayerProfile
          player={selectedPlayer}
          teamName={team?.name ?? selectedPlayer.teamId}
          regularStats={state.stats.regularPlayerStats[selectedPlayer.id]}
          playoffStats={state.stats.playoffPlayerStats[selectedPlayer.id]}
          gameLogs={state.stats.playerGameLogs[selectedPlayer.id] ?? []}
          teamNameById={teamNameById}
          onBack={() => setState((s) => ({ ...s, selectedPlayerId: null }))}
        />
      </main>
    );
  }

  if (selectedTeam) {
    const validation = validateTeamRotation(state, selectedTeam.id);
    return (
      <main>
        <h1>BSN GM Simulation — Foundation Build</h1>
        <TeamPage
          team={selectedTeam}
          roster={initialPlayers.filter((player) => player.teamId === selectedTeam.id)}
          runtimePlayers={state.runtimePlayers}
          regularStats={state.stats.regularTeamStats[selectedTeam.id]}
          playoffStats={state.stats.playoffTeamStats[selectedTeam.id]}
          schedule={state.schedule.filter((g) => g.homeTeamId === selectedTeam.id || g.awayTeamId === selectedTeam.id)}
          teamNameById={teamNameById}
          validationErrors={validation.errors}
          onPlayerClick={(playerId) => setState((s) => ({ ...s, selectedPlayerId: playerId, selectedTeamId: null }))}
          onStarterToggle={(playerId, starter) =>
            persist(updatePlayerStarter(state, selectedTeam.id, playerId, starter), 'Updated starter.')
          }
          onAvailabilityChange={(playerId, status) =>
            persist(updatePlayerAvailability(state, playerId, status), 'Updated availability.')
          }
          onMinutesChange={(playerId, minutes) =>
            persist(updatePlayerMinutesTarget(state, playerId, Number.isFinite(minutes) ? minutes : null), 'Updated minutes target.')
          }
          onAutoRotation={() => persist(autoConfigureTeamRotation(state, selectedTeam.id), 'Auto rotation applied.')}
          onBack={() => setState((s) => ({ ...s, selectedPlayerId: null, selectedTeamId: null }))}
        />
      </main>
    );
  }

  return (
    <main>
      <h1>BSN GM Simulation — Foundation Build</h1>
      <p>
        Phase: <strong>{state.phase}</strong> | Date: <strong>{state.currentDate}</strong> | Season: <strong>{state.seasonYear}</strong>
      </p>
      <p>
        Rules: {leagueRules.game.numPeriods} x {leagueRules.game.quarterLength}-minute quarters | Salary Cap Placeholder: ${state.league.salaryCap.toLocaleString()}
      </p>

      <section>
        <h2>Dashboard</h2>
        <div className="selectors">
          <button type="button" onClick={() => persist(simulateByWindow(state, 'next_game'), 'Simulated next game and auto-saved.')} disabled={remainingGames === 0}>
            Sim Next Game
          </button>
          <button type="button" onClick={() => persist(simulateByWindow(state, 'one_day'), 'Simulated one day and auto-saved.')}>Sim 1 Day</button>
          <button type="button" onClick={() => persist(simulateByWindow(state, 'one_week'), 'Simulated one week and auto-saved.')}>Sim 1 Week</button>
          <button type="button" onClick={() => persist(simulateByWindow(state, 'one_month'), 'Simulated one month and auto-saved.')}>Sim 1 Month</button>
          <button type="button" onClick={() => persist(simulateByWindow(state, 'rest_regular_season'), 'Simulated rest of regular season.') } disabled={remainingGames === 0}>
            Sim Rest Regular Season
          </button>
          <button type="button" onClick={() => persist(simulateByWindow(state, 'until_playoffs'), 'Simulated through playoffs stage.')}>
            Sim Until Playoffs
          </button>
          <button type="button" onClick={() => persist(simulateByWindow(state, 'full_season'), 'Simulated full season and playoffs.')}>
            Sim Full Season
          </button>
          <button type="button" onClick={() => persist(simulateNextPlayoffSeriesForState(state), 'Simulated next playoff series.')} disabled={!state.playoffBracket}>
            Sim Next Playoff Series
          </button>
          <button type="button" onClick={() => { saveSeasonState(state); setStatusMessage('Season saved.'); }}>Save</button>
          <button type="button" onClick={() => { const loaded = loadSeasonState(); if (loaded) { setState(loaded); setStatusMessage('Season loaded.'); } }}>Load</button>
          <button type="button" onClick={() => { clearSeasonState(); const next = createNewGameState(initialSeed); setState(next); setStatusMessage('Season reset.'); }}>New Game</button>
        </div>
        {statusMessage ? <p>{statusMessage}</p> : null}
        <p>Regular season games: {state.schedule.length} | Remaining: {remainingGames}</p>
      </section>

      <section>
        <h2>Schedule</h2>
        <table>
          <thead>
            <tr><th>Date</th><th>#</th><th>Away</th><th>Home</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {state.schedule.map((sg) => (
              <tr key={sg.id}>
                <td>{sg.date}</td>
                <td>{sg.gameNumber}</td>
                <td>{teamNameById.get(sg.awayTeamId)}</td>
                <td>{teamNameById.get(sg.homeTeamId)}</td>
                <td>{sg.played ? `${sg.awayScore} - ${sg.homeScore}` : 'Unplayed'}</td>
                <td>
                  <button type="button" onClick={() => persist(simulateScheduledGame(state, sg.id), `Game #${sg.gameNumber} simulated.`)} disabled={sg.played}>
                    Simulate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {displayedGame ? <section><h2>Latest Box Score</h2><div className="grid"><BoxScoreTable box={displayedGame.away} /><BoxScoreTable box={displayedGame.home} /></div></section> : null}

      <section>
        <h2>Standings</h2>
        <div className="grid">
          <StandingsTable title="Conference A" rows={standings} conference="A" onTeamClick={(teamId) => setState((s) => ({ ...s, selectedTeamId: teamId }))} />
          <StandingsTable title="Conference B" rows={standings} conference="B" onTeamClick={(teamId) => setState((s) => ({ ...s, selectedTeamId: teamId }))} />
        </div>
      </section>

      <section>
        <h2>League Leaders (Regular Season)</h2>
        <div className="grid">
          <div><h3>Points (min {MIN_GAMES} GP)</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.ppg - a.ppg).map((r) => <li key={`ppg-${r.player.id}`}>{r.player.name} {r.ppg.toFixed(1)} PPG</li>)}</ol></div>
          <div><h3>Rebounds</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.rpg - a.rpg).map((r) => <li key={`rpg-${r.player.id}`}>{r.player.name} {r.rpg.toFixed(1)} RPG</li>)}</ol></div>
          <div><h3>Assists</h3><ol>{top(leaderRows.filter((r) => r.gamesPlayed >= MIN_GAMES), (a, b) => b.apg - a.apg).map((r) => <li key={`apg-${r.player.id}`}>{r.player.name} {r.apg.toFixed(1)} APG</li>)}</ol></div>
        </div>
      </section>

      <section>
        <h2>Injuries & Fatigue</h2>
        <p>Currently injured players: {injuryRows.length}</p>
        <table><thead><tr><th>Player</th><th>Team</th><th>Injury</th><th>Games Out</th><th>Fatigue</th></tr></thead><tbody>
          {injuryRows.slice(0, 25).map((row) => {
            const player = initialPlayers.find((p) => p.id === row.playerId);
            if (!player || !row.injury) return null;
            return <tr key={row.playerId}><td>{player.displayName}</td><td>{teamNameById.get(player.teamId)}</td><td>{row.injury.type}</td><td>{row.injury.gamesRemaining}</td><td>{row.fatigue.toFixed(1)}</td></tr>;
          })}
        </tbody></table>
      </section>

      <section>
        <h2>Team Payroll & Imports</h2>
        <table><thead><tr><th>Team</th><th>Payroll</th><th>Cap Space</th><th>Imports</th><th>Import Rule</th></tr></thead><tbody>
          {activeTeamPayrolls.map((row) => (
            <tr key={row.team.id}><td>{row.team.name}</td><td>${Math.round(row.payroll).toLocaleString()}</td><td>${Math.round(state.league.salaryCap - row.payroll).toLocaleString()}</td><td>{row.imports}</td><td>{row.imports <= state.league.maxImports ? 'OK' : 'Over limit'}</td></tr>
          ))}
        </tbody></table>
      </section>

      <section>
        <h2>Team Season Stats</h2>
        <table><thead><tr><th>Team</th><th>GP</th><th>W-L</th><th>PF</th><th>PA</th><th>FG%</th><th>3P%</th><th>FT%</th></tr></thead><tbody>
          {initialTeams.map((team) => {
            const reg = state.stats.regularTeamStats[team.id];
            return <tr key={`${team.id}-reg`}><td>{team.name}</td><td>{reg.gamesPlayed}</td><td>{reg.wins}-{reg.losses}</td><td>{reg.pointsFor}</td><td>{reg.pointsAgainst}</td><td>{(pct(reg.fgm, reg.fga) * 100).toFixed(1)}%</td><td>{(pct(reg.tpm, reg.tpa) * 100).toFixed(1)}%</td><td>{(pct(reg.ftm, reg.fta) * 100).toFixed(1)}%</td></tr>;
          })}
        </tbody></table>
      </section>
    </main>
  );
}

export default App;
