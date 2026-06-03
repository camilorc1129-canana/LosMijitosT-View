"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Timeframe } from "@/lib/binance/types";
import { DEFAULT_PROVIDER_ID } from "@/lib/providers";

export type IndicatorKey =
  | "ema20"
  | "ema50"
  | "ema200"
  | "rsi"
  | "macd"
  | "volume"
  | "ao"
  | "ema6x"
  | "sma";

export type DrawingTool = "cursor" | "hline" | "measure" | "eraser";
export type CandleType = "candles" | "heikinashi";

export interface PriceLine {
  id: string;
  symbol: string;
  price: number;
}

/**
 * A watchlist entry remembers which provider its symbol belongs to so a
 * mixed watchlist (e.g. BTCUSDT from Binance + AAPL from Twelve Data)
 * polls each source through the correct adapter and clicking it switches
 * the chart to that provider automatically.
 */
export interface WatchlistEntry {
  symbol: string;
  providerId: string;
}

export interface IndicatorConfig {
  ema20: number;
  ema50: number;
  ema200: number;
  rsi: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  ema6x1: number;
  ema6x2: number;
  ema6x3: number;
  ema6x4: number;
  ema6x5: number;
  ema6x6: number;
  ema6xColor1: string;
  ema6xColor2: string;
  ema6xColor3: string;
  ema6xColor4: string;
  ema6xColor5: string;
  ema6xColor6: string;
  smaLength: number;
  smaColor: string;
  ema20Width: number;
  ema50Width: number;
  ema200Width: number;
  smaWidth: number;
  ema6xWidth1: number;
  ema6xWidth2: number;
  ema6xWidth3: number;
  ema6xWidth4: number;
  ema6xWidth5: number;
  ema6xWidth6: number;
}

export const DEFAULT_CONFIG: IndicatorConfig = {
  ema20: 20,
  ema50: 50,
  ema200: 200,
  rsi: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  ema6x1: 30,
  ema6x2: 60,
  ema6x3: 100,
  ema6x4: 200,
  ema6x5: 400,
  ema6x6: 800,
  ema6xColor1: "#CD5C5C",
  ema6xColor2: "#CD5C5C",
  ema6xColor3: "#CD5C5C",
  ema6xColor4: "#CD5C5C",
  ema6xColor5: "#CD5C5C",
  ema6xColor6: "#CD5C5C",
  smaLength: 9,
  smaColor: "#26a69a",
  ema20Width: 1,
  ema50Width: 1,
  ema200Width: 2,
  smaWidth: 1,
  ema6xWidth1: 2,
  ema6xWidth2: 3,
  ema6xWidth3: 2,
  ema6xWidth4: 2,
  ema6xWidth5: 2,
  ema6xWidth6: 2,
};

export const EMA6X_COLOR = "#CD5C5C";
// lineWidth por slot: slot 1 (EMA 60) es más gruesa
export const EMA6X_WIDTHS = [2, 3, 2, 2, 2, 2] as const;

export const INDICATOR_COLORS: Record<IndicatorKey, string> = {
  ema20: "#ffb74d",
  ema50: "#2962ff",
  ema200: "#ab47bc",
  rsi: "#ab47bc",
  macd: "#2962ff",
  volume: "#787b86",
  ao: "#009688",
  ema6x: "#CD5C5C",
  sma: "#26a69a",
};

/** Raw symbol strings for the Binance default watchlist (legacy shape). */
const DEFAULT_WATCHLIST_BINANCE = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "LINKUSDT",
  "POLUSDT",
];

/** New default — each entry tagged with the provider it belongs to. */
export const DEFAULT_WATCHLIST: WatchlistEntry[] = DEFAULT_WATCHLIST_BINANCE.map(
  (symbol) => ({ symbol, providerId: "binance" }),
);

interface ChartState {
  /** Active data provider id (e.g. "binance"). Resolves via getProvider(). */
  providerId: string;
  symbol: string;
  timeframe: Timeframe;
  candleType: CandleType;
  /** Indicator is added to the chart (appears in pill + renders unless hidden) */
  indicators: Record<IndicatorKey, boolean>;
  /** Indicator is hidden (eye icon off) — kept in pill list, just not rendered */
  hidden: Record<IndicatorKey, boolean>;
  /** Periods and parameters for each indicator */
  config: IndicatorConfig;
  watchlist: WatchlistEntry[];

  // Ephemeral UI state (not persisted)
  tool: DrawingTool;
  priceLines: PriceLine[];
  symbolDialogOpen: boolean;
  /** Which indicator's settings dialog is open (null = closed) */
  settingsTarget: IndicatorKey | null;

