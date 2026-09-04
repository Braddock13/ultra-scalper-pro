import type { Bar, PowerMode, Side, SymbolSpec, Tick, Timeframe } from "./types";

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let e = values[0] ?? 0;
  for (let i = 1; i < values.length; i++) {
    e = (values[i] ?? 0) * k + e * (1 - k);
  }
  return e;
}

function atr(ticks: Tick[]): number {
  if (ticks.length < 8) return 0;
  let sum = 0;
  const n = Math.min(40, ticks.length - 1);
  const start = ticks.length - 1 - n;
  for (let i = start + 1; i < ticks.length; i++) {
    sum += Math.abs((ticks[i]?.mid ?? 0) - (ticks[i - 1]?.mid ?? 0));
  }
  return sum / n;
}

function barAtr(bars: Bar[]): number {
  if (bars.length < 4) return 0;
  const slice = bars.slice(-12);
  let sum = 0;
  for (const b of slice) sum += b.high - b.low;
  return sum / slice.length;
}

export function powerProfile(mode: PowerMode) {
  switch (mode) {
    case "ignition":
      return { cooldownMs: 900, burstNeed: 12, holdScale: 1.35, concurrent: 3 };
    case "overdrive":
      return { cooldownMs: 180, burstNeed: 9, holdScale: 0.7, concurrent: 8 };
    default:
      return { cooldownMs: 380, burstNeed: 11, holdScale: 1, concurrent: 6 };
  }
}

export function detectSignal(
  ticks: Tick[],
  bars: Bar[],
  spec: SymbolSpec,
  timeframe: Timeframe,
  mode: PowerMode,
): Side | null {
  const profile = powerProfile(mode);
  if (ticks.length < 28) return null;

  const recent = ticks.slice(-18);
  let up = 0;
  let down = 0;
  for (let i = 1; i < recent.length; i++) {
    const d = (recent[i]?.mid ?? 0) - (recent[i - 1]?.mid ?? 0);
    if (d > spec.tickSize * 0.4) up++;
    else if (d < -spec.tickSize * 0.4) down++;
  }

  const slope = (recent[recent.length - 1]?.mid ?? 0) - (recent[0]?.mid ?? 0);
  const tickAtr = atr(ticks);
  if (tickAtr < spec.minAtr) return null;

  const closes = (timeframe === "tick" ? ticks.slice(-60).map((t) => t.mid) : bars.slice(-40).map((b) => b.close));
  if (closes.length < 10) return null;
  const fast = ema(closes, 3);
  const slow = ema(closes, 9);
  const trend = fast > slow ? 1 : fast < slow ? -1 : 0;
  if (trend === 0) return null;

  const range = timeframe === "tick" ? tickAtr : Math.max(tickAtr, barAtr(bars));
  const impulse = Math.abs(slope) > range * (mode === "overdrive" ? 0.1 : 0.16);

  if (up >= profile.burstNeed && trend === 1 && impulse && slope > 0) return "buy";
  if (down >= profile.burstNeed && trend === -1 && impulse && slope < 0) return "sell";
  return null;
}

export function levelsFor(
  spec: SymbolSpec,
  side: Side,
  price: number,
  mode: PowerMode,
): { sl: number; tp: number; trail: number } {
  const boost = mode === "overdrive" ? 0.82 : mode === "ignition" ? 1.2 : 1;
  const slDist = spec.pip * spec.slPips * boost;
  const tpDist = spec.pip * spec.tpPips * boost;
  const trailDist = spec.pip * spec.trailPips * boost;
  if (side === "buy") {
    return { sl: price - slDist, tp: price + tpDist, trail: trailDist };
  }
  return { sl: price + slDist, tp: price - tpDist, trail: trailDist };
}

export function positionPnl(
  spec: SymbolSpec,
  side: Side,
  lots: number,
  open: number,
  current: number,
): number {
  const dir = side === "buy" ? 1 : -1;
  const raw = dir * (current - open) * spec.contract * lots;
  if (spec.id === "USDJPY") return raw / Math.max(current, 1);
  return raw;
}

export function requiredMargin(
  spec: SymbolSpec,
  lots: number,
  price: number,
  leverage: number,
): number {
  const notional = spec.contract * lots * price;
  return notional / Math.max(1, leverage);
}
