import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { buildSetFile, downloadEaSource, downloadText } from "@/lib/engine/ea-export";
import { useEngineStore } from "@/lib/engine/store";
import { BROKERS, LEVERAGES } from "@/lib/engine/symbols";
import { resetBooks } from "@/lib/engine/runtime";

const STEPS = [
  "Télécharger UltraScalperPro.mq5",
  "Ouvrir MetaEditor (F4 dans MT5) → Compiler",
  "Glisser l’EA sur un graphique, activer Algo Trading",
  "Charger le fichier .set (lots, magic, symboles)",
];

export function Mt5View() {
  const mt5 = useEngineStore((s) => s.mt5);
  const settings = useEngineStore((s) => s.settings);
  const patchMt5 = useEngineStore((s) => s.patchMt5);
  const completeConnect = useEngineStore((s) => s.completeConnect);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onDownloadEa() {
    setError("");
    setBusy(true);
    try {
      await downloadEaSource();
      toast.success("Expert Advisor téléchargé");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Téléchargement impossible");
    } finally {
      setBusy(false);
    }
  }

  function onDownloadSet() {
    downloadText("UltraScalperPro.set", buildSetFile(settings, mt5));
    toast.success("Fichier .set exporté depuis Paramètres");
  }

  function onPaper() {
    resetBooks();
    completeConnect();
    toast.success("Répétition paper activée — le live reste l’EA dans MT5");
  }

  const symbols = Object.entries(settings.symbols)
    .filter(([, on]) => on)
    .map(([id]) => id)
    .join(" · ");

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-xs tracking-[0.22em] text-muted">ROBOT LIVE</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Expert Advisor MT5</h1>
        <p className="mt-2 text-sm text-muted">
          Un navigateur ne peut pas envoyer d’ordres chez un courtier. Le robot réel
          s’exécute dans MetaTrader 5, sur votre login, OnTick — pas sur des barres M1.
        </p>
      </div>

      <Panel className="space-y-4">
        <PanelTitle>Installation</PanelTitle>
        <ol className="space-y-2 text-sm text-muted">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="num w-4 shrink-0 text-faint">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" onClick={onDownloadEa} disabled={busy}>
            {busy ? "Téléchargement…" : "Télécharger l’EA .mq5"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={onDownloadSet}>
            Télécharger le .set
          </Button>
        </div>
        {error ? <p className="text-sm text-loss">{error}</p> : null}
      </Panel>

      <Panel className="space-y-3">
        <PanelTitle>Réglages injectés dans le .set</PanelTitle>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Lots</dt>
            <dd className="num">{settings.lotSize.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Mode</dt>
            <dd className="uppercase">{settings.powerMode}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Tickets max</dt>
            <dd className="num">{settings.maxConcurrent}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Magic</dt>
            <dd className="num">{settings.magic}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Auto-close</dt>
            <dd>
              +{settings.autoCloseUsd} USD sous {settings.autoCloseUnder.toLocaleString("fr-FR")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Symboles</dt>
            <dd>{symbols || "—"}</dd>
          </div>
        </dl>
        <p className="text-xs text-faint">
          Modifiez-les dans Paramètres, puis re-téléchargez le .set. Dans MT5 : clic droit
          sur l’EA → Propriétés → Charger.
        </p>
        <Button variant="subtle" className="w-full" asChild>
          <Link to="/settings">Ouvrir les paramètres</Link>
        </Button>
      </Panel>

      <Panel>
        <PanelTitle>Compte courtier (pense-bête)</PanelTitle>
        <p className="mt-2 text-sm text-muted">
          Connectez-vous dans le terminal MT5 avec ces identifiants. Le robot n’utilise
          pas le mot de passe du site — il trade via le terminal déjà ouvert.
        </p>
        <div className="mt-4 space-y-3">
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="login">Login</Label>
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
              <Label htmlFor="leverage">Levier (paper)</Label>
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
          </div>
        </div>
      </Panel>

      <Panel className="space-y-3">
        <PanelTitle>Répétition paper</PanelTitle>
        <p className="text-sm text-muted">
          Le tableau de bord peut rejouer le même moteur en ticks simulés. Ça n’envoie
          aucun ordre au courtier.
        </p>
        <Button variant="outline" className="w-full" onClick={onPaper}>
          Activer la répétition sur le tableau
        </Button>
      </Panel>

      <p className="pb-4 text-xs leading-relaxed text-faint">
        Activez Algo Trading dans MT5. Vérifiez le suffixe des symboles chez votre
        courtier (EURUSD.m, XAUUSDm…). Robot agressif : un compte réel peut être
        liquidé. Testez d’abord sur un compte démo.
      </p>
    </div>
  );
}
