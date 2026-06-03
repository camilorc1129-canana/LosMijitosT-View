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
 * Default watchlist when the user first switches to Twelve Data. Kept
 * intentionally short because Twelve Data bills /quote-batch per symbol
 * — every entry here is a credit per watchlist poll. Free tier sustains
 * roughly a 5-6 symbol watchlist comfortably; add more only if you
 * upgrade or accept slower watchlist refresh rates.
 *
 * Oil exposure via BNO (Brent ETF) and USO (WTI ETF) because direct
 * BRENT/WTI feeds require Twelve Data Pro.
 */
export const DEFAULT_TWELVEDATA_WATCHLIST: string[] = [
  "PBR",   // Petrobras (NYSE ADR)
  "AAPL",  // Apple
  "XOM",   // Exxon Mobil
  "HAL",   // Halliburton
  "BNO",   // Brent Oil ETF (proxy)
];

/**
 * Polling cadences tuned for Twelve Data's 8 credits/min free tier.
 *
 * IMPORTANT: Twelve Data bills the quote-batch endpoint **per symbol**,
 * not per request. A watchlist of N symbols consumed every poll = N
 * credits. With N=10 and polling every 60 s the watchlist alone burns
 * 10 credits/min, exceeding the budget before the chart even loads.
 *
 * Compromise: poll the watchlist every 5 minutes (12 credits/5min =
 * 2.4/min averaged for a 10-symbol list). The chart and BottomPanel
 * use single-symbol endpoints which cost 1 credit each.
 *
 * - Chart at 25 s → 3 credits/min
 * - BottomPanel at 60 s → 1 credit/min (via pollingIntervalMs)
 * - Watchlist at 300 s → ~2 credits/min averaged for 10 symbols
 *
 * Steady-state ≈ 6 credits/min on a 10-symbol watchlist. Symbol changes
 * cost an extra 2 credits each (1 chart + 1 quote), so a few clicks/min
 * still fit before the back-off cooldown kicks in.
 */
const KLINE_POLL_MS = 25_000;
const TICKER_POLL_MS = 300_000;

// ─── Client-side rate-limit back-off (persisted across reloads) ───
//
// When any API route forwards a 429 from upstream, all subsequent calls
// short-circuit for RATE_LIMIT_COOLDOWN_MS so we don't keep hammering
// Twelve Data while their bucket refills. The deadline is persisted in
// localStorage so a page refresh during the cooldown doesn't reset
// it — otherwise the post-refresh load burst would re-trip the limit
// immediately.

const RATE_LIMIT_COOLDOWN_MS = 60_000;
const RATE_LIMIT_KEY = "td-rate-limit-until";

function readPersistedDeadline(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(RATE_LIMIT_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

let rateLimitedUntil = readPersistedDeadline();

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function markRateLimited() {
  rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RATE_LIMIT_KEY, String(rateLimitedUntil));
  }
  console.warn(
    "[twelvedata] rate-limit hit; pausing requests until",
    new Date(rateLimitedUntil).toLocaleTimeString(),
  );
}

async function rateAwareFetch(url: string, init?: RequestInit): Promise<Response> {
  if (isRateLimited()) {
    throw new Error("twelvedata: rate-limit cooldown active");
  }
  const res = await fetch(url, init);
  if (res.status === 429) {
    markRateLimited();
    throw new Error("twelvedata: rate-limit cooldown engaged");
  }
  return res;
}

// ─── REST helpers (hit our own API routes; key stays server-side) ───

async function fetchKlines(
  symbol: string,
  interval: Timeframe,
  limit = 1000,
): Promise<Candle[]> {
  const url = `/api/twelvedata/candles?symbol=${encodeURIComponent(symbol)}&tf=${interval}&limit=${limit}`;
  const res = await rateAwareFetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`twelvedata candles ${res.status} ${body}`);
  }
  return res.json() as Promise<Candle[]>;
}

async function fetchTicker24h(symbol: string): Promise<Ticker24h> {
  const url = `/api/twelvedata/quote?symbol=${encodeURIComponent(symbol)}`;
  const res = await rateAwareFetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`twelvedata quote ${res.status}`);
  return res.json() as Promise<Ticker24h>;
}

async function fetchTickers24h(symbols: string[]): Promise<Ticker24h[]> {
  if (symbols.length === 0) return [];
  const url = `/api/twelvedata/quote-batch?symbols=${encodeURIComponent(symbols.join(","))}`;
  const res = await rateAwareFetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`twelvedata quote-batch ${res.status}`);
  return res.json() as Promise<Ticker24h[]>;
}

async function fetchSymbols(): Promise<SymbolInfo[]> {
  const res = await rateAwareFetch("/api/twelvedata/symbols", { cache: "force-cache" });
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
  // 8 req/min budget; 60 s for the BottomPanel pairs with chart 25 s and
  // watchlist 60 s so the first-minute burst tops out at 7 calls.
  pollingIntervalMs: 60_000,

  fetchKlines,
  fetchTicker24h,
  fetchTickers24h,
  fetchSymbols,

  subscribeKline,
  subscribeMiniTickers,
};
