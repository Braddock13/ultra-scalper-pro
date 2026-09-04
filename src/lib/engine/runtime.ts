import { detectSignal } from "./strategy";
import { ANCHORS, SYMBOL_LIST, SYMBOL_MAP } from "./symbols";
import { useEngineStore } from "./store";
import type { Bar, Quote, SymbolId, Tick } from "./types";

type Book = {
  mid: number;
  burstDir: number;
  burstLeft: number;
  bars: Bar[];
  ticks: Tick[];
  barAcc: { t: number; open: number; high: number; low: number; close: number } | null;
};

const books = new Map<SymbolId, Book>();
let timer: number | null = null;
let lastSnap = 0;
let ticksWindow = 0;
let ticksWindowAt = 0;
let cursor = 0;

function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function ensureBook(id: SymbolId): Book {
  let b = books.get(id);
  if (!b) {
    const mid = ANCHORS[id];
    b = { mid, burstDir: 0, burstLeft: 0, bars: [], ticks: [], barAcc: null };
    books.set(id, b);
  }
  return b;
}

function seedFromQuotes() {
  const quotes = useEngineStore.getState().quotes;
  for (const spec of SYMBOL_LIST) {
    const q = quotes[spec.id];
    const b = ensureBook(spec.id);
    b.mid = q?.mid ?? ANCHORS[spec.id];
  }
}

function stepSymbol(id: SymbolId, now: number): { quote: Quote; tick: Tick } {
  const spec = SYMBOL_MAP[id];
  const book = ensureBook(id);
  if (book.burstLeft <= 0 && Math.random() < 0.045) {
    book.burstDir = Math.random() < 0.5 ? -1 : 1;
    book.burstLeft = 8 + Math.floor(Math.random() * 14);
  }
  const shock = gauss() * spec.vol;
  const burst = book.burstLeft > 0 ? book.burstDir * spec.vol * (1.6 + Math.random()) : 0;
  if (book.burstLeft > 0) book.burstLeft -= 1;
  const revert = (ANCHORS[id] - book.mid) * 0.0012;
  book.mid = Math.max(spec.tickSize, book.mid + shock + burst + revert);
  const spread = spec.spread * (book.burstLeft > 0 ? 1.35 : 1);
  const half = spread / 2;
  const prev = useEngineStore.getState().quotes[id]?.mid ?? book.mid;
  const dir: 1 | -1 | 0 = book.mid > prev ? 1 : book.mid < prev ? -1 : 0;
  const quote: Quote = {
    symbol: id,
    bid: book.mid - half,
    ask: book.mid + half,
    mid: book.mid,
    spread,
    ts: now,
    dir,
  };
  const tick: Tick = { t: now, mid: book.mid, bid: quote.bid, ask: quote.ask };
  book.ticks = [...book.ticks, tick].slice(-120);

  const tfMs: Record<string, number> = { tick: 1000, s1: 1000, s5: 5000, s15: 15000, s30: 30000 };
  const tf = useEngineStore.getState().settings.timeframe;
  const bucket = tfMs[tf] ?? 1000;
  const bt = Math.floor(now / bucket) * bucket;
  if (!book.barAcc || book.barAcc.t !== bt) {
    if (book.barAcc) book.bars = [...book.bars, book.barAcc].slice(-80);
    book.barAcc = { t: bt, open: book.mid, high: book.mid, low: book.mid, close: book.mid };
  } else {
    book.barAcc.high = Math.max(book.barAcc.high, book.mid);
    book.barAcc.low = Math.min(book.barAcc.low, book.mid);
    book.barAcc.close = book.mid;
  }
  return { quote, tick };
}

function loop() {
  const t0 = performance.now();
  const state = useEngineStore.getState();
  if (state.mt5.status !== "online") return;

  const now = Date.now();
  const spec = SYMBOL_LIST[cursor % SYMBOL_LIST.length];
  cursor += 1;
  if (!spec) return;

  const { quote, tick } = stepSymbol(spec.id, now);
  state.applyTick(spec.id, quote, tick);
  state.managePositions(spec.id);

  const book = ensureBook(spec.id);
  if (state.engine.running && state.settings.symbols[spec.id]) {
    const side = detectSignal(
      book.ticks,
      book.bars,
      spec,
      state.settings.timeframe,
      state.settings.powerMode,
    );
    if (side) state.maybeOpen(spec.id, side);
  }

  ticksWindow += 1;
  if (now - ticksWindowAt >= 1000) {
    const latency = Math.max(4, performance.now() - t0 + 6 + Math.random() * 8);
    state.markLatency(latency, ticksWindow);
    ticksWindow = 0;
    ticksWindowAt = now;
  }
  if (now - lastSnap >= 1000) {
    lastSnap = now;
    useEngineStore.getState().snapshotEquity();
  }
}

export function startRuntime() {
  if (timer != null) return;
  seedFromQuotes();
  ticksWindowAt = Date.now();
  lastSnap = Date.now();
  timer = window.setInterval(loop, 32);
}

export function stopRuntime() {
  if (timer != null) {
    window.clearInterval(timer);
    timer = null;
  }
}

export function resetBooks() {
  books.clear();
  seedFromQuotes();
}
