import type { NextRequest } from "next/server";
import type { Ticker24h } from "@/lib/binance/types";
import { TWELVEDATA_BASE, getApiKey, missingKeyResponse, rateLimitResponse } from "../_shared";

interface TwelveDataQuote {
  symbol: string;
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
  const pct = q.percent_change
    ? parseFloat(q.percent_change)
    : prevClose === 0 ? 0 : (change / prevClose) * 100;
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
  const symbolsParam = searchParams.get("symbols");
  if (!symbolsParam) {
    return Response.json({ error: "missing 'symbols'" }, { status: 400 });
  }
  const symbols = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (symbols.length === 0) return Response.json([], { status: 200 });

  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  // Twelve Data /quote accepts comma-separated symbols — single upstream call
  // for the whole watchlist instead of N parallel calls (Finnhub-style).
  const url = `${TWELVEDATA_BASE}/quote?symbol=${encodeURIComponent(symbols.join(","))}&apikey=${apiKey}`;
  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (upstream.status === 429) {
      const body = await upstream.text().catch(() => "");
      return rateLimitResponse(body);
    }
    if (!upstream.ok) {
      return Response.json({ error: `twelvedata ${upstream.status}` }, { status: 502 });
    }
    const data = (await upstream.json()) as TwelveDataQuote | Record<string, TwelveDataQuote>;
    // 200 + code:429 in the body when free-tier credits are exhausted.
    if ((data as TwelveDataQuote).code === 429) {
      return rateLimitResponse((data as TwelveDataQuote).message);
    }

    // Single-symbol responses come as a flat object; multi-symbol responses
    // come keyed by symbol. Normalise to an array.
    let tickers: Ticker24h[];
    if (symbols.length === 1) {
      const single = data as TwelveDataQuote;
      const t = toTicker(single, symbols[0]);
      tickers = t ? [t] : [];
    } else {
      const map = data as Record<string, TwelveDataQuote>;
      tickers = symbols
        .map((s) => toTicker(map[s] ?? ({} as TwelveDataQuote), s))
        .filter((t): t is Ticker24h => t !== null);
    }

    return Response.json(tickers, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
