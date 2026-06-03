"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { getProvider } from "@/lib/providers";
import { useChartStore, type WatchlistEntry } from "@/lib/store/chart-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatPrice, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  symbol: string;
  providerId: string;
  price: number;
  pct: number;
}

/** Stable string key for a (providerId, symbol) pair — used to index `rows`. */
function entryKey(e: WatchlistEntry): string {
  return `${e.providerId}|${e.symbol}`;
}

export function Watchlist() {
  const watchlist = useChartStore((s) => s.watchlist);
  const activeSymbol = useChartStore((s) => s.symbol);
  const activeProviderId = useChartStore((s) => s.providerId);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const setProviderId = useChartStore((s) => s.setProviderId);
  const removeFromWatchlist = useChartStore((s) => s.removeFromWatchlist);
  const openSymbolDialog = useChartStore((s) => s.setSymbolDialogOpen);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down" | null>>({});

  // Group symbols by provider so we open one subscription per source —
  // Binance via WS, Twelve Data via polling, future brokers via their own.
  const byProvider = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const e of watchlist) {
      (groups[e.providerId] ||= []).push(e.symbol);
    }
    return groups;
  }, [watchlist]);

  useEffect(() => {
    const providerIds = Object.keys(byProvider);
    if (providerIds.length === 0) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    for (const providerId of providerIds) {
      const symbols = byProvider[providerId];
      const provider = getProvider(providerId);

      // Initial snapshot per provider.
      provider
        .fetchTickers24h(symbols)
        .then((tickers) => {
          if (cancelled) return;
          setRows((prev) => {
            const next = { ...prev };
            for (const t of tickers) {
              next[`${providerId}|${t.symbol}`] = {
                symbol: t.symbol,
                providerId,
                price: t.lastPrice,
                pct: t.priceChangePercent,
              };
            }
            return next;
          });
        })
        .catch(console.error);

      // Live updates (WS for Binance, polling for stocks providers).
      const unsub = provider.subscribeMiniTickers(symbols, (tick) => {
        const key = `${providerId}|${tick.symbol}`;
        setRows((prev) => {
          const prevRow = prev[key];
          if (prevRow) {
            if (tick.close > prevRow.price) {
              setFlash((f) => ({ ...f, [key]: "up" }));
              setTimeout(() => setFlash((f) => ({ ...f, [key]: null })), 300);
            } else if (tick.close < prevRow.price) {
              setFlash((f) => ({ ...f, [key]: "down" }));
              setTimeout(() => setFlash((f) => ({ ...f, [key]: null })), 300);
            }
          }
          return {
            ...prev,
            [key]: {
              symbol: tick.symbol,
              providerId,
              price: tick.close,
              pct: tick.pct,
            },
          };
        });
      });
      unsubs.push(unsub);
    }

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [byProvider]);

  // Click on a row → switch chart provider AND symbol together so the
  // remount key (providerId-symbol-tf) flips both atomically.
  const handleSelect = (entry: WatchlistEntry) => {
    if (entry.providerId !== activeProviderId) setProviderId(entry.providerId);
    if (entry.symbol !== activeSymbol) setSymbol(entry.symbol);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-tv-border px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tv-text-muted">
          Watchlist
        </h2>
        <button
          onClick={() => openSymbolDialog(true)}
          className="rounded p-1 text-tv-text-muted hover:bg-tv-panel-hover hover:text-tv-text"
          title="Agregar símbolo"
          aria-label="Agregar al watchlist"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-tv-border px-3 py-1.5 text-[10px] uppercase tracking-wider text-tv-text-dim">
        <span>Símbolo</span>
        <span className="text-right">Precio</span>
        <span className="text-right">24h</span>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {watchlist.map((entry) => {
            const key = entryKey(entry);
            const row = rows[key];
            const isActive =
              entry.symbol === activeSymbol && entry.providerId === activeProviderId;
            const f = flash[key];
            // Crypto stays "BTC | USDT"; non-Binance shows symbol + provider tag.
            const isBinance = entry.providerId === "binance";
            const baseLabel = isBinance ? entry.symbol.replace("USDT", "") : entry.symbol;
            const tag = isBinance ? "USDT" : getProvider(entry.providerId).name;
            return (
              <div
                key={key}
                onClick={() => handleSelect(entry)}
                className={cn(
                  "group grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-1.5 text-xs transition-colors",
                  "hover:bg-tv-panel-hover",
                  isActive && "bg-tv-panel-hover",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-tv-text">{baseLabel}</span>
                  <span className="text-[10px] text-tv-text-dim">{tag}</span>
                </div>
                <span
                  className={cn(
                    "text-right tabular-nums transition-colors",
                    f === "up" && "text-tv-green",
                    f === "down" && "text-tv-red",
                    !f && "text-tv-text",
                  )}
                >
                  {row ? formatPrice(row.price) : "—"}
                </span>
                <div className="flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "tabular-nums",
                      row
                        ? row.pct >= 0
                          ? "text-tv-green"
                          : "text-tv-red"
                        : "text-tv-text-muted",
                    )}
                  >
                    {row ? formatPct(row.pct) : "—"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(entry);
                    }}
                    className="invisible rounded p-0.5 text-tv-text-muted hover:bg-tv-bg hover:text-tv-red group-hover:visible"
                    aria-label={`Quitar ${entry.symbol} del watchlist`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {watchlist.length === 0 && (
            <div className="p-4 text-center text-xs text-tv-text-muted">
              Tu watchlist está vacío
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
