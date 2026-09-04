import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { fromSettings, runBacktest, type BacktestHorizon, type BacktestResult } from "@/lib/engine/backtest";
import { formatMoney, formatSigned, formatSim, pnlClass } from "@/lib/engine/format";
import { useEngineStore } from "@/lib/engine/store";
import { SYMBOL_LIST } from "@/lib/engine/symbols";
import { cn } from "@/lib/utils";

const HORIZONS: { id: BacktestHorizon; label: string }[] = [
  { id: "15m", label: "15 min" },
  { id: "1h", label: "1 heure" },
  { id: "4h", label: "4 heures" },
];

const TICKS = [
  { ms: 20, label: "20 ms" },
  { ms: 50, label: "50 ms" },
  { ms: 100, label: "100 ms" },
];

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-3">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 num text-base", tone)}>{value}</p>
    </div>
  );
}

export function BacktestView() {
  const settings = useEngineStore((s) => s.settings);
  const leverage = useEngineStore((s) => s.mt5.leverage);
  const [horizon, setHorizon] = useState<BacktestHorizon>("1h");
  const [tickMs, setTickMs] = useState(50);
  const [seed, setSeed] = useState(202609);
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [error, setError] = useState("");

  const chart = useMemo(
    () => (result ? result.equity.map((p) => ({ t: p.t, equity: p.equity })) : []),
    [result],
  );
  const up = (result?.netPnl ?? 0) >= 0;

  async function onRun() {
    setError("");
    setRunning(true);
    setPct(0);
    setResult(null);
    try {
      const input = fromSettings(settings, leverage || 500, { horizon, tickMs, seed });
      const out = await runBacktest(input, (p) => setPct(p));
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backtest interrompu");
    } finally {
      setRunning(false);
      setPct(1);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs tracking-[0.22em] text-muted">REPLAY TICK</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Backtest haute fréquence</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Même moteur qu’en live, rejoué en ticks sous M1. Des dizaines de milliers
          de ticks en quelques secondes — pas de barres M1.
        </p>
      </div>

      <Panel className="space-y-5">
        <PanelTitle>Scénario</PanelTitle>
        <div>
          <Label>Horizon simulé</Label>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {HORIZONS.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHorizon(h.id)}
                className={cn(
                  "h-11 rounded-sm border text-sm transition-colors duration-[var(--motion-quick)]",
                  horizon === h.id ? "border-accent bg-surface-2" : "border-border",
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Cadence tick</Label>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {TICKS.map((t) => (
              <button
                key={t.ms}
                type="button"
                onClick={() => setTickMs(t.ms)}
                className={cn(
                  "h-11 rounded-sm border text-sm transition-colors duration-[var(--motion-quick)]",
                  tickMs === t.ms ? "border-accent bg-surface-2" : "border-border",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="seed">Seed (reproductible)</Label>
            <Input
              id="seed"
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lots / mode</Label>
            <p className="flex h-11 items-center rounded-sm border border-border bg-bg px-3 text-sm">
              {settings.lotSize.toFixed(2)} · {settings.powerMode.toUpperCase()} · {settings.timeframe.toUpperCase()}
            </p>
          </div>
        </div>
        <p className="text-xs text-faint">
          Symboles actifs : {SYMBOL_LIST.filter((s) => settings.symbols[s.id]).map((s) => s.id).join(" · ") || "aucun"}
        </p>
        {running ? (
          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full bg-accent" style={{ width: `${Math.round(pct * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">Replay {Math.round(pct * 100)}%</p>
          </div>
        ) : null}
        {error ? <p className="text-sm text-loss">{error}</p> : null}
        <Button className="w-full" onClick={onRun} disabled={running}>
          {running ? "Replay en cours…" : "Lancer le backtest HF"}
        </Button>
      </Panel>

      {result ? (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="P/L net" value={formatSigned(result.netPnl)} tone={pnlClass(result.netPnl)} />
            <Stat label="Équité finale" value={formatMoney(result.endEquity)} />
            <Stat label="Trades" value={`${result.trades}`} />
            <Stat label="Win rate" value={`${result.winRate.toFixed(1)}%`} />
            <Stat label="Profit factor" value={result.profitFactor.toFixed(2)} />
            <Stat label="Max DD" value={formatMoney(result.maxDrawdown)} tone="text-loss" />
            <Stat label="Hold moyen" value={`${Math.round(result.avgHoldMs / 1000)} s`} />
            <Stat label="Cibles +55" value={`${result.targetHits}`} />
          </div>

          <Panel>
            <div className="mb-3 flex items-center justify-between gap-3">
              <PanelTitle>Courbe d’équité</PanelTitle>
              <span className="text-xs text-muted">
                {result.ticks.toLocaleString("fr-FR")} ticks · {Math.round(result.ticksPerSec).toLocaleString("fr-FR")} t/s
              </span>
            </div>
            <div className="h-48 w-full md:h-64">
              {chart.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <YAxis hide domain={["dataMin", "dataMax"]} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(v) => formatMoney(Number(v ?? 0))}
                      labelFormatter={() => ""}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke={up ? "var(--color-profit)" : "var(--color-loss)"}
                      fill={up ? "var(--color-profit)" : "var(--color-loss)"}
                      fillOpacity={0.12}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-faint">
              Wall {result.wallMs.toFixed(0)} ms pour {Math.round(result.simMs / 60000)} min simulées.
            </p>
          </Panel>

          <Panel>
            <PanelTitle>Par symbole</PanelTitle>
            <ul className="mt-3 space-y-2">
              {result.bySymbol.map((row) => (
                <li key={row.symbol} className="flex items-center justify-between rounded-sm bg-surface-2 px-3 py-2 text-sm">
                  <span>
                    {row.symbol} · {row.trades} trades
                  </span>
                  <span className={cn("num", pnlClass(row.pnl))}>{formatSigned(row.pnl)}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <PanelTitle>Dernières clôtures</PanelTitle>
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto">
              {result.recent.length === 0 ? (
                <li className="text-sm text-faint">Aucun trade</li>
              ) : (
                result.recent.map((t) => (
                  <li key={t.id} className="flex gap-3 text-xs">
                    <span className="num w-16 shrink-0 text-faint">{formatSim(t.closedAt)}</span>
                    <span className="flex-1">
                      {t.reason.toUpperCase()} {t.symbol} {t.side.toUpperCase()}
                    </span>
                    <span className={cn("num", pnlClass(t.pnl))}>{formatSigned(t.pnl)}</span>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </>
      ) : null}
    </div>
  );
}
