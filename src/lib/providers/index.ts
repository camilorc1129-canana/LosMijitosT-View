import { binanceProvider } from "./binance";
import { finnhubProvider } from "./finnhub";
import type { DataProvider } from "./types";

export const DEFAULT_PROVIDER_ID = "binance";

const REGISTRY: Record<string, DataProvider> = {
  [binanceProvider.id]: binanceProvider,
  [finnhubProvider.id]: finnhubProvider,
};

export function getProvider(id: string): DataProvider {
  return REGISTRY[id] ?? REGISTRY[DEFAULT_PROVIDER_ID];
}

export function listProviders(): DataProvider[] {
  return Object.values(REGISTRY);
}

export type { DataProvider } from "./types";
