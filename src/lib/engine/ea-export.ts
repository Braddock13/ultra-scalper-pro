import type { Mt5Account, Settings } from "./types";

function yn(v: boolean): string {
  return v ? "true" : "false";
}

function powerIndex(mode: Settings["powerMode"]): number {
  if (mode === "ignition") return 0;
  if (mode === "overdrive") return 2;
  return 1;
}

export function buildSetFile(settings: Settings, mt5: Mt5Account): string {
  const hold = Math.max(4, Math.round(settings.holdMs / 1000));
  return [
    "; ULTRA SCALPER PRO — fichier .set pour MetaTrader 5",
    `; Compte ${mt5.login || "—"} ${mt5.server || ""}`.trim(),
    `InpLots=${settings.lotSize}`,
    `InpMagic=${settings.magic}`,
    `InpPower=${powerIndex(settings.powerMode)}`,
    `InpMaxConcurrent=${settings.maxConcurrent}`,
    `InpMaxPerSymbol=${settings.maxPerSymbol}`,
    `InpHoldSeconds=${hold}`,
    `InpMaxSpreadMult=${settings.maxSpreadMult}`,
    `InpDeviationPts=30`,
    `InpAutoCloseUsd=${settings.autoCloseUsd}`,
    `InpAutoCloseUnder=${settings.autoCloseUnder}`,
    `InpEURUSD=${yn(settings.symbols.EURUSD)}`,
    `InpGBPUSD=${yn(settings.symbols.GBPUSD)}`,
    `InpUSDJPY=${yn(settings.symbols.USDJPY)}`,
    `InpXAUUSD=${yn(settings.symbols.XAUUSD)}`,
    `InpBTCUSD=${yn(settings.symbols.BTCUSD)}`,
    "",
  ].join("\n");
}

export function downloadText(filename: string, body: string, mime = "text/plain"): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadEaSource(): Promise<void> {
  const res = await fetch("/robot/UltraScalperPro.mq5");
  if (!res.ok) throw new Error("Fichier EA introuvable");
  const body = await res.text();
  downloadText("UltraScalperPro.mq5", body);
}
