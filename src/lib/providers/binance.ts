import {
  fetchKlines,
  fetchTicker24h,
  fetchTickers24h,
  fetchExchangeSymbols,
} from "@/lib/binance/rest";
import { getBinanceWS } from "@/lib/binance/ws";
import type { DataProvider } from "./types";

export const binanceProvider: DataProvider = {
  id: "binance",
  name: "Binance",
  market: "crypto",
  defaultSymbol: "BTCUSDT",

  fetchKlines: (symbol, interval, limit) => fetchKlines(symbol, interval, limit),
  fetchTicker24h: (symbol) => fetchTicker24h(symbol),
  fetchTickers24h: (symbols) => fetchTickers24h(symbols),
  fetchSymbols: () => fetchExchangeSymbols(),

  subscribeKline: (sub) => getBinanceWS().subscribeKline(sub),
  subscribeMiniTickers: (symbols, onTick) =>
    getBinanceWS().subscribeMiniTickers(symbols, onTick),
};
