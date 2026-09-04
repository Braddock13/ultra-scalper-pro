import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useEngineStore } from "@/lib/engine/store";
import { SYMBOL_LIST } from "@/lib/engine/symbols";
import type { PowerMode, Timeframe } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

const POWERS: { id: PowerMode; label: string; hint: string }[] = [
  { id: "ignition", label: "Ignition", hint: "3 tickets · un peu plus large" },
  { id: "ultra", label: "Ultra", hint: "6 × 0.03 · cadence de base" },
  { id: "overdrive", label: "Overdrive", hint: "8 tickets · cooldown 180 ms" },
];

const TFS: { id: Timeframe; label: string }[] = [
  { id: "tick", label: "Tick" },
  { id: "s1", label: "1s" },
  { id: "s5", label: "5s" },
  { id: "s15", label: "15s" },
  { id: "s30", label: "30s" },
];

export function SettingsView() {
  const settings = useEngineStore((s) => s.settings);
  const patch = useEngineStore((s) => s.patchSettings);
  const resetAccount = useEngineStore((s) => s.resetAccount);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <p className="text-[0.7rem] tracking-[0.22em] text-muted">MOTEUR</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-2 text-sm text-muted">
          ULTRA SCALPER PRO n’est pas un robot 1–2 %. Le risque est la vitesse :
          lots multiples, timeframes sous M1, cible de session agressive.
        </p>
      </div>

      <Panel className="space-y-5">
        <PanelTitle>Puissance</PanelTitle>
        <div className="grid gap-2 sm:grid-cols-3">
          {POWERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() =>
                patch({
                  powerMode: p.id,
                  maxConcurrent: p.id === "overdrive" ? 8 : p.id === "ignition" ? 3 : 6,
                })
              }
              className={cn(
                "rounded-lg border px-3 py-3 text-left transition-colors duration-[var(--motion-quick)]",
                settings.powerMode === p.id ? "border-accent bg-surface-2" : "border-border hover:bg-surface-2",
              )}
            >
              <p className="text-sm font-medium">{p.label}</p>
              <p className="mt-1 text-xs text-muted">{p.hint}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel className="space-y-5">
        <PanelTitle>Exécution</PanelTitle>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label>Lots par ticket</Label>
            <span className="num text-sm">{settings.lotSize.toFixed(2)}</span>
          </div>
          <Slider
            min={0.01}
            max={1}
            step={0.01}
            value={[settings.lotSize]}
            onValueChange={(v) => patch({ lotSize: v[0] ?? 0.03 })}
          />
          <p className="mt-2 text-xs text-faint">Défaut 0.03 · multi-tickets simultanés.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="maxc">Tickets simultanés</Label>
            <Input
              id="maxc"
              type="number"
              min={1}
              max={24}
              value={settings.maxConcurrent}
              onChange={(e) =>
                patch({ maxConcurrent: Math.max(1, Math.min(24, Number(e.target.value) || 1)) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="magic">Magic number</Label>
            <Input
              id="magic"
              type="number"
              value={settings.magic}
              onChange={(e) => patch({ magic: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div>
          <Label>Timeframe d’entrée (sous M1)</Label>
          <div className="mt-2 grid grid-cols-5 gap-1">
            {TFS.map((tf) => (
              <button
                key={tf.id}
                type="button"
                onClick={() => patch({ timeframe: tf.id })}
                className={cn(
                  "h-11 rounded-sm border text-sm transition-colors duration-[var(--motion-quick)]",
                  settings.timeframe === tf.id ? "border-accent bg-surface-2" : "border-border",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="space-y-5">
        <PanelTitle>Compte & cible</PanelTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bal">Balance initiale (15 – 500 000 000)</Label>
            <Input
              id="bal"
              type="number"
              min={15}
              max={500_000_000}
              value={settings.initialBalance}
              onChange={(e) => {
                const n = Number(e.target.value);
                patch({ initialBalance: Math.max(15, Math.min(500_000_000, n || 15)) });
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target">Auto-close profit USD</Label>
            <Input
              id="target"
              type="number"
              min={1}
              value={settings.autoCloseUsd}
              onChange={(e) => patch({ autoCloseUsd: Math.max(1, Number(e.target.value) || 55) })}
            />
          </div>
        </div>
        <p className="text-xs text-faint">
          Si le compte est sous {settings.autoCloseUnder.toLocaleString("fr-FR")} USD, le robot
          aplatit tout à +{settings.autoCloseUsd} USD de session.
        </p>
        <Button variant="outline" onClick={resetAccount}>
          Réinitialiser le compte
        </Button>
      </Panel>

      <Panel className="space-y-4">
        <PanelTitle>Symboles</PanelTitle>
        <ul className="space-y-3">
          {SYMBOL_LIST.map((spec) => (
            <li key={spec.id} className="flex h-11 items-center justify-between">
              <div>
                <p className="text-sm">{spec.label}</p>
                <p className="text-xs text-faint">{spec.id}</p>
              </div>
              <Switch
                checked={settings.symbols[spec.id]}
                onCheckedChange={(checked) =>
                  patch({ symbols: { ...settings.symbols, [spec.id]: checked } })
                }
                aria-label={spec.label}
              />
            </li>
          ))}
        </ul>
      </Panel>

      <p className="pb-4 text-xs leading-relaxed text-faint">
        Robot agressif. Le trading sur marge peut liquider le compte. L’exécution paper
        de ce terminal ne préjuge pas d’un résultat live. Un pont MT5 local est requis
        pour router les ordres chez le courtier.
      </p>
    </div>
  );
}
