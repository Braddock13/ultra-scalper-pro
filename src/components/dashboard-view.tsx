import { Link } from "@tanstack/react-router";
import { Play, Pause, Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { TickChart } from "@/components/tick-chart";
import { EquitySpark } from "@/components/equity-spark";
import { useEngineStore } from "@/lib/engine/store";
import { SYMBOL_LIST, SYMBOL_MAP } from "@/lib/engine/symbols";
import { formatLots, formatMoney, formatPrice, formatSigned, formatTime, pnlClass } from "@/lib/engine/format";
import { resetBooks } from "@/lib/engine/runtime";
import { cn } from "@/lib/utils";

function HudCell({
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
      <p className="text-[0.65rem] uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("mt-1 num text-base md:text-lg", tone)}>{value}</p>
    </div>
  );
}

export function DashboardView() {
  const mt5 = useEngineStore((s) => s.mt5);
  const engine = useEngineStore((s) => s.engine);
  const account = useEngineStore((s) => s.account);
  const settings = useEngineStore((s) => s.settings);
  const quotes = useEngineStore((s) => s.quotes);
  const positions = useEngineStore((s) => s.positions);
  const history = useEngineStore((s) => s.history);
  const logs = useEngineStore((s) => s.logs);
  const arm = useEngineStore((s) => s.arm);
  const disarm = useEngineStore((s) => s.disarm);
  const start = useEngineStore((s) => s.start);
  const stop = useEngineStore((s) => s.stop);
  const setSelected = useEngineStore((s) => s.setSelected);
  const online = mt5.status === "online";
  const floating = account.equity - account.balance;
  const under = account.startBalance < settings.autoCloseUnder;
  const targetPct = under
    ? Math.max(0, Math.min(100, (account.sessionPnl / settings.autoCloseUsd) * 100))
    : 0;
  const wins = history.filter((t) => t.pnl > 0).length;
  const winRate = history.length ? Math.round((wins / history.length) * 100) : 0;

  if (!online) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center">
        <p className="text-[0.7rem] tracking-[0.28em] text-muted">ULTRA SCALPER PRO</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Robot live = MetaTrader 5</h1>
        <p className="mt-3 text-sm text-muted">
          Téléchargez l’Expert Advisor, compilez-le, glissez-le sur un graphique.
          Le tableau ici ne fait que de la répétition paper.
        </p>
        <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/mt5">Installer l’EA live</Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetBooks();
              useEngineStore.getState().completeConnect();
            }}
          >
            Répéter en paper
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
        Répétition paper — les ordres live passent uniquement par l’EA dans MetaTrader 5.
      </p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <HudCell label="Équité" value={formatMoney(account.equity)} />
        <HudCell label="Balance" value={formatMoney(account.balance)} />
        <HudCell label="Flottant" value={formatSigned(floating)} tone={pnlClass(floating)} />
        <HudCell label="Session" value={formatSigned(account.sessionPnl)} tone={pnlClass(account.sessionPnl)} />
        <HudCell label="Marge" value={formatMoney(account.marginUsed)} />
        <HudCell
          label="Tickets"
          value={`${positions.length}/${settings.maxConcurrent}`}
        />
      </div>

      {under ? (
        <Panel className="p-3 md:p-4">
          <div className="flex items-center justify-between gap-3">
            <PanelTitle>Objectif session +{settings.autoCloseUsd} USD</PanelTitle>
            <span className={cn("num text-sm", pnlClass(account.sessionPnl))}>
              {formatSigned(account.sessionPnl)}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn("h-full rounded-full", engine.targetHit ? "bg-profit" : "bg-accent")}
              style={{ width: `${targetPct}%` }}
            />
          </div>
          {engine.targetHit ? (
            <p className="mt-2 text-xs text-profit">
              Cible atteinte — toutes les positions ont été clôturées.
            </p>
          ) : (
            <p className="mt-2 text-xs text-faint">
              Comptes inférieurs à {formatMoney(settings.autoCloseUnder, 0)} : fermeture auto à +
              {settings.autoCloseUsd} USD.
            </p>
          )}
        </Panel>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        {engine.armed ? (
          <Button variant="outline" className="flex-1" onClick={disarm}>
            <ShieldOff />
            Désarmer
          </Button>
        ) : (
          <Button variant="subtle" className="flex-1" onClick={arm}>
            <Shield />
            Armer
          </Button>
        )}
        {engine.running ? (
          <Button variant="outline" className="flex-1" onClick={stop}>
            <Pause />
            Stop entrées
          </Button>
        ) : (
          <Button className="flex-1" onClick={start} disabled={!engine.armed || engine.targetHit}>
            <Play />
            Démarrer le scalper
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <PanelTitle>Flux ticks · {SYMBOL_MAP[engine.selectedSymbol].label}</PanelTitle>
            <span className="text-xs text-muted">{settings.timeframe.toUpperCase()} · {settings.lotSize} lot</span>
          </div>
          <TickChart />
          <div className="mt-3 grid grid-cols-2 gap-1 sm:grid-cols-5">
            {SYMBOL_LIST.map((spec) => {
              const q = quotes[spec.id];
              const on = engine.selectedSymbol === spec.id;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => setSelected(spec.id)}
                  className={cn(
                    "rounded-sm border px-2 py-2 text-left transition-colors duration-[var(--motion-quick)]",
                    on ? "border-accent bg-surface-2" : "border-border hover:bg-surface-2",
                  )}
                >
                  <p className="text-[0.65rem] text-muted">{spec.id}</p>
                  <p className={cn("num text-xs", q?.dir === 1 ? "text-profit" : q?.dir === -1 ? "text-loss" : "text-fg")}>
                    {q ? formatPrice(spec.id, q.mid) : "—"}
                  </p>
                </button>
              );
            })}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <PanelTitle>Courbe d’équité</PanelTitle>
            <div className="mt-2">
              <EquitySpark />
            </div>
            <div className="mt-3 flex justify-between text-xs text-muted">
              <span>Win rate {winRate}%</span>
              <span>{history.length} clôtures</span>
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Positions ouvertes</PanelTitle>
            <div className="mt-3 space-y-2">
              {positions.length === 0 ? (
                <p className="text-sm text-faint">Aucune position</p>
              ) : (
                positions.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-sm bg-surface-2 px-3 py-2">
                    <div>
                      <p className="text-xs">
                        <span className={p.side === "buy" ? "text-profit" : "text-loss"}>
                          {p.side === "buy" ? "BUY" : "SELL"}
                        </span>{" "}
                        {p.symbol} · {formatLots(p.lots)}
                      </p>
                      <p className="num text-[0.7rem] text-faint">{formatPrice(p.symbol, p.openPrice)}</p>
                    </div>
                    <p className={cn("num text-sm", pnlClass(p.pnl))}>{formatSigned(p.pnl)}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelTitle>Carnet d’exécutions</PanelTitle>
        <ul className="mt-3 max-h-56 space-y-1 overflow-auto">
          {logs.length === 0 ? (
            <li className="text-sm text-faint">En attente</li>
          ) : (
            logs.map((line) => (
              <li key={line.id} className="tape-row flex gap-3 text-xs">
                <span className="num w-16 shrink-0 text-faint">{formatTime(line.t)}</span>
                <span
                  className={cn(
                    line.kind === "fill" || line.kind === "target"
                      ? "text-profit"
                      : line.kind === "error" || line.kind === "warn"
                        ? "text-loss"
                        : line.kind === "close"
                          ? "text-fg"
                          : "text-muted",
                  )}
                >
                  {line.text}
                </span>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  );
}