  // Actions
  setProviderId: (id: string) => void;
  setSymbol: (s: string) => void;
  setTimeframe: (t: Timeframe) => void;
  setCandleType: (t: CandleType) => void;
  toggleIndicator: (key: IndicatorKey) => void;
  removeIndicator: (key: IndicatorKey) => void;
  toggleHidden: (key: IndicatorKey) => void;
  setConfig: (patch: Partial<IndicatorConfig>) => void;
  addToWatchlist: (entry: WatchlistEntry) => void;
  removeFromWatchlist: (entry: WatchlistEntry) => void;
  setTool: (t: DrawingTool) => void;
  addPriceLine: (price: number, symbol: string) => void;
  clearPriceLines: (symbol?: string) => void;
  setSymbolDialogOpen: (v: boolean) => void;
  setSettingsTarget: (k: IndicatorKey | null) => void;
}

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      providerId: DEFAULT_PROVIDER_ID,
      symbol: "BTCUSDT",
      timeframe: "15m" as Timeframe,
      indicators: {
        ema20: true,
        ema50: true,
        ema200: false,
        rsi: true,
        macd: false,
        volume: true,
        ao: false,
        ema6x: false,
        sma: false,
      },
      hidden: {
        ema20: false,
        ema50: false,
        ema200: false,
        rsi: false,
        macd: false,
        volume: false,
        ao: false,
        ema6x: false,
        sma: false,
      },
      config: { ...DEFAULT_CONFIG },
      candleType: "candles" as CandleType,
      watchlist: DEFAULT_WATCHLIST,
      tool: "cursor",
      priceLines: [],
      symbolDialogOpen: false,
      settingsTarget: null,

      setProviderId: (providerId) => set({ providerId }),
      setSymbol: (symbol) => set({ symbol }),
      setTimeframe: (timeframe) => set({ timeframe }),
      setCandleType: (candleType) => set({ candleType }),
      toggleIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: !s.indicators[key] },
          // When re-adding, ensure not hidden
          hidden: !s.indicators[key]
            ? { ...s.hidden, [key]: false }
            : s.hidden,
        })),
      removeIndicator: (key) =>
        set((s) => ({
          indicators: { ...s.indicators, [key]: false },
          hidden: { ...s.hidden, [key]: false },
        })),
      toggleHidden: (key) =>
        set((s) => ({ hidden: { ...s.hidden, [key]: !s.hidden[key] } })),
      setConfig: (patch) =>
        set((s) => ({ config: { ...s.config, ...patch } })),
      addToWatchlist: (entry) =>
        set((state) => ({
          watchlist: state.watchlist.some(
            (x) => x.symbol === entry.symbol && x.providerId === entry.providerId,
          )
            ? state.watchlist
            : [...state.watchlist, entry],
        })),
      removeFromWatchlist: (entry) =>
        set((state) => ({
          watchlist: state.watchlist.filter(
            (x) => !(x.symbol === entry.symbol && x.providerId === entry.providerId),
          ),
        })),
      setTool: (tool) => set({ tool }),
      addPriceLine: (price, symbol) =>
        set((state) => ({
          priceLines: [
            ...state.priceLines,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `${Date.now()}-${Math.random()}`,
              symbol,
              price,
            },
          ],
        })),
      clearPriceLines: (symbol) =>
        set((state) => ({
          priceLines: symbol
            ? state.priceLines.filter((p) => p.symbol !== symbol)
            : [],
        })),
      setSymbolDialogOpen: (symbolDialogOpen) => set({ symbolDialogOpen }),
      setSettingsTarget: (settingsTarget) => set({ settingsTarget }),
    }),
    {
      name: "tv-gratis-chart-state",
      version: 9,
      migrate: (persisted: unknown) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        // v8 → v9: watchlist string[] becomes WatchlistEntry[]. Plain strings
        // from before the multi-broker refactor were implicitly Binance.
        const rawList: unknown[] = Array.isArray(s.watchlist) ? s.watchlist : [];
        const cleanedWatchlist: WatchlistEntry[] = rawList
          .map((item): WatchlistEntry | null => {
            if (typeof item === "string") {
              if (item === "MATICUSDT") return null; // delisted Sep 2024
              return { symbol: item, providerId: "binance" };
            }
            if (item && typeof item === "object") {
              const e = item as Record<string, unknown>;
              const symbol = typeof e.symbol === "string" ? e.symbol : null;
              if (!symbol) return null;
              const providerId = typeof e.providerId === "string" ? e.providerId : "binance";
              return { symbol, providerId };
            }
            return null;
          })
          .filter((e): e is WatchlistEntry => e !== null);
        return {
          ...s,
          // Default the provider for users persisted before the multi-broker
          // refactor; everyone existing was implicitly on Binance.
          providerId: typeof s.providerId === "string" ? s.providerId : DEFAULT_PROVIDER_ID,
          // Reset symbol if it was a delisted pair
          symbol: s.symbol === "MATICUSDT" ? "BTCUSDT" : s.symbol,
          watchlist: cleanedWatchlist.length > 0 ? cleanedWatchlist : DEFAULT_WATCHLIST,
          // Merge config with defaults so new fields always exist
          config: { ...DEFAULT_CONFIG, ...(s.config as object | undefined) },
          // Merge indicators/hidden so new keys always exist
          indicators: {
            ema20: true, ema50: true, ema200: false, rsi: true,
            macd: false, volume: true, ao: false, ema6x: false, sma: false,
            ...(s.indicators as object | undefined),
          },
          hidden: {
            ema20: false, ema50: false, ema200: false, rsi: false,
            macd: false, volume: false, ao: false, ema6x: false, sma: false,
            ...(s.hidden as object | undefined),
          },
        };
      },
      partialize: (s) => ({
        providerId: s.providerId,
        symbol: s.symbol,
        timeframe: s.timeframe,
        candleType: s.candleType,
        indicators: s.indicators,
        hidden: s.hidden,
        config: s.config,
        watchlist: s.watchlist,
      }),
    },
  ),
);
