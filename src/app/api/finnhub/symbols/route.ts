import type { SymbolInfo } from "@/lib/binance/types";
import { FINNHUB_BASE, getApiKey, missingKeyResponse } from "../_shared";

interface FinnhubSymbol {
  symbol: string;
  displaySymbol: string;
  description: string;
  type: string;
  currency: string;
  mic: string; // Market Identifier Code
}

export async function GET() {
  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  const url = `${FINNHUB_BASE}/stock/symbol?exchange=US&token=${apiKey}`;
  try {
    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok) {
      return Response.json({ error: `finnhub ${upstream.status}` }, { status: 502 });
    }
    const data = (await upstream.json()) as FinnhubSymbol[];

    // Map to our SymbolInfo shape. Finnhub doesn't carry base/quote assets
    // the way Binance does; we synthesise quoteAsset from currency and
    // baseAsset from displaySymbol so the SymbolSelector UI still shows
    // a sensible split.
    const symbols: SymbolInfo[] = data
      .filter((s) => s.type === "Common Stock" || s.type === "ETP" || s.type === "ADR")
      .map((s) => ({
        symbol: s.displaySymbol,
        baseAsset: s.displaySymbol,
        quoteAsset: s.currency || "USD",
        status: "TRADING",
      }));

    return Response.json(symbols, {
      headers: { "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
