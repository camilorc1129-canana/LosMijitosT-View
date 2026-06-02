import type {
  Candle,
  KlineSubscription,
  TickHandler,
  Timeframe,
  Ticker24h,
  SymbolInfo,
  DataProvider,
} from "./types";

/**
 * Default watchlist surfaced when the Finnhub provider is first selected.
 * Energy and oil exposure is reached via NYSE-listed ETFs (USO, BNO)
 * because Finnhub's free tier doesn't expose direct WTI/Brent feeds.
 */
export const DEFAULT_FINNHUB_WATCHLIST: string[] = [
  "PBR",   // Petrobras (NYSE ADR)
  "AAPL",  // Apple
  "TSLA",  // Tesla
  "MSFT",  // Microsoft
  "GOOGL", // Alphabet
  "NVDA",  // Nvidia
  "HAL",   // Halliburton
  "XOM",   // Exxon Mobil
  "SLB",   // Schlumberger
  "USO",   // WTI Oil ETF (commodity proxy)
  "BNO",   // Brent Oil ETF (commodity proxy)
];

const FINNHUB_TIMEFRAME_SECONDS: Partial<Record<Timeframe, number>> = {
  "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
  "1h": 3600, "1d": 86400, "1w": 604800, "1M": 2592000,
};

interface RawTrade {
  /** Latest trade price */
  price: number;
  /** Trade timestamp in milliseconds (as delivered by Finnhub WS) */
  timeMs: number;
  /** Trade volume */
  volume: number;
}

/**
 * Pure function: given the in-progress candle for a symbol/timeframe and a
 * new trade, return the updated candle. Exported so the bucketing logic can
 * be unit-tested independently of the WebSocket plumbing.
 *
 * Algorithm:
 *  - bucketStart = floor(tradeSec / tfSec) * tfSec
 *  - If no current candle or the bucket changed → start a fresh candle whose
 *    OHLC are all = trade.price.
 *  - Otherwise → high = max, low = min, close = price, volume += trade.volume.
 *    Open and time are preserved.
 */
export function bucketTrade(
  current: Candle | null,
  trade: RawTrade,
  tfSec: number,
): Candle {
  const timeSec = Math.floor(trade.timeMs / 1000);
  const bucketStart = Math.floor(timeSec / tfSec) * tfSec;

  if (!current || current.time !== bucketStart) {
    return {
      time: bucketStart,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: trade.volume,
      isFinal: false,
    };
  }

  return {
    time: current.time,
    open: current.open,
    high: Math.max(current.high, trade.price),
    low: Math.min(current.low, trade.price),
    close: trade.price,
    volume: current.volume + trade.volume,
    isFinal: false,
  };
}

// ─── REST helpers (hit our own API routes; key stays server-side) ───

async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
): Promise<Candle[]> {
  const url = `/api/finnhub/candles?symbol=${encodeURIComponent(symbol)}&tf=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`finnhub candles ${res.status} ${body}`);
  }
  return res.json() as Promise<Candle[]>;
}

async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const url = `/api/finnhub/quote?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`finnhub quote ${res.status}`);
  return res.json() as Promise<Ticker24h>;
}

