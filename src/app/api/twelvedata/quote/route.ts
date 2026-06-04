import type { NextRequest } from "next/server";
import type { Ticker24h } from "@/lib/binance/types";
import { TWELVEDATA_BASE, getApiKey, missingKeyResponse, rateLimitResponse } from "../_shared";

interface TwelveDataQuote {
  symbol: string;
  name?: string;
  exchange?: string;
  currency?: string;
  datetime?: string;
  timestamp?: number;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
  previous_close?: string;
  change?: string;
  percent_change?: string;
  status?: "error";
  code?: number;
  message?: string;
}

function toTicker(q: TwelveDataQuote, fallbackSymbol: string): Ticker24h | null {
  if (q.status === "error" || !q.close) return null;
  const close = parseFloat(q.close);
  const prevClose = q.previous_close ? parseFloat(q.previous_close) : close;
  const change = q.change ? parseFloat(q.change) : close - prevClose;
  const pct = q.percent_change ? parseFloat(q.percent_change) : (prevClose === 0 ? 0 : (change / prevClose) * 100);
  return {
    symbol: (q.symbol ?? fallbackSymbol).toUpperCase(),
    lastPrice: close,
    priceChange: change,
    priceChangePercent: pct,
    highPrice: q.high ? parseFloat(q.high) : close,
    lowPrice: q.low ? parseFloat(q.low) : close,
    volume: q.volume ? parseFloat(q.volume) : 0,
    quoteVolume: 0,
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = searchParams.get("symbol");
  if (!symbol) return Response.json({ error: "missing 'symbol'" }, { status: 400 });

  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  const url = `${TWELVEDATA_BASE}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (upstream.status === 429) {
      const body = await upstream.text().catch(() => "");
      return rateLimitResponse(body);
    }
    if (!upstream.ok) {
      return Response.json({ error: `twelvedata ${upstream.status}` }, { status: 502 });
    }
    const q = (await upstream.json()) as TwelveDataQuote;
    if (q.code === 429) {
      return rateLimitResponse(q.message);
    }
    const ticker = toTicker(q, symbol);
    if (!ticker) {
      return Response.json(
        { error: `twelvedata: ${q.message ?? "no quote"}` },
        { status: 502 },
      );
    }
    return Response.json(ticker, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}

