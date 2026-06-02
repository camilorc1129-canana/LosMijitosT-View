import type { Timeframe } from "@/lib/binance/types";

export const FINNHUB_BASE = "https://finnhub.io/api/v1";

/**
 * Maps our canonical Timeframe to Finnhub's `resolution` string.
 * Timeframes not present here are unsupported by Finnhub.
 */
export const FINNHUB_RESOLUTION: Partial<Record<Timeframe, string>> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "30m": "30",
  "1h": "60",
  "1d": "D",
  "1w": "W",
  "1M": "M",
};

/**
 * Seconds per supported Finnhub timeframe — used to compute the `from`
 * timestamp on /stock/candle requests.
 */
export const FINNHUB_TF_SECONDS: Partial<Record<Timeframe, number>> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "1d": 86400,
  "1w": 604800,
  "1M": 2592000,
};

export function getApiKey(): string | null {
  return process.env.FINNHUB_API_KEY ?? null;
}

export function missingKeyResponse(): Response {
  return Response.json(
    { error: "FINNHUB_API_KEY is not configured on the server" },
    { status: 500 },
  );
}