async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  if (symbols.length === 0) return [];
  const url = `/api/finnhub/quote-batch?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`finnhub quote-batch ${res.status}`);
  return res.json() as Promise<Ticker24h[]>;
}

async function fetchSymbols(): Promise<SymbolInfo[]> {
  const res = await fetch("/api/finnhub/symbols", { cache: "force-cache" });
  if (!res.ok) throw new Error(`finnhub symbols ${res.status}`);
  return res.json() as Promise<SymbolInfo[]>;
}

// ─── WebSocket — trades → buckets → onCandle ───

interface FinnhubTradeMsg {
  type: "trade";
  data: Array<{ s: string; p: number; t: number; v: number }>;
}

interface SubEntry {
  sub: KlineSubscription;
  current: Candle | null;
}

class FinnhubWS {
  private ws: WebSocket | null = null;
  private connected = false;
  private closing = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Active candle subscriptions keyed by `symbol|interval`. */
  private subs = new Map<string, SubEntry>();
  /** Set of symbols currently subscribed on the WS (for de-duplication). */
  private subscribedSymbols = new Set<string>();

  connect() {
    if (this.ws || this.closing) return;
    const token = process.env.NEXT_PUBLIC_FINNHUB_WS_TOKEN ?? "";
    if (!token) {
      console.error("[finnhub] NEXT_PUBLIC_FINNHUB_WS_TOKEN is missing; WS disabled");
      return;
    }
    this.ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      // Re-subscribe everything we had before the connection dropped.
      this.subscribedSymbols.clear();
      for (const { sub } of this.subs.values()) {
        this.sendSubscribe(sub.symbol);
      }
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as FinnhubTradeMsg | { type: string };
        if (msg.type === "trade" && "data" in msg && Array.isArray(msg.data)) {
          for (const t of msg.data) this.dispatchTrade(t.s, t.p, t.t, t.v);
        }
      } catch {
        // ignore
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      this.subscribedSymbols.clear();
      if (!this.closing) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private sendSubscribe(symbol: string) {
    if (!this.ws || !this.connected) return;
    if (this.subscribedSymbols.has(symbol)) return;
    this.ws.send(JSON.stringify({ type: "subscribe", symbol }));
    this.subscribedSymbols.add(symbol);
  }

  private sendUnsubscribe(symbol: string) {
    if (!this.ws || !this.connected) return;
    if (!this.subscribedSymbols.has(symbol)) return;
    this.ws.send(JSON.stringify({ type: "unsubscribe", symbol }));
    this.subscribedSymbols.delete(symbol);
  }

  private dispatchTrade(symbol: string, price: number, timeMs: number, volume: number) {
    for (const entry of this.subs.values()) {
      if (entry.sub.symbol !== symbol) continue;
      const tfSec = FINNHUB_TIMEFRAME_SECONDS[entry.sub.interval];
      if (!tfSec) continue;
      const next = bucketTrade(entry.current, { price, timeMs, volume }, tfSec);
      entry.current = next;
      entry.sub.onCandle({ ...next });
    }
  }

  subscribeKline(sub: KlineSubscription): () => void {
    const key = `${sub.symbol}|${sub.interval}`;
    this.subs.set(key, { sub, current: null });
    if (this.connected) {
      this.sendSubscribe(sub.symbol);
    } else {
      this.connect();
    }
    return () => {
      this.subs.delete(key);
      // Only unsubscribe from the WS when no other timeframe wants this symbol.
      const stillNeeded = [...this.subs.values()].some(
        (e) => e.sub.symbol === sub.symbol,
      );
      if (!stillNeeded) this.sendUnsubscribe(sub.symbol);
    };
  }

  close() {
    this.closing = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

let wsSingleton: FinnhubWS | null = null;
function getFinnhubWS(): FinnhubWS {
  if (typeof window === "undefined") return new FinnhubWS(); // SSR dummy
  if (!wsSingleton) wsSingleton = new FinnhubWS();
  return wsSingleton;
}

/**
 * `subscribeMiniTickers` for stocks uses polling, not WS:
 *  - Stock data only updates during market hours, so 5s cadence is plenty.
 *  - The Finnhub WS streams trades, not aggregated quotes — building a
 *    "tick" event from raw trades would require tracking previousClose per
 *    symbol, which polling /quote-batch gives us for free.
 */
function subscribeMiniTickers(symbols: string[], onTick: TickHandler): () => void {
  if (symbols.length === 0) return () => {};
  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;
    try {
      const tickers = await fetchTickers24h(symbols);
      if (cancelled) return;
      for (const t of tickers) {
        const open = t.lastPrice - t.priceChange;
        onTick({
          symbol: t.symbol,
          close: t.lastPrice,
          open,
          pct: t.priceChangePercent,
        });
      }
    } catch (e) {
      console.warn("[finnhub] miniTicker poll failed:", e);
    }
  };

  poll();
  const id = setInterval(poll, 5000);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

export const finnhubProvider: DataProvider = {
  id: "finnhub",
  name: "Finnhub",
  market: "stocks",
  defaultSymbol: "AAPL",

  fetchKlines,
  fetchTicker24h,
  fetchTickers24h,
  fetchSymbols,

  subscribeKline: (sub) => getFinnhubWS().subscribeKline(sub),
  subscribeMiniTickers,
};
