import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { ANCHORS, SYMBOL_LIST, SYMBOL_MAP } from "./symbols";
import { levelsFor, positionPnl, powerProfile, requiredMargin } from "./strategy";
import type {
  AccountState,
  ClosedTrade,
  ConnectStatus,
  EngineFlags,
  EquityPoint,
  LogKind,
  LogLine,
  Mt5Account,
  Position,
  Quote,
  Settings,
  Side,
  SymbolId,
  Tick,
} from "./types";

const ALL_ON: Record<SymbolId, boolean> = {
  EURUSD: true,
  GBPUSD: true,
  USDJPY: true,
  XAUUSD: true,
  BTCUSD: true,
};

function defaultQuotes(): Record<SymbolId, Quote> {
  const now = Date.now();
  const out = {} as Record<SymbolId, Quote>;
  for (const spec of SYMBOL_LIST) {
    const mid = ANCHORS[spec.id];
    const half = spec.spread / 2;
    out[spec.id] = {
      symbol: spec.id,
      bid: mid - half,
      ask: mid + half,
      mid,
      spread: spec.spread,
      ts: now,
      dir: 0,
    };
  }
  return out;
}

function defaultSettings(): Settings {
  return {
    lotSize: 0.03,
    maxConcurrent: 6,
    maxPerSymbol: 3,
    powerMode: "ultra",
    timeframe: "tick",
    autoCloseUsd: 55,
    autoCloseUnder: 5000,
    initialBalance: 500,
    magic: 202609,
    maxSpreadMult: 1.8,
    holdMs: 28000,
    symbols: { ...ALL_ON },
  };
}

function defaultAccount(balance: number): AccountState {
  return {
    startBalance: balance,
    balance,
    equity: balance,
    marginUsed: 0,
    sessionStartEquity: balance,
    sessionPnl: 0,
    peakEquity: balance,
  };
}

