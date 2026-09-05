import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Radio, SlidersHorizontal, Square, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEngineStore } from "@/lib/engine/store";
import { formatMoney, maskLogin } from "@/lib/engine/format";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Tableau", icon: LayoutDashboard },
  { to: "/mt5", label: "MT5", icon: Radio },
  { to: "/backtest", label: "Backtest", icon: Activity },
  { to: "/settings", label: "Paramètres", icon: SlidersHorizontal },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const mt5 = useEngineStore((s) => s.mt5);
  const engine = useEngineStore((s) => s.engine);
  const equity = useEngineStore((s) => s.account.equity);
  const flatten = useEngineStore((s) => s.flatten);
  const online = mt5.status === "online";

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex min-h-dvh max-w-7xl md:grid md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden border-r border-border md:flex md:flex-col md:p-5">
          <div className="px-1">
            <p className="text-[0.65rem] tracking-[0.28em] text-muted">SELF-HOSTED</p>
            <p className="mt-1 font-sans text-lg font-semibold leading-tight tracking-tight">
              ULTRA
              <br />
              SCALPER
              <span className="ml-1 align-top text-[0.65rem] text-muted">PRO</span>
            </p>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {NAV.map((item) => {
              const active = path === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-[var(--motion-quick)]",
                    active ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto space-y-3">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <span
                  className="live-dot"
                  data-state={online ? (engine.running ? "on" : "warn") : "off"}
                />
                <span className="text-xs text-muted">
                  {online ? (engine.running ? "En feu" : "Flux MT5") : "Hors ligne"}
                </span>
              </div>
              <p className="mt-2 num text-sm">{formatMoney(equity)}</p>
              <p className="text-xs text-faint">
                {online ? `${mt5.broker || "MT5"} · ${maskLogin(mt5.login)}` : "Aucun compte"}
              </p>
            </div>
            <Button
              variant="danger"
              className="w-full"
              onClick={() => flatten("flatten")}
              disabled={!online}
            >
              <Square className="size-3.5 fill-current" />
              Fermer tout
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
          <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-6">
            <div className="flex items-center gap-3 md:hidden">
              <span
                className="live-dot"
                data-state={online ? (engine.running ? "on" : "warn") : "off"}
              />
              <span className="text-sm font-medium tracking-tight">ULTRA SCALPER PRO</span>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <span className="text-xs text-muted">Latence</span>
              <span className="num text-sm">{Math.round(engine.latencyMs)} ms</span>
              <span className="text-faint">·</span>
              <span className="num text-sm text-muted">{engine.ticksPerSec} ticks/s</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="num text-sm md:hidden">{formatMoney(equity)}</span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[0.65rem] uppercase tracking-wider",
                  online ? "border-profit/30 text-profit" : "border-border text-muted",
                )}
              >
                {online ? "Paper" : "MT5"}
              </span>
            </div>
          </header>
          <main className="flex-1 px-4 py-4 md:px-6 md:py-6">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = path === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem]",
                  active ? "text-fg" : "text-muted",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
