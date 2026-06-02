import type { NextRequest } from "next/server";
import type { Ticker24h } from "@/lib/binance/types";
import { FINNHUB_BASE, getApiKey, missingKeyResponse } from "../_shared";

interface FinnhubQuoteResponse {
  c: number;  // current
  d: number;  // change
  dp: number; // change percent
  h: number;  // day high
  l: number;  // day low
  o: number;  // day open
  pc: number; // previous close
  t: number;  // timestamp (s)
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");
  if (!symbol) return Response.json({ error: "missing 'symbol'" }, { status: 400 });

  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      return Response.json({ error: `finnhub ${upstream.status}` }, { status: 502 });
    }
    const q = (await upstream.json()) as FinnhubQuoteResponse;

    // Map to our Ticker24h shape. Finnhub's "volume" isn't exposed on /quote
    // free tier; we report 0 for the volume fields. quoteVolume mirrors price*0.
    const ticker: Ticker24h = {
      symbol: symbol.toUpperCase(),
      lastPrice: q.c,
      priceChange: q.d,
      priceChangePercent: q.dp,
      highPrice: q.h,
      lowPrice: q.l,
      volume: 0,
      quoteVolume: 0,
    };

    return Response.json(ticker, {
      headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
