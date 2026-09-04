import { ANCHORS, SYMBOL_MAP } from "./symbols";
import { detectSignal, levelsFor, positionPnl, powerProfile, requiredMargin } from "./strategy";
import type {
  Bar,
  ClosedTrade,
  Position,
  PowerMode,
  Settings,
  SymbolId,
  Tick,
  Timeframe,
} from "./types";

export type BacktestHorizon = "15m" | "1h" | "4h";

export type BacktestInput = {
  symbols: SymbolId[];
  horizon: BacktestHorizon;
  tickMs: number;
  seed: number;
  lots: number;
  powerMode: PowerMode;
  timeframe: Timeframe;
  maxConcurrent: number;
  maxPerSymbol: number;
  holdMs: number;
  maxSpreadMult: number;
  initialBalance: number;
  leverage: number;
  autoCloseUsd: number;
  autoCloseUnder: number;
};

export type BacktestResult = {
  ticks: number;
  simMs: number;
  wallMs: number;
  ticksPerSec: number;
  startBalance: number;
  endEquity: number;
  netPnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  avgHoldMs: number;
  targetHits: number;
  equity: { t: number; equity: number }[];
  recent: ClosedTrade[];
  bySymbol: { symbol: SymbolId; trades: number; pnl: number }[];
};

const HORIZON_MS: Record<BacktestHorizon, number> = {
  "15m": 15 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

type Book = {
  mid: number;
  burstDir: number;
  burstLeft: number;
  ticks: Tick[];
  bars: Bar[];
  barAcc: Bar | null;
  lastFillAt: number;
};

type SimPos = Position & { id: string };

export function fromSettings(
  settings: Settings,
  leverage: number,
  extras: Partial<BacktestInput> = {},
): BacktestInput {
  const symbols = (Object.keys(settings.symbols) as SymbolId[]).filter((id) => settings.symbols[id]);
  return {
    symbols: symbols.length ? symbols : ["EURUSD"],
    horizon: "1h",
    tickMs: 50,
    seed: 202609,
    lots: settings.lotSize,
    powerMode: settings.powerMode,
    timeframe: settings.timeframe,
    maxConcurrent: settings.maxConcurrent,
    maxPerSymbol: settings.maxPerSymbol,
    holdMs: settings.holdMs,
    maxSpreadMult: settings.maxSpreadMult,
    initialBalance: settings.initialBalance,
    leverage,
    autoCloseUsd: settings.autoCloseUsd,
    autoCloseUnder: settings.autoCloseUnder,
    ...extras,
  };
}

export async function runBacktest(
  input: BacktestInput,
  onProgress?: (pct: number) => void,
): Promise<BacktestResult> {
  const t0 = performance.now();
  const rand = mulberry32(input.seed || 1);
  const simMs = HORIZON_MS[input.horizon];
  const tickMs = Math.max(20, input.tickMs);
  const steps = Math.floor(simMs / tickMs);
  const symbols = input.symbols.length ? input.symbols : (["EURUSD"] as SymbolId[]);
  const profile = powerProfile(input.powerMode);
  const hold = input.holdMs * profile.holdScale;

  const books = new Map<SymbolId, Book>();
  for (const id of symbols) {
    books.set(id, {
      mid: ANCHORS[id],
      burstDir: 0,
      burstLeft: 0,
      ticks: [],
      bars: [],
      barAcc: null,
      lastFillAt: -1e12,
    });
  }

  let balance = input.initialBalance;
  let peak = input.initialBalance;
  let maxDd = 0;
  let sessionStart = input.initialBalance;
  let targetHits = 0;
  let seq = 0;
  const positions: SimPos[] = [];
  const closed: ClosedTrade[] = [];
  const equity: { t: number; equity: number }[] = [{ t: 0, equity: balance }];
  const snapEvery = Math.max(1, Math.floor(steps / 180));

  const tfMs: Record<Timeframe, number> = {
    tick: 1000,
    s1: 1000,
    s5: 5000,
    s15: 15000,
    s30: 30000,
  };
  const bucket = tfMs[input.timeframe];

  function floating(now: number): number {
    let sum = 0;
    for (const p of positions) {
      const book = books.get(p.symbol);
      const spec = SYMBOL_MAP[p.symbol];
      if (!book) continue;
      const spread = spec.spread;
      const px = p.side === "buy" ? book.mid - spread / 2 : book.mid + spread / 2;
      sum += positionPnl(spec, p.side, p.lots, p.openPrice, px);
    }
    void now;
    return sum;
  }

  function flatten(now: number, reason: ClosedTrade["reason"]) {
    for (const p of positions.splice(0)) {
      const book = books.get(p.symbol);
      const spec = SYMBOL_MAP[p.symbol];
      if (!book) continue;
      const spread = spec.spread;
      const px = p.side === "buy" ? book.mid - spread / 2 : book.mid + spread / 2;
      const pnl = positionPnl(spec, p.side, p.lots, p.openPrice, px);
      balance += pnl;
      closed.push({
        id: p.id,
        symbol: p.symbol,
        side: p.side,
        lots: p.lots,
        openPrice: p.openPrice,
        closePrice: px,
        openedAt: p.openedAt,
        closedAt: now,
        pnl,
        reason,
      });
    }
  }

  const chunk = 2500;
  for (let step = 1; step <= steps; step++) {
    const now = step * tickMs;
    for (const id of symbols) {
      const spec = SYMBOL_MAP[id];
      const book = books.get(id);
      if (!book) continue;
      if (book.burstLeft <= 0 && rand() < 0.045) {
        book.burstDir = rand() < 0.5 ? -1 : 1;
        book.burstLeft = 8 + Math.floor(rand() * 14);
      }
      const shock = gauss(rand) * spec.vol;
      const burst = book.burstLeft > 0 ? book.burstDir * spec.vol * (1.6 + rand()) : 0;
      if (book.burstLeft > 0) book.burstLeft -= 1;
      const revert = (ANCHORS[id] - book.mid) * 0.0012;
      book.mid = Math.max(spec.tickSize, book.mid + shock + burst + revert);
      const spread = spec.spread * (book.burstLeft > 0 ? 1.35 : 1);
      const half = spread / 2;
      const tick: Tick = { t: now, mid: book.mid, bid: book.mid - half, ask: book.mid + half };
      book.ticks.push(tick);
      if (book.ticks.length > 120) book.ticks.shift();

      const bt = Math.floor(now / bucket) * bucket;
      if (!book.barAcc || book.barAcc.t !== bt) {
        if (book.barAcc) {
          book.bars.push(book.barAcc);
          if (book.bars.length > 80) book.bars.shift();
        }
        book.barAcc = { t: bt, open: book.mid, high: book.mid, low: book.mid, close: book.mid };
      } else {
        book.barAcc.high = Math.max(book.barAcc.high, book.mid);
        book.barAcc.low = Math.min(book.barAcc.low, book.mid);
        book.barAcc.close = book.mid;
      }

      const still: SimPos[] = [];
      for (const p of positions) {
        if (p.symbol !== id) {
          still.push(p);
          continue;
        }
        const px = p.side === "buy" ? tick.bid : tick.ask;
        const pnl = positionPnl(spec, p.side, p.lots, p.openPrice, px);
        let sl = p.sl;
        if (p.trail) {
          if (p.side === "buy") {
            const move = px - p.openPrice;
            if (move > p.trail) sl = Math.max(sl, px - p.trail);
          } else {
            const move = p.openPrice - px;
            if (move > p.trail) sl = Math.min(sl, px + p.trail);
          }
        }
        let reason: ClosedTrade["reason"] | null = null;
        if (p.side === "buy") {
          if (px <= sl) reason = sl === p.sl ? "sl" : "trail";
          else if (px >= p.tp) reason = "tp";
        } else if (px >= sl) reason = sl === p.sl ? "sl" : "trail";
        else if (px <= p.tp) reason = "tp";
        if (!reason && now - p.openedAt > hold) reason = "time";
        if (reason) {
          balance += pnl;
          closed.push({
            id: p.id,
            symbol: p.symbol,
            side: p.side,
            lots: p.lots,
            openPrice: p.openPrice,
            closePrice: px,
            openedAt: p.openedAt,
            closedAt: now,
            pnl,
            reason,
          });
        } else {
          still.push({ ...p, sl, pnl });
        }
      }
      positions.length = 0;
      positions.push(...still);

      const equityNow = balance + floating(now);
      if (
        (input.initialBalance < input.autoCloseUnder || balance < input.autoCloseUnder) &&
        equityNow - sessionStart >= input.autoCloseUsd
      ) {
        flatten(now, "target");
        targetHits += 1;
        sessionStart = balance;
      }

      const side = detectSignal(book.ticks, book.bars, spec, input.timeframe, input.powerMode);
      if (
        side &&
        now - book.lastFillAt >= profile.cooldownMs &&
        positions.length < input.maxConcurrent &&
        positions.filter((p) => p.symbol === id).length < input.maxPerSymbol &&
        spread <= spec.spread * input.maxSpreadMult
      ) {
        const px = side === "buy" ? tick.ask : tick.bid;
        const margin = requiredMargin(spec, input.lots, px, input.leverage);
        const used = positions.reduce(
          (acc, p) => acc + requiredMargin(SYMBOL_MAP[p.symbol], p.lots, books.get(p.symbol)?.mid ?? p.openPrice, input.leverage),
          0,
        );
        if (margin <= (equityNow - used) * 0.92) {
          const lv = levelsFor(spec, side, px, input.powerMode);
          seq += 1;
          positions.push({
            id: `bt-${seq}`,
            symbol: id,
            side,
            lots: input.lots,
            openPrice: px,
            sl: lv.sl,
            tp: lv.tp,
            trail: lv.trail,
            openedAt: now,
            pnl: 0,
            magic: 202609,
          });
          book.lastFillAt = now;
        }
      }
    }

    if (step % snapEvery === 0 || step === steps) {
      const eq = balance + floating(now);
      equity.push({ t: now, equity: eq });
      if (eq > peak) peak = eq;
      const dd = peak - eq;
      if (dd > maxDd) maxDd = dd;
    }

    if (step % chunk === 0) {
      onProgress?.(step / steps);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  flatten(simMs, "flatten");
  const eq = balance;
  if (eq > peak) peak = eq;
  maxDd = Math.max(maxDd, peak - eq);
  equity.push({ t: simMs, equity: eq });

  const wins = closed.filter((c) => c.pnl > 0);
  const losses = closed.filter((c) => c.pnl < 0);
  const gain = wins.reduce((a, c) => a + c.pnl, 0);
  const lossAbs = Math.abs(losses.reduce((a, c) => a + c.pnl, 0));
  const holds = closed.map((c) => c.closedAt - c.openedAt);
  const avgHold = holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : 0;
  const byMap = new Map<SymbolId, { trades: number; pnl: number }>();
  for (const c of closed) {
    const row = byMap.get(c.symbol) ?? { trades: 0, pnl: 0 };
    row.trades += 1;
    row.pnl += c.pnl;
    byMap.set(c.symbol, row);
  }

  const wallMs = performance.now() - t0;
  const ticks = steps * symbols.length;
  onProgress?.(1);

  return {
    ticks,
    simMs,
    wallMs,
    ticksPerSec: wallMs > 0 ? ticks / (wallMs / 1000) : ticks,
    startBalance: input.initialBalance,
    endEquity: eq,
    netPnl: eq - input.initialBalance,
    trades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    profitFactor: lossAbs > 0 ? gain / lossAbs : gain > 0 ? 99 : 0,
    maxDrawdown: maxDd,
    maxDrawdownPct: peak > 0 ? (maxDd / peak) * 100 : 0,
    avgHoldMs: avgHold,
    targetHits,
    equity,
    recent: closed.slice(-40).reverse(),
    bySymbol: [...byMap.entries()].map(([symbol, v]) => ({ symbol, ...v })),
  };
}