function defaultMt5(): Mt5Account {
  return {
    login: "",
    password: "",
    server: "",
    broker: "",
    leverage: 500,
    status: "offline",
    connectedAt: null,
    gatewayUrl: "",
  };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

type EngineStore = {
  mt5: Mt5Account;
  settings: Settings;
  account: AccountState;
  engine: EngineFlags;
  quotes: Record<SymbolId, Quote>;
  ticks: Tick[];
  positions: Position[];
  history: ClosedTrade[];
  logs: LogLine[];
  equityHistory: EquityPoint[];
  hydrated: boolean;
  setHydrated: (v: boolean) => void;
  patchSettings: (partial: Partial<Settings>) => void;
  patchMt5: (partial: Partial<Mt5Account>) => void;
  setSelected: (symbol: SymbolId) => void;
  setConnectStatus: (status: ConnectStatus) => void;
  completeConnect: () => void;
  disconnect: () => void;
  arm: () => void;
  disarm: () => void;
  start: () => void;
  stop: () => void;
  resetAccount: () => void;
  pushLog: (kind: LogKind, text: string) => void;
  applyTick: (symbol: SymbolId, quote: Quote, tick: Tick) => void;
  maybeOpen: (symbol: SymbolId, side: Side) => void;
  managePositions: (symbol: SymbolId) => void;
  flatten: (reason: ClosedTrade["reason"]) => void;
  markLatency: (ms: number, tps: number) => void;
  snapshotEquity: () => void;
};

function revalue(positions: Position[], quotes: Record<SymbolId, Quote>): number {
  let sum = 0;
  for (const p of positions) {
    const q = quotes[p.symbol];
    const spec = SYMBOL_MAP[p.symbol];
    const px = p.side === "buy" ? (q?.bid ?? p.openPrice) : (q?.ask ?? p.openPrice);
    sum += positionPnl(spec, p.side, p.lots, p.openPrice, px);
  }
  return sum;
}

function marginSum(positions: Position[], quotes: Record<SymbolId, Quote>, leverage: number): number {
  let sum = 0;
  for (const p of positions) {
    const q = quotes[p.symbol];
    const spec = SYMBOL_MAP[p.symbol];
    sum += requiredMargin(spec, p.lots, q?.mid ?? p.openPrice, leverage);
  }
  return sum;
}

export const useEngineStore = create<EngineStore>()(
  persist(
    (set, get) => ({
      mt5: defaultMt5(),
      settings: defaultSettings(),
      account: defaultAccount(500),
      engine: {
        armed: false,
        running: false,
        targetHit: false,
        lastFillAt: 0,
        tickSeq: 0,
        latencyMs: 12,
        ticksPerSec: 0,
        selectedSymbol: "EURUSD",
      },
      quotes: defaultQuotes(),
      ticks: [],
      positions: [],
      history: [],
      logs: [],
      equityHistory: [],
      hydrated: false,
      setHydrated: (v) => set({ hydrated: v }),
      patchSettings: (partial) =>
        set((s) => ({
          settings: { ...s.settings, ...partial, symbols: partial.symbols ?? s.settings.symbols },
        })),
      patchMt5: (partial) => set((s) => ({ mt5: { ...s.mt5, ...partial } })),
      setSelected: (symbol) =>
        set((s) => ({
          engine: { ...s.engine, selectedSymbol: symbol },
          ticks: [],
        })),
      setConnectStatus: (status) => set((s) => ({ mt5: { ...s.mt5, status } })),
      completeConnect: () => {
        const { mt5, account, equityHistory } = get();
        set({
          mt5: { ...mt5, status: "online", connectedAt: Date.now() },
          quotes: defaultQuotes(),
          ticks: [],
          equityHistory: equityHistory.length
            ? equityHistory
            : [{ t: Date.now(), equity: account.equity }],
        });
        get().pushLog("info", `MT5 ${mt5.login} · ${mt5.server || mt5.broker} lié`);
      },
      disconnect: () => {
        get().flatten("flatten");
        set((s) => ({
          mt5: { ...s.mt5, status: "offline", connectedAt: null },
          engine: { ...s.engine, armed: false, running: false, targetHit: false },
        }));
        get().pushLog("warn", "Pont MT5 déconnecté");
      },
      arm: () => {
        if (get().mt5.status !== "online") return;
        set((s) => ({
          engine: { ...s.engine, armed: true, targetHit: false },
          account: {
            ...s.account,
            sessionStartEquity: s.account.equity,
            sessionPnl: 0,
          },
        }));
        get().pushLog("info", "Robot armé — prêt à tirer");
      },
      disarm: () => {
        set((s) => ({ engine: { ...s.engine, armed: false, running: false } }));
        get().pushLog("warn", "Robot désarmé");
      },
      start: () => {
        const s = get();
        if (s.mt5.status !== "online" || !s.engine.armed) return;
        set({
          engine: { ...s.engine, running: true, targetHit: false },
          account: {
            ...s.account,
            sessionStartEquity: s.account.equity,
            sessionPnl: 0,
          },
        });
        get().pushLog("info", `ULTRA SCALPER PRO · ${s.settings.powerMode.toUpperCase()} · ${s.settings.lotSize} lot`);
      },
      stop: () => {
        set((s) => ({ engine: { ...s.engine, running: false } }));
        get().pushLog("warn", "Entrées stoppées — positions laissées ouvertes");
      },
      resetAccount: () => {
        const { settings } = get();
        get().flatten("flatten");
        set({
          account: defaultAccount(settings.initialBalance),
          history: [],
          equityHistory: [{ t: Date.now(), equity: settings.initialBalance }],
          engine: {
            ...get().engine,
            running: false,
            armed: false,
            targetHit: false,
          },
        });
        get().pushLog("info", `Compte réinitialisé à ${settings.initialBalance} USD`);
      },
      pushLog: (kind, text) =>
        set((s) => ({
          logs: [{ id: uid("l"), t: Date.now(), kind, text }, ...s.logs].slice(0, 80),
        })),
      applyTick: (symbol, quote, tick) => {
        const selected = get().engine.selectedSymbol;
        set((s) => {
          const ticks =
            symbol === selected ? [...s.ticks, tick].slice(-240) : s.ticks;
          return {
            quotes: { ...s.quotes, [symbol]: quote },
            ticks,
            engine: { ...s.engine, tickSeq: s.engine.tickSeq + 1 },
          };
        });
      },
      maybeOpen: (symbol, side) => {
        const s = get();
        if (!s.engine.running || !s.engine.armed || s.engine.targetHit) return;
        if (!s.settings.symbols[symbol]) return;
        const spec = SYMBOL_MAP[symbol];
        const q = s.quotes[symbol];
        if (!q) return;
        const profile = powerProfile(s.settings.powerMode);
        if (Date.now() - s.engine.lastFillAt < profile.cooldownMs) return;
        if (s.positions.length >= s.settings.maxConcurrent) return;
        const per = s.positions.filter((p) => p.symbol === symbol).length;
        if (per >= s.settings.maxPerSymbol) return;
        if (q.spread > spec.spread * s.settings.maxSpreadMult) return;

        const lots = s.settings.lotSize;
        const px = side === "buy" ? q.ask : q.bid;
        const margin = requiredMargin(spec, lots, px, s.mt5.leverage);
        const free = s.account.equity - s.account.marginUsed;
        if (margin > free * 0.92) {
          if (s.logs[0]?.text !== "Marge insuffisante — ticket ignoré") {
            get().pushLog("warn", "Marge insuffisante — ticket ignoré");
          }
          return;
        }

        const lv = levelsFor(spec, side, px, s.settings.powerMode);
        const pos: Position = {
          id: uid("p"),
          symbol,
          side,
          lots,
          openPrice: px,
          sl: lv.sl,
          tp: lv.tp,
          trail: lv.trail,
          openedAt: Date.now(),
          pnl: 0,
          magic: s.settings.magic,
        };
        const positions = [...s.positions, pos];
        const marginUsed = marginSum(positions, s.quotes, s.mt5.leverage);
        set({
          positions,
          account: { ...s.account, marginUsed },
          engine: { ...s.engine, lastFillAt: Date.now() },
        });
        get().pushLog(
          "fill",
          `${side === "buy" ? "BUY" : "SELL"} ${lots.toFixed(2)} ${symbol} @ ${px.toFixed(spec.digits)}`,
        );
      },
      managePositions: (symbol) => {
        const s = get();
        const q = s.quotes[symbol];
        const spec = SYMBOL_MAP[symbol];
        if (!q) return;
        const hold = s.settings.holdMs * powerProfile(s.settings.powerMode).holdScale;
        const still: Position[] = [];
        const closed: ClosedTrade[] = [];
        let realized = 0;

        for (const p of s.positions) {
          if (p.symbol !== symbol) {
            still.push(p);
            continue;
          }
          const px = p.side === "buy" ? q.bid : q.ask;
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
          } else {
            if (px >= sl) reason = sl === p.sl ? "sl" : "trail";
            else if (px <= p.tp) reason = "tp";
          }
          if (!reason && Date.now() - p.openedAt > hold) reason = "time";

          if (reason) {
            realized += pnl;
            closed.push({
              id: p.id,
              symbol: p.symbol,
              side: p.side,
              lots: p.lots,
              openPrice: p.openPrice,
              closePrice: px,
              openedAt: p.openedAt,
              closedAt: Date.now(),
              pnl,
              reason,
            });
          } else {
            still.push({ ...p, sl, pnl });
          }
        }

        if (closed.length === 0 && still.length === s.positions.length) {
          const floating = revalue(still, s.quotes);
          const equity = s.account.balance + floating;
          const sessionPnl = equity - s.account.sessionStartEquity;
          set({
            positions: still.map((p) => {
              if (p.symbol !== symbol) return p;
              return p;
            }),
            account: {
              ...s.account,
              equity,
              sessionPnl,
              peakEquity: Math.max(s.account.peakEquity, equity),
              marginUsed: marginSum(still, s.quotes, s.mt5.leverage),
            },
          });
          maybeTarget(get);
          return;
        }

        for (const c of closed) {
          const tag =
            c.reason === "tp"
              ? "TP"
              : c.reason === "sl"
                ? "SL"
                : c.reason === "trail"
                  ? "TRAIL"
                  : "TIME";
          get().pushLog(
            "close",
            `${tag} ${c.symbol} ${c.pnl >= 0 ? "+" : ""}${c.pnl.toFixed(2)} USD`,
          );
        }

        const balance = s.account.balance + realized;
        const floating = revalue(still, { ...s.quotes });
        const equity = balance + floating;
        const sessionPnl = equity - s.account.sessionStartEquity;
        set({
          positions: still,
          history: [...closed, ...s.history].slice(0, 180),
          account: {
            ...s.account,
            balance,
            equity,
            sessionPnl,
            peakEquity: Math.max(s.account.peakEquity, equity),
            marginUsed: marginSum(still, s.quotes, s.mt5.leverage),
          },
        });
        maybeTarget(get);
      },
      flatten: (reason) => {
        const s = get();
        if (s.positions.length === 0) {
          set({
            account: { ...s.account, marginUsed: 0, equity: s.account.balance, sessionPnl: s.account.balance - s.account.sessionStartEquity },
          });
          return;
        }
        const closed: ClosedTrade[] = [];
        let realized = 0;
        for (const p of s.positions) {
          const q = s.quotes[p.symbol];
          const spec = SYMBOL_MAP[p.symbol];
          const px = p.side === "buy" ? (q?.bid ?? p.openPrice) : (q?.ask ?? p.openPrice);
          const pnl = positionPnl(spec, p.side, p.lots, p.openPrice, px);
          realized += pnl;
          closed.push({
            id: p.id,
            symbol: p.symbol,
            side: p.side,
            lots: p.lots,
            openPrice: p.openPrice,
            closePrice: px,
            openedAt: p.openedAt,
            closedAt: Date.now(),
            pnl,
            reason,
          });
        }
        const balance = s.account.balance + realized;
        set({
          positions: [],
          history: [...closed, ...s.history].slice(0, 180),
          account: {
            ...s.account,
            balance,
            equity: balance,
            marginUsed: 0,
            sessionPnl: balance - s.account.sessionStartEquity,
            peakEquity: Math.max(s.account.peakEquity, balance),
          },
        });
        get().pushLog("warn", `Aplatissement ${closed.length} ticket(s)`);
      },
      markLatency: (ms, tps) =>
        set((s) => ({ engine: { ...s.engine, latencyMs: ms, ticksPerSec: tps } })),
      snapshotEquity: () =>
        set((s) => ({
          equityHistory: [
            ...s.equityHistory,
            { t: Date.now(), equity: s.account.equity },
          ].slice(-240),
        })),
    }),
    {
      name: "usp-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        mt5: s.mt5,
        settings: s.settings,
        account: s.account,
        history: s.history.slice(0, 80),
        equityHistory: s.equityHistory.slice(-120),
        logs: s.logs.slice(0, 40),
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<EngineStore> | undefined;
        if (!p) return current;
        return {
          ...current,
          mt5: { ...current.mt5, ...p.mt5, status: p.mt5?.status === "online" ? "online" : "offline" },
          settings: { ...current.settings, ...p.settings, symbols: { ...ALL_ON, ...p.settings?.symbols } },
          account: { ...current.account, ...p.account },
          history: p.history ?? current.history,
          equityHistory: p.equityHistory ?? current.equityHistory,
          logs: p.logs ?? current.logs,
        };
      },
    },
  ),
);

function maybeTarget(get: () => EngineStore) {
  const s = get();
  if (s.engine.targetHit || !s.engine.running) return;
  const under =
    s.account.startBalance < s.settings.autoCloseUnder ||
    s.account.balance < s.settings.autoCloseUnder;
  if (!under) return;
  if (s.account.sessionPnl < s.settings.autoCloseUsd) return;
  get().flatten("target");
  useEngineStore.setState((st) => ({
    engine: { ...st.engine, running: false, armed: false, targetHit: true },
  }));
  useEngineStore.getState().pushLog(
    "target",
    `Objectif +${s.settings.autoCloseUsd} USD atteint — session close`,
  );
}
