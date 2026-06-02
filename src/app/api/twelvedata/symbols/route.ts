import type { SymbolInfo } from "@/lib/binance/types";
import { TWELVEDATA_BASE, getApiKey, missingKeyResponse } from "../_shared";

interface TwelveDataStock {
  symbol: string;
  name?: string;
  currency?: string;
  exchange?: string;
  mic_code?: string;
  country?: string;
  type?: string;
}

interface TwelveDataCommodity {
  symbol: string;
  name?: string;
  category?: string;
}

interface TwelveDataStocksResponse {
  data?: TwelveDataStock[];
  status?: string;
}

interface TwelveDataCommoditiesResponse {
  data?: TwelveDataCommodity[];
  status?: string;
}

export async function GET() {
  const apiKey = getApiKey();
  if (!apiKey) return missingKeyResponse();

  // Fetch US stocks + commodities in parallel and merge.
  const stocksUrl = `${TWELVEDATA_BASE}/stocks?country=United%20States&apikey=${apiKey}`;
  const commoditiesUrl = `${TWELVEDATA_BASE}/commodities?apikey=${apiKey}`;

  try {
    const [stocksRes, commoditiesRes] = await Promise.all([
      fetch(stocksUrl, { cache: "no-store" }),
      fetch(commoditiesUrl, { cache: "no-store" }),
    ]);

    const stocksData = stocksRes.ok
      ? ((await stocksRes.json()) as TwelveDataStocksResponse)
      : { data: [] };
    const commoditiesData = commoditiesRes.ok
      ? ((await commoditiesRes.json()) as TwelveDataCommoditiesResponse)
      : { data: [] };

    const stockSymbols: SymbolInfo[] = (stocksData.data ?? []).map((s) => ({
      symbol: s.symbol,
      baseAsset: s.symbol,
      quoteAsset: s.currency ?? "USD",
      status: "TRADING",
    }));

    const commoditySymbols: SymbolInfo[] = (commoditiesData.data ?? []).map((c) => ({
      symbol: c.symbol,
      baseAsset: c.symbol,
      quoteAsset: "USD",
      status: "TRADING",
    }));

    const merged = [...stockSymbols, ...commoditySymbols];

    return Response.json(merged, {
      headers: { "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
