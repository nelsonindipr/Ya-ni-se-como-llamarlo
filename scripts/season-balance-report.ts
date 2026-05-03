import { balanceTargets, evaluateQualityGates, runSeasonMetrics, summarizeMetrics } from './balance-audit-core.ts';

type CliOptions = { seasons: number; seedStart: number; json: boolean };

const parseArgs = (argv: string[]): CliOptions => {
  const options: CliOptions = { seasons: 100, seedStart: 1000, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--seasons') options.seasons = Number(argv[++i]);
    else if (arg === '--seedStart') options.seedStart = Number(argv[++i]);
    else if (arg === '--json') options.json = true;
  }
  return options;
};

const opts = parseArgs(process.argv.slice(2));
const seasons = runSeasonMetrics(opts.seasons, opts.seedStart);
const summary = summarizeMetrics(seasons);
const gates = evaluateQualityGates(summary);

const payload = {
  seasons: opts.seasons,
  seedStart: opts.seedStart,
  targets: balanceTargets,
  summary,
  percentSeasonsOutsideTargetRange: Object.fromEntries(balanceTargets.map((t) => [t.key, summary[t.key].outOfRangePercent])),
  worstOffendingMetric: gates.worstOffendingMetric,
  pass: gates.pass,
  failures: gates.failures
};

if (opts.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(`Balance audit over ${opts.seasons} seasons (seedStart=${opts.seedStart})`);
  for (const t of balanceTargets) {
    const s = summary[t.key];
    console.log(
      `${t.label}: mean=${s.mean.toFixed(3)} median=${s.median.toFixed(3)} stdev=${s.stdev.toFixed(3)} min=${s.min.toFixed(3)} max=${s.max.toFixed(3)} out=${s.outOfRangePercent.toFixed(1)}%`
    );
  }
  console.log(`Worst offending metric: ${gates.worstOffendingMetric} (${gates.worstOffendingPercent.toFixed(1)}%)`);
  console.log(gates.pass ? 'QUALITY GATES: PASS' : `QUALITY GATES: FAIL\n - ${gates.failures.join('\n - ')}`);
}

process.exitCode = gates.pass ? 0 : 1;
