"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getProvider, listProviders } from "@/lib/providers";
import { useChartStore } from "@/lib/store/chart-store";
import { cn } from "@/lib/utils";
import type { SymbolInfo } from "@/lib/binance/types";

export function SymbolSelector() {
  const activeProviderId = useChartStore((s) => s.providerId);
  const symbol = useChartStore((s) => s.symbol);
  const setSymbol = useChartStore((s) => s.setSymbol);
  const setProviderId = useChartStore((s) => s.setProviderId);
  const addToWatchlist = useChartStore((s) => s.addToWatchlist);
  const open = useChartStore((s) => s.symbolDialogOpen);
  const setOpen = useChartStore((s) => s.setSymbolDialogOpen);

  // Tab selected inside the dialog — independent of the active chart provider
  // so the user can browse Twelve Data symbols without switching the chart
  // until they actually pick one.
  const [tabProviderId, setTabProviderId] = useState<string>(activeProviderId);
  // Reset the tab to the active provider every time the dialog opens.
  useEffect(() => {
    if (open) setTabProviderId(activeProviderId);
  }, [open, activeProviderId]);

  const providers = useMemo(() => listProviders(), []);

  const [query, setQuery] = useState("");
  // Cache symbol lists per provider so switching tabs doesn't re-fetch.
  const [cache, setCache] = useState<Record<string, SymbolInfo[]>>({});

  useEffect(() => {
    if (!open) return;
    if (cache[tabProviderId]) return;
    getProvider(tabProviderId)
      .fetchSymbols()
      .then((symbols) =>
        setCache((prev) => ({ ...prev, [tabProviderId]: symbols })),
      )
      .catch(console.error);
  }, [open, tabProviderId, cache]);

  const filtered = useMemo(() => {
    const allSymbols = cache[tabProviderId] ?? [];
    const q = query.trim().toUpperCase();
    if (!q) return allSymbols.slice(0, 100);
    return allSymbols
      .filter((s) => {
        if (s.symbol.includes(q)) return true;
        if (s.baseAsset.includes(q)) return true;
        if (s.quoteAsset.includes(q)) return true;
        // Match against the company name too so users can search "NVIDIA"
        // and get NVDA. Names from upstream may be mixed-case.
        if (s.name && s.name.toUpperCase().includes(q)) return true;
        return false;
      })
      .slice(0, 100);
  }, [query, cache, tabProviderId]);

  const handlePick = (s: SymbolInfo) => {
    // Switching providers + symbol together so the chart's remount key flips
    // atomically (see page.tsx <PriceChart key=...>).
    if (tabProviderId !== activeProviderId) setProviderId(tabProviderId);
    setSymbol(s.symbol);
    addToWatchlist({ symbol: s.symbol, providerId: tabProviderId });
    setOpen(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="group flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold hover:bg-tv-panel-hover">
        <Search className="h-3.5 w-3.5 text-tv-text-muted group-hover:text-tv-text" />
        <span className="tabular-nums">{symbol}</span>
        <ChevronDown className="h-3.5 w-3.5 text-tv-text-muted" />
      </DialogTrigger>
      <DialogContent className="max-w-md gap-0 bg-tv-panel p-0">
        <DialogHeader className="border-b border-tv-border px-4 py-3">
          <DialogTitle className="text-sm font-medium">Buscar símbolo</DialogTitle>
        </DialogHeader>
        {/* Provider tabs — pick which broker's symbol universe to search. */}
        <div className="flex gap-1 border-b border-tv-border px-3 pt-2">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => setTabProviderId(p.id)}
              className={cn(
                "rounded-t px-3 py-1.5 text-xs font-medium transition-colors",
                tabProviderId === p.id
                  ? "bg-tv-bg text-tv-text"
                  : "text-tv-text-muted hover:text-tv-text",
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="border-b border-tv-border p-3">
          <Input
            autoFocus
            placeholder={tabProviderId === "binance" ? "BTC, ETH, SOL…" : "AAPL, PBR, XOM…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-tv-bg"
          />
        </div>
        <ScrollArea className="h-[400px]">
          <div className="flex flex-col">
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-tv-text-muted">
                {cache[tabProviderId] ? "Sin resultados" : "Cargando símbolos…"}
              </div>
            )}
            {filtered.map((s) => (
              <button
                key={`${tabProviderId}|${s.symbol}`}
                onClick={() => handlePick(s)}
                className={cn(
                  "flex items-center justify-between gap-3 border-b border-tv-border px-4 py-2 text-left text-xs hover:bg-tv-panel-hover",
                  s.symbol === symbol && tabProviderId === activeProviderId && "bg-tv-panel-hover",
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="font-semibold text-tv-text">{s.symbol}</span>
                  {s.name ? (
                    <span className="truncate text-tv-text-muted">{s.name}</span>
                  ) : (
                    <span className="text-tv-text-muted">/ {s.quoteAsset}</span>
                  )}
                </div>
                <span className="shrink-0 text-tv-text-dim">{s.quoteAsset}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
