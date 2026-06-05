import type {
  Candle,
  KlineSubscription,
  TickHandler,
  Timeframe,
  Ticker24h,
  SymbolInfo,
  DataProvider,
} from "./types";
import { shouldAutoPollStocks, nextUtcMidnightMs } from "./market-hours";

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
 * Twelve Data free tier: 8 credits/min AND 800 credits/day, billed per
 * symbol. Continuous polling drains 800/day in a few hours, so stocks are
 * treated as SNAPSHOT data, not live:
 *
 * - The chart loads once (PriceChart's initial fetchKlines); subscribeKline
 *   then refreshes the last bar slowly and only when the tab is visible AND
 *   the US market is open.
 * - The watchlist fetches once on mount, then refreshes on the same slow,
 *   gated cadence.
 * - A manual refresh button (see PriceChart) bypasses the gate for an
 *   on-demand pull.
 *
 * 5-minute cadence, gated, means a single visible stock chart costs ~12
 * credits/hour during market hours and 0 when closed/backgrounded.
 */
const KLINE_POLL_MS = 300_000;
const TICKER_POLL_MS = 300_000;

// ─── Client-side rate-limit back-off (persisted across reloads) ───
//
// When any API route forwards a 429 from upstream, all subsequent calls
// short-circuit for RATE_LIMIT_COOLDOWN_MS so we don't keep hammering
// Twelve Data while their bucket refills. The deadline is persisted in
// localStorage so a page refresh during the cooldown doesn't reset
// it — otherwise the post-refresh load burst would re-trip the limit
// immediately.

const MINUTE_COOLDOWN_MS = 60_000;
const RATE_LIMIT_KEY = "td-rate-limit-until";
const RATE_LIMIT_SCOPE_KEY = "td-rate-limit-scope";

/** Window event fired when the per-day quota is exhausted, so the UI can
 *  surface a modal. Listen via window.addEventListener(DAILY_LIMIT_EVENT). */
export const DAILY_LIMIT_EVENT = "twelvedata:daily-limit";

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

/**
 * If the per-day quota cooldown is currently active, return its deadline
 * (epoch ms of the next UTC midnight); otherwise null. The UI uses the
 * deadline as a stable id so it shows the "quota exhausted" modal once per
 * exhaustion period and again only when a fresh one starts.
 */
export function getStocksDailyLimitDeadline(): number | null {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(RATE_LIMIT_SCOPE_KEY) !== "day") return null;
  const deadline = readPersistedDeadline();
  return Date.now() < deadline ? deadline : null;
}

/**
 * Engage the cooldown. A per-minute limit pauses for 60 s; the per-day
 * quota pauses until the next UTC midnight (when Twelve Data resets it) so
 * we stop the every-60s retry loop that otherwise re-trips the exhausted
 * daily quota forever. A day-scope hit also fires DAILY_LIMIT_EVENT.
 */
function markRateLimited(scope: "day" | "minute") {
  rateLimitedUntil =
    scope === "day" ? nextUtcMidnightMs() : Date.now() + MINUTE_COOLDOWN_MS;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(RATE_LIMIT_KEY, String(rateLimitedUntil));
    window.localStorage.setItem(RATE_LIMIT_SCOPE_KEY, scope);
  }
  console.warn(
    `[twelvedata] ${scope} rate-limit hit; pausing requests until`,
    new Date(rateLimitedUntil).toLocaleString(),
  );
  if (scope === "day" && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DAILY_LIMIT_EVENT));
  }
}

async function rateAwareFetch(url: string, init?: RequestInit): Promise<Response> {
  if (isRateLimited()) {
    throw new Error("twelvedata: rate-limit cooldown active");
  }
  const res = await fetch(url, init);
  if (res.status === 429) {
    // Route tags the scope in the body: { error: "rate_limited", scope }.
    let scope: "day" | "minute" = "minute";
    try {
      const body = (await res.clone().json()) as { scope?: "day" | "minute" };
      if (body.scope === "day") scope = "day";
    } catch {
      // default to minute
    }
    markRateLimited(scope);
    throw new Error(`twelvedata: rate-limit cooldown engaged (${scope})`);
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
 * Slow, gated refresh of the active chart's last bar. The PriceChart
 * consumer already did the initial full load, so this only keeps the
 * latest bar fresh. Interval ticks are skipped when the tab is hidden or
 * the US market is closed — no immediate poll here (the chart already has
 * data; the manual refresh button covers on-demand pulls).
 */
function subscribeKline(sub: KlineSubscription): () => void {
  let cancelled = false;

  const poll = async () => {
    if (cancelled || !shouldAutoPollStocks()) return;
    try {
      const klines = await fetchKlines(sub.symbol, sub.interval, 2);
      if (cancelled) return;
      for (const k of klines) sub.onCandle({ ...k, isFinal: false });
    } catch (e) {
      console.warn("[twelvedata] kline poll failed:", e);
    }
  };

  const id = setInterval(poll, KLINE_POLL_MS);
  return () => {
    cancelled = true;
    clearInterval(id);
  };
}

function subscribeMiniTickers(symbols: string[], onTick: TickHandler): () => void {
  if (symbols.length === 0) return () => {};
  let cancelled = false;

  const poll = async (force = false) => {
    // Initial poll (force) always runs so the watchlist shows the last
    // close even outside market hours. Interval polls are gated.
    if (cancelled || (!force && !shouldAutoPollStocks())) return;
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

  poll(true);
  const id = setInterval(() => poll(false), TICKER_POLL_MS);
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
  // Snapshot model: BottomPanel refreshes the active stock quote slowly
  // (5 min) and only when visible + market open (BottomPanel gates on
  // provider.market === "stocks").
  pollingIntervalMs: 300_000,

  fetchKlines,
  fetchTicker24h,
  fetchTickers24h,
  fetchSymbols,

  subscribeKline,
  subscribeMiniTickers,
};
