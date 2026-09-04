import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { useEngineStore } from "@/lib/engine/store";
import { BROKERS, LEVERAGES } from "@/lib/engine/symbols";
import { formatMoney, maskLogin } from "@/lib/engine/format";
import { resetBooks } from "@/lib/engine/runtime";

const STEPS = [
  "Résolution du serveur",
  "Authentification du login",
  "Synchronisation des symboles",
  "Flux ticks établi",
];

export function Mt5View() {
  const mt5 = useEngineStore((s) => s.mt5);
  const account = useEngineStore((s) => s.account);
  const patchMt5 = useEngineStore((s) => s.patchMt5);
  const setConnectStatus = useEngineStore((s) => s.setConnectStatus);
  const completeConnect = useEngineStore((s) => s.completeConnect);
  const disconnect = useEngineStore((s) => s.disconnect);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState("");
  const connecting = mt5.status === "connecting";
  const online = mt5.status === "online";

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4,16}$/.test(mt5.login.trim())) {
      setError("Le login MT5 doit être un identifiant numérique.");
      return;
    }
    if (mt5.password.length < 4) {
      setError("Mot de passe trop court.");
      return;
    }
    if (!mt5.server.trim()) {
      setError("Indiquez le serveur du courtier.");
      return;
    }
    setConnectStatus("connecting");
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 420));
    }
    resetBooks();
    completeConnect();
    setStep(-1);
    toast.success("Compte MT5 lié — flux ticks actif");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-[0.7rem] tracking-[0.22em] text-muted">COMPTE</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pont MetaTrader 5</h1>
        <p className="mt-2 text-sm text-muted">
          Liez n’importe quel login MT5 (tout courtier). Les identifiants restent sur cet
          appareil. Sans pont local, l’exécution tourne en paper ultra-fidèle sur le
          même moteur d’ordres.
        </p>
      </div>

      {online ? (
        <Panel>
          <div className="flex items-start justify-between gap-3">
            <div>
              <PanelTitle>Session active</PanelTitle>
              <p className="mt-2 text-lg font-medium">{mt5.broker || "MT5"}</p>
              <p className="num text-sm text-muted">
                {maskLogin(mt5.login)} · {mt5.server}
              </p>
              <p className="mt-3 text-sm text-muted">
                Levier 1:{mt5.leverage} · Équité {formatMoney(account.equity)}
              </p>
            </div>
            <span className="live-dot mt-1" />
          </div>
          <Button variant="outline" className="mt-6 w-full" onClick={disconnect}>
            Déconnecter
          </Button>
        </Panel>
      ) : (
        <Panel>
          <form className="space-y-4" onSubmit={onConnect}>
            <div className="space-y-1.5">
              <Label htmlFor="broker">Courtier</Label>
              <select
                id="broker"
                className="flex h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={mt5.broker}
                onChange={(e) => {
                  const name = e.target.value;
                  const found = BROKERS.find((b) => b.name === name);
                  patchMt5({ broker: name, server: found?.server || mt5.server });
                }}
              >
                <option value="">Choisir…</option>
                {BROKERS.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="server">Serveur</Label>
              <Input
                id="server"
                placeholder="ICMarketsSC-MT5"
                value={mt5.server}
                autoComplete="off"
                onChange={(e) => patchMt5({ server: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="login">Login MT5</Label>
                <Input
                  id="login"
                  inputMode="numeric"
                  placeholder="12345678"
                  value={mt5.login}
                  autoComplete="off"
                  onChange={(e) => patchMt5({ login: e.target.value.replace(/\s/g, "") })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={mt5.password}
                  autoComplete="off"
                  onChange={(e) => patchMt5({ password: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leverage">Levier</Label>
              <select
                id="leverage"
                className="flex h-11 w-full rounded-sm border border-border bg-bg px-3 text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                value={mt5.leverage}
                onChange={(e) => patchMt5({ leverage: Number(e.target.value) })}
              >
                {LEVERAGES.map((n) => (
                  <option key={n} value={n}>
                    1:{n}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gateway">Pont live (optionnel)</Label>
              <Input
                id="gateway"
                placeholder="https://votre-pont-mt5.local"
                value={mt5.gatewayUrl}
                autoComplete="off"
                onChange={(e) => patchMt5({ gatewayUrl: e.target.value })}
              />
              <p className="text-xs text-faint">
                URL d’un bridge self-hosted (EA / Python). Si vide, exécution paper.
              </p>
            </div>
            {error ? <p className="text-sm text-loss">{error}</p> : null}
            {connecting ? (
              <p className="text-sm text-muted">{STEPS[step] ?? "Connexion…"}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={connecting}>
              {connecting ? "Handshake…" : "Connecter le compte"}
            </Button>
          </form>
        </Panel>
      )}
    </div>
  );
}
