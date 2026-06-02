import type { NextRequest } from "next/server";
import type { Ticker24h } from "@/lib/binance/types";
import { FINNHUB_BASE, getApiKey, missingKeyResponse } from "../_shared";

interface FinnhubQuoteResponse {
  c: number; d: number; dp: number;
  h: number; l: number; o: number;
  pc: number; t: number;
}

async function fetchOne(symbol: string, apiKey: string): Promise<Ticker24h | null> {
  const url = `${FINNHUB_BASE}/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const q = (await r.json()) as FinnhubQuoteResponse;
    return {
      symbol: symbol.toUpperCase(),
      lastPrice: q.c,
      priceChange: q.d,
      priceChangePercent: q.dp,
      highPrice: q.h,
      lowPrice: q.l,
      volume: 0,
      quoteVolume: 0,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbolsParam = searchParams.get("symbols");
  if (!symbolsParam) {
    return Response.json({ error: "missing 'symbols'" }, { status: 400 });
  }
  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) {
    return Response.json([], { status: 200 });
  }

  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  const results = await Promise.all(symbols.map((s) => fetchOne(s, apiKey)));
  const tickers = results.filter((t): t is Ticker24h => t !== null);

  return Response.json(tickers, {
    headers: { "Cache-Control": "s-maxage=5, stale-while-revalidate=15" },
  });
}
