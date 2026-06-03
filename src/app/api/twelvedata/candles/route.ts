import type { NextRequest } from "next/server";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  TWELVEDATA_BASE,
  TWELVEDATA_INTERVAL,
  getApiKey,
  missingKeyResponse,
} from "../_shared";

interface TwelveDataValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

interface TwelveDataResponse {
  status?: "ok" | "error";
  values?: TwelveDataValue[];
  message?: string;
  code?: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");
  const tf = searchParams.get("tf") as Timeframe | null;
  const limit = Math.max(1, Math.min(5000, parseInt(searchParams.get("limit") ?? "1000", 10)));

  if (!symbol || !tf) {
    return Response.json({ error: "missing 'symbol' or 'tf'" }, { status: 400 });
  }

  const interval = TWELVEDATA_INTERVAL[tf];
  if (!interval) {
    return Response.json(
      { error: `timeframe '${tf}' not supported by Twelve Data` },
      { status: 400 },
    );
  }

  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  const url = `${TWELVEDATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${limit}&apikey=${apiKey}&order=ASC`;

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (upstream.status === 429) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    if (!upstream.ok) {
      const body = await upstream.text();
      return Response.json(
        { error: `twelvedata ${upstream.status}: ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const data = (await upstream.json()) as TwelveDataResponse;
    // Twelve Data also surfaces rate-limit errors with HTTP 200 + code 429
    // in the body. Forward as 429 so the client can back off.
    if (data.code === 429) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    if (data.status === "error" || !data.values) {
      return Response.json(
        { error: `twelvedata: ${data.message ?? "no data"}` },
        { status: 502 },
      );
    }

    const candles: Candle[] = data.values.map((v) => ({
      // Twelve Data returns datetime as "YYYY-MM-DD HH:mm:ss" in UTC for
      // intraday intervals, or "YYYY-MM-DD" for daily+. Date.parse handles
      // ISO-ish formats; for the daily case the time defaults to 00:00 UTC
      // which matches what lightweight-charts expects for a daily bar.
      time: Math.floor(Date.parse(v.datetime.replace(" ", "T") + "Z") / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : 0,
      isFinal: true,
    }));

    return Response.json(candles, {
      headers: { "Cache-Control": "s-maxage=10, stale-while-revalidate=60" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
