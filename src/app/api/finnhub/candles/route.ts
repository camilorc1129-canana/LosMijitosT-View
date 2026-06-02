import type { NextRequest } from "next/server";
import type { Candle, Timeframe } from "@/lib/binance/types";
import {
  FINNHUB_BASE,
  FINNHUB_RESOLUTION,
  FINNHUB_TF_SECONDS,
  getApiKey,
  missingKeyResponse,
} from "../_shared";

interface FinnhubCandleResponse {
  s: string; // "ok" | "no_data" | error
  c?: number[];
  h?: number[];
  l?: number[];
  o?: number[];
  t?: number[];
  v?: number[];
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");
  const tf = searchParams.get("tf") as Timeframe | null;
  const limit = Math.max(1, Math.min(5000, parseInt(searchParams.get("limit") ?? "1000", 10)));

  if (!symbol || !tf) {
    return Response.json({ error: "missing 'symbol' or 'tf'" }, { status: 400 });
  }

  const resolution = FINNHUB_RESOLUTION[tf];
  const tfSec = FINNHUB_TF_SECONDS[tf];
  if (!resolution || !tfSec) {
    return Response.json(
      { error: `timeframe '${tf}' not supported by Finnhub` },
      { status: 400 },
    );
  }

  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  const to = Math.floor(Date.now() / 1000);
  const from = to - limit * tfSec;

  const url = `${FINNHUB_BASE}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;

  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      // 403 often means the symbol/endpoint requires a paid plan.
      const body = await upstream.text();
      return Response.json(
        { error: `finnhub ${upstream.status}: ${body.slice(0, 200)}` },
        { status: 502 },
      );
    }
    const data = (await upstream.json()) as FinnhubCandleResponse;
    if (data.s !== "ok" || !data.t) {
      return Response.json(
        { error: `finnhub no_data (s='${data.s}'). Free tier restricts stock candles; verify plan or symbol.` },
        { status: 502 },
      );
    }

    const candles: Candle[] = data.t.map((time, i) => ({
      time,
      open: data.o![i],
      high: data.h![i],
      low: data.l![i],
      close: data.c![i],
      volume: data.v![i],
      isFinal: true,
    }));

    return Response.json(candles, {
      headers: { "Cache-Control": "s-maxage=10, stale-while-revalidate=60" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
