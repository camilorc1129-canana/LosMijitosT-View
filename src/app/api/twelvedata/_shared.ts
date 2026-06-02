import type { Timeframe } from "@/lib/binance/types";

export const TWELVEDATA_BASE = "https://api.twelvedata.com";

/**
 * Maps our canonical Timeframe to Twelve Data's `interval` string.
 * Timeframes not in this map are unsupported by Twelve Data.
 */
export const TWELVEDATA_INTERVAL: Partial<Record<Timeframe, string>> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "30m": "30min",
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "1d": "1day",
  "1w": "1week",
  "1M": "1month",
};

export function getApiKey(): string | null {
  return process.env.TWELVEDATA_API_KEY ?? null;
}

export function missingKeyResponse(): Response {
  return Response.json(
    { error: "TWELVEDATA_API_KEY is not configured on the server" },
    { status: 500 },
  );
}
