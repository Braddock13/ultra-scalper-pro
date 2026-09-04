import type { SymbolId, SymbolSpec } from "./types";

export const SYMBOL_LIST: SymbolSpec[] = [
  {
    id: "EURUSD",
    label: "EUR/USD",
    digits: 5,
    pip: 0.0001,
    contract: 100_000,
    spread: 0.00008,
    tickSize: 0.00001,
    vol: 0.000012,
    minAtr: 0.00004,
    slPips: 7,
    tpPips: 5,
    trailPips: 3,
  },
  {
    id: "GBPUSD",
    label: "GBP/USD",
    digits: 5,
    pip: 0.0001,
    contract: 100_000,
    spread: 0.00012,
    tickSize: 0.00001,
    vol: 0.000016,
    minAtr: 0.00005,
    slPips: 8,
    tpPips: 5,
    trailPips: 3,
  },
  {
    id: "USDJPY",
    label: "USD/JPY",
    digits: 3,
    pip: 0.01,
    contract: 100_000,
    spread: 0.012,
    tickSize: 0.001,
    vol: 0.012,
    minAtr: 0.008,
    slPips: 8,
    tpPips: 5,
    trailPips: 3,
  },
  {
    id: "XAUUSD",
    label: "XAU/USD",
    digits: 2,
    pip: 0.1,
    contract: 100,
    spread: 0.18,
    tickSize: 0.01,
    vol: 0.12,
    minAtr: 0.08,
    slPips: 14,
    tpPips: 9,
    trailPips: 5,
  },
  {
    id: "BTCUSD",
    label: "BTC/USD",
    digits: 1,
    pip: 1,
    contract: 1,
    spread: 8,
    tickSize: 0.1,
    vol: 6.4,
    minAtr: 4,
    slPips: 18,
    tpPips: 12,
    trailPips: 7,
  },
];

export const SYMBOL_MAP: Record<SymbolId, SymbolSpec> = Object.fromEntries(
  SYMBOL_LIST.map((s) => [s.id, s]),
) as Record<SymbolId, SymbolSpec>;

export const ANCHORS: Record<SymbolId, number> = {
  EURUSD: 1.0852,
  GBPUSD: 1.2714,
  USDJPY: 148.62,
  XAUUSD: 2492.4,
  BTCUSD: 64150,
};

export const BROKERS: { name: string; server: string }[] = [
  { name: "IC Markets", server: "ICMarketsSC-MT5" },
  { name: "Exness", server: "Exness-MT5Real" },
  { name: "Pepperstone", server: "Pepperstone-MT5-Live01" },
  { name: "XM", server: "XMGlobal-MT5" },
  { name: "FTMO", server: "FTMO-Server" },
  { name: "Fusion Markets", server: "FusionMarkets-Live" },
  { name: "RoboForex", server: "RoboForex-ECN" },
  { name: "Tickmill", server: "Tickmill-Live" },
  { name: "OANDA", server: "OANDA-MT5" },
  { name: "Autre / personnalisé", server: "" },
];

export const LEVERAGES = [50, 100, 200, 500, 1000] as const;
