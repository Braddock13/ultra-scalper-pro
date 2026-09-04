import { SYMBOL_MAP } from "./symbols";
import type { SymbolId } from "./types";

export function formatMoney(n: number, digits = 2): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 10_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatSigned(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${formatMoney(n, digits)}`;
}

export function formatPrice(symbol: SymbolId, price: number): string {
  const spec = SYMBOL_MAP[symbol];
  return price.toFixed(spec.digits);
}

export function formatLots(n: number): string {
  return n.toFixed(2);
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatSim(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}


export function formatMs(n: number): string {
  return `${Math.round(n)} ms`;
}

export function maskLogin(login: string): string {
  if (login.length <= 4) return login;
  return `${login.slice(0, 2)}···${login.slice(-3)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function pnlClass(n: number): string {
  if (n > 0) return "text-profit";
  if (n < 0) return "text-loss";
  return "text-muted";
}
