// Canonical data shapes are re-exported from this module so the rest of the
// app imports them via `@/lib/providers/types`, not via a specific broker
// directory. Adding a new broker becomes a single-file change.
export type {
  Candle,
  Timeframe,
  Ticker24h,
  SymbolInfo,
} from "@/lib/binance/types";

import type { Candle, Timeframe, Ticker24h, SymbolInfo } from "@/lib/binance/types";

export interface KlineSubscription {
  symbol: string;
  interval: Timeframe;
  onCandle: (c: Candle) => void;
}

export interface TickEvent {
  symbol: string;
  close: number;
  open: number;
  pct: number;
}

export type TickHandler = (t: TickEvent) => void;

export type MarketKind = "crypto" | "stocks" | "forex" | "futures";

export interface DataProvider {
  /** Stable identifier persisted in the store (e.g. "binance", "finnhub"). */
  id: string;
  /** Human-readable label shown in the UI. */
  name: string;
  /** Market category for grouping and UX hints (market hours, etc). */
  market: MarketKind;
  /** Default symbol when this provider is selected for the first time. */
  defaultSymbol: string;
  /**
   * Recommended cadence (ms) for REST polling of single-symbol quote
   * endpoints (e.g. BottomPanel ticker). Providers with strict per-minute
   * rate limits set higher values to stay inside the budget. Defaults to
   * 5000 ms when omitted.
   */
  pollingIntervalMs?: number;

  // REST
  fetchKlines(symbol: string, interval: Timeframe, limit?: number): Promise<Candle[]>;
  fetchTicker24h(symbol: string): Promise<Ticker24h>;
  fetchTickers24h(symbols: string[]): Promise<Ticker24h[]>;
  fetchSymbols(): Promise<SymbolInfo[]>;

  // WebSocket — returns an unsubscribe function
  subscribeKline(sub: KlineSubscription): () => void;
  subscribeMiniTickers(symbols: string[], onTick: TickHandler): () => void;
}
