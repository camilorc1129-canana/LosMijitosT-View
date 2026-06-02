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
 * Default watchlist when the user first switches to Twelve Data. Free tier
 * doesn't expose direct commodity feeds (BRENT/WTI require Pro), so oil
 * exposure is taken via NYSE-listed ETFs which work fine on free.
 */
export const DEFAULT_TWELVEDATA_WATCHLIST: string[] = [
  "PBR",   // Petrobras (NYSE ADR)
  "AAPL",  // Apple
  "TSLA",  // Tesla
  "MSFT",  // Microsoft
  "GOOGL", // Alphabet
  "NVDA",  // Nvidia
  "HAL",   // Halliburton
  "XOM",   // Exxon Mobil
  "SLB",   // Schlumberger
  "BNO",   // Brent Oil ETF (proxy — direct BRENT requires Pro)
  "USO",   // WTI Oil ETF  (proxy — direct WTI requires Pro)
];

/**
 * Polling cadence for the chart's "live" candle and watchlist tickers.
 * Twelve Data free tier allows 8 requests/minute per key. Two pollers at
 * 15 s each = 8 req/min total, exactly inside the limit. Stocks only
 * trade during market hours so faster polling buys little.
 */
const KLINE_POLL_MS = 15_000;
const TICKER_POLL_MS = 15_000;

// ─── REST helpers (hit our own API routes; key stays server-side) ───

async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
): Promise<Candle[]> {
  const url = `/api/twelvedata/candles?symbol=${encodeURIComponent(symbol)}&tf=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`twelvedata candles ${res.status} ${body}`);
  }
  return res.json() as Promise<Candle[]>;
}

async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const url = `/api/twelvedata/quote?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`twelvedata quote ${res.status}`);
  return res.json() as Promise<Ticker24h>;
}

async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  if (symbols.length === 0) return [];
  const url = `/api/twelvedata/quote-batch?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`twelvedata quote-batch ${res.status}`);
  return res.json() as Promise<Ticker24h[]>;
}

async function fetchSymbols(): Promise<SymbolInfo[]> {
  const res = await fetch("/api/twelvedata/symbols", { cache: "force-cache" });
  if (!res.ok) throw new Error(`twelvedata symbols ${res.status}`);
  return res.json() as Promise<SymbolInfo[]>;
}

// ─── "Live" updates via polling (no free-tier WebSocket) ───

/**
 * For each kline subscription, re-fetch the last ~2 candles every
 * KLINE_POLL_MS. The PriceChart consumer already handles
 * "same time → update last bar, new time → append" so passing the latest
 * bar via onCandle is enough to keep the chart in sync.
 *
 * We request a small `limit=2` to keep the upstream payload tiny — only
 * the in-progress bar and the immediately preceding one to bridge bucket
 * transitions if a poll lands right after the bucket closed.
 */
function subscribeKline(sub: KlineSubscription): () => void {
  let cancelled = false;

  const poll = async () => {
    if (cancelled) return;
    try {
      const klines = await fetchKlines(sub.symbol, sub.interval, 2);
      if (cancelled) return;
      for (const k of klines) sub.onCandle({ ...k, isFinal: false });
    } catch (e) {
      console.warn("[twelvedata] kline poll failed:", e);
    }
  };

  poll();
  const id = setInterval(poll, KLINE_POLL_MS);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

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
      console.warn("[twelvedata] miniTicker poll failed:", e);
    }
  };

  poll();
  const id = setInterval(poll, TICKER_POLL_MS);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

export const twelvedataProvider: DataProvider = {
  id: "twelvedata",
  name: "Twelve Data",
  market: "stocks",
  defaultSymbol: "AAPL",
  // 8 req/min budget on free tier; 15 s keeps the BottomPanel + chart +
  // watchlist combined under that ceiling.
  pollingIntervalMs: 15_000,

  fetchKlines,
  fetchTicker24h,
  fetchTickers24h,
  fetchSymbols,

  subscribeKline,
  subscribeMiniTickers,
};
