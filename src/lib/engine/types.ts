export type PowerMode = "ignition" | "ultra" | "overdrive";
export type Timeframe = "tick" | "s1" | "s5" | "s15" | "s30";
export type Side = "buy" | "sell";
export type EngineStatus = "idle" | "armed" | "running" | "target";
export type ConnectStatus = "offline" | "connecting" | "online";
export type LogKind = "info" | "fill" | "close" | "warn" | "target" | "error";

export type SymbolId = "EURUSD" | "GBPUSD" | "USDJPY" | "XAUUSD" | "BTCUSD";

export type SymbolSpec = {
  id: SymbolId;
  label: string;
  digits: number;
  pip: number;
  /** Dollar PnL for a 1.0 price move on 1.0 lot */
  contract: number;
  spread: number;
  tickSize: number;
  vol: number;
  minAtr: number;
  slPips: number;
  tpPips: number;
  trailPips: number;
};

export type Quote = {
  symbol: SymbolId;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  ts: number;
  dir: 1 | -1 | 0;
};

export type Tick = {
  t: number;
  mid: number;
  bid: number;
  ask: number;
};

export type Bar = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Position = {
  id: string;
  symbol: SymbolId;
  side: Side;
  lots: number;
  openPrice: number;
  sl: number;
  tp: number;
  trail: number | null;
  openedAt: number;
  pnl: number;
  magic: number;
};

export type ClosedTrade = {
  id: string;
  symbol: SymbolId;
  side: Side;
  lots: number;
  openPrice: number;
  closePrice: number;
  openedAt: number;
  closedAt: number;
  pnl: number;
  reason: "sl" | "tp" | "trail" | "time" | "flatten" | "target";
};

export type LogLine = {
  id: string;
  t: number;
  kind: LogKind;
  text: string;
};

export type EquityPoint = {
  t: number;
  equity: number;
};

export type Mt5Account = {
  login: string;
  password: string;
  server: string;
  broker: string;
  leverage: number;
  status: ConnectStatus;
  connectedAt: number | null;
  gatewayUrl: string;
};

export type Settings = {
  lotSize: number;
  maxConcurrent: number;
  maxPerSymbol: number;
  powerMode: PowerMode;
  timeframe: Timeframe;
  autoCloseUsd: number;
  autoCloseUnder: number;
  initialBalance: number;
  magic: number;
  maxSpreadMult: number;
  holdMs: number;
  symbols: Record<SymbolId, boolean>;
};

export type AccountState = {
  startBalance: number;
  balance: number;
  equity: number;
  marginUsed: number;
  sessionStartEquity: number;
  sessionPnl: number;
  peakEquity: number;
};

export type EngineFlags = {
  armed: boolean;
  running: boolean;
  targetHit: boolean;
  lastFillAt: number;
  tickSeq: number;
  latencyMs: number;
  ticksPerSec: number;
  selectedSymbol: SymbolId;
};
