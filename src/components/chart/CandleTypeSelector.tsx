"use client";

import { CandlestickChart, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChartStore, type CandleType } from "@/lib/store/chart-store";

const TYPES: { key: CandleType; label: string }[] = [
  { key: "candles",    label: "Velas"       },
  { key: "heikinashi", label: "Heikin Ashi" },
];

export function CandleTypeSelector() {
  const candleType    = useChartStore((s) => s.candleType);
  const setCandleType = useChartStore((s) => s.setCandleType);

  const current = TYPES.find((t) => t.key === candleType) ?? TYPES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs text-tv-text hover:bg-tv-panel-hover">
        <CandlestickChart className="h-3.5 w-3.5" />
        <span>{current.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40 bg-tv-panel">
        {TYPES.map((t) => (
          <DropdownMenuItem
            key={t.key}
            onClick={() => setCandleType(t.key)}
            className="flex items-center justify-between text-xs"
          >
            <span>{t.label}</span>
            {candleType === t.key && <Check className="h-3.5 w-3.5 text-tv-blue" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
