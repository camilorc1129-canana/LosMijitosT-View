"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useChartStore,
  DEFAULT_CONFIG,
  type IndicatorKey,
} from "@/lib/store/chart-store";

const TITLES: Record<IndicatorKey, string> = {
  ema20: "EMA — Slot 1",
  ema50: "EMA — Slot 2",
  ema200: "EMA — Slot 3",
  rsi: "RSI",
  macd: "MACD",
  volume: "Volumen",
  ao: "Awesome Oscillator",
  ema6x: "Moving Average Exponential ×6",
  sma: "Simple Moving Average",
};

export function IndicatorSettingsDialog() {
  const target = useChartStore((s) => s.settingsTarget);
  const setTarget = useChartStore((s) => s.setSettingsTarget);
  const config = useChartStore((s) => s.config);
  const setConfig = useChartStore((s) => s.setConfig);

  const open = target !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTarget(null);
      }}
    >
      <DialogContent className="max-w-sm bg-tv-panel">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {target ? TITLES[target] : ""} — Configuración
          </DialogTitle>
        </DialogHeader>
        {target && (
          <SettingsForm
            target={target}
            config={config}
            onSave={(patch) => {
              setConfig(patch);
              setTarget(null);
            }}
            onReset={() => {
              setConfig(DEFAULT_CONFIG);
              setTarget(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  target: IndicatorKey;
  config: typeof DEFAULT_CONFIG;
  onSave: (patch: Partial<typeof DEFAULT_CONFIG>) => void;
  onReset: () => void;
}

function SettingsForm({ target, config, onSave, onReset }: FormProps) {
  // Local draft state to avoid recalculating chart on every keystroke
  const [draft, setDraft] = useState({
    ema20: config.ema20,
    ema50: config.ema50,
    ema200: config.ema200,
    rsi: config.rsi,
    macdFast: config.macdFast,
    macdSlow: config.macdSlow,
    macdSignal: config.macdSignal,
    ema6x1: config.ema6x1,
    ema6x2: config.ema6x2,
    ema6x3: config.ema6x3,
    ema6x4: config.ema6x4,
    ema6x5: config.ema6x5,
    ema6x6: config.ema6x6,
    ema6xColor1: config.ema6xColor1 || "#CD5C5C",
    ema6xColor2: config.ema6xColor2 || "#CD5C5C",
    ema6xColor3: config.ema6xColor3 || "#CD5C5C",
    ema6xColor4: config.ema6xColor4 || "#CD5C5C",
    ema6xColor5: config.ema6xColor5 || "#CD5C5C",
    ema6xColor6: config.ema6xColor6 || "#CD5C5C",
    smaLength: config.smaLength,
    smaColor: config.smaColor || "#26a69a",
    ema20Width: config.ema20Width || 1,
    ema50Width: config.ema50Width || 1,
    ema200Width: config.ema200Width || 2,
    smaWidth: config.smaWidth || 1,
    ema6xWidth1: config.ema6xWidth1 || 2,
    ema6xWidth2: config.ema6xWidth2 || 3,
    ema6xWidth3: config.ema6xWidth3 || 2,
    ema6xWidth4: config.ema6xWidth4 || 2,
    ema6xWidth5: config.ema6xWidth5 || 2,
    ema6xWidth6: config.ema6xWidth6 || 2,
  });

  useEffect(() => {
    setDraft({
      ema20: config.ema20,
      ema50: config.ema50,
      ema200: config.ema200,
      rsi: config.rsi,
      macdFast: config.macdFast,
      macdSlow: config.macdSlow,
      macdSignal: config.macdSignal,
      ema6x1: config.ema6x1,
      ema6x2: config.ema6x2,
      ema6x3: config.ema6x3,
      ema6x4: config.ema6x4,
      ema6x5: config.ema6x5,
      ema6x6: config.ema6x6,
      ema6xColor1: config.ema6xColor1 || "#CD5C5C",
      ema6xColor2: config.ema6xColor2 || "#CD5C5C",
      ema6xColor3: config.ema6xColor3 || "#CD5C5C",
      ema6xColor4: config.ema6xColor4 || "#CD5C5C",
      ema6xColor5: config.ema6xColor5 || "#CD5C5C",
      ema6xColor6: config.ema6xColor6 || "#CD5C5C",
      smaLength: config.smaLength,
      smaColor: config.smaColor || "#26a69a",
      ema20Width: config.ema20Width || 1,
      ema50Width: config.ema50Width || 1,
      ema200Width: config.ema200Width || 2,
      smaWidth: config.smaWidth || 1,
      ema6xWidth1: config.ema6xWidth1 || 2,
      ema6xWidth2: config.ema6xWidth2 || 3,
      ema6xWidth3: config.ema6xWidth3 || 2,
      ema6xWidth4: config.ema6xWidth4 || 2,
      ema6xWidth5: config.ema6xWidth5 || 2,
      ema6xWidth6: config.ema6xWidth6 || 2,
    });
  }, [config, target]);

  function save() {
    if (target === "ema20") onSave({ ema20: clamp(draft.ema20, 2, 500), ema20Width: draft.ema20Width });
    else if (target === "ema50") onSave({ ema50: clamp(draft.ema50, 2, 500), ema50Width: draft.ema50Width });
    else if (target === "ema200") onSave({ ema200: clamp(draft.ema200, 2, 500), ema200Width: draft.ema200Width });
    else if (target === "rsi") onSave({ rsi: clamp(draft.rsi, 2, 100) });
    else if (target === "macd")
      onSave({
        macdFast: clamp(draft.macdFast, 2, 100),
        macdSlow: clamp(draft.macdSlow, 2, 200),
        macdSignal: clamp(draft.macdSignal, 2, 100),
      });
    else if (target === "volume") onSave({});
    else if (target === "ao") onSave({});
    else if (target === "sma")
      onSave({ smaLength: clamp(draft.smaLength, 2, 500), smaColor: draft.smaColor, smaWidth: draft.smaWidth });
    else if (target === "ema6x")
      onSave({
        ema6x1: clamp(draft.ema6x1, 2, 500),
        ema6x2: clamp(draft.ema6x2, 2, 500),
        ema6x3: clamp(draft.ema6x3, 2, 500),
        ema6x4: clamp(draft.ema6x4, 2, 500),
        ema6x5: clamp(draft.ema6x5, 2, 1000),
        ema6x6: clamp(draft.ema6x6, 2, 1000),
        ema6xColor1: draft.ema6xColor1,
        ema6xColor2: draft.ema6xColor2,
        ema6xColor3: draft.ema6xColor3,
        ema6xColor4: draft.ema6xColor4,
        ema6xColor5: draft.ema6xColor5,
        ema6xColor6: draft.ema6xColor6,
        ema6xWidth1: draft.ema6xWidth1,
        ema6xWidth2: draft.ema6xWidth2,
        ema6xWidth3: draft.ema6xWidth3,
        ema6xWidth4: draft.ema6xWidth4,
        ema6xWidth5: draft.ema6xWidth5,
        ema6xWidth6: draft.ema6xWidth6,
      });
  }

  return (
    <div className="flex flex-col gap-3">
      {(target === "ema20" || target === "ema50" || target === "ema200") && (
        <div className="flex flex-col gap-3">
          <Field
            label="Período"
            value={draft[target]}
            onChange={(n) => setDraft((d) => ({ ...d, [target]: n }))}
          />
          <WidthPicker
            value={target === "ema20" ? draft.ema20Width : target === "ema50" ? draft.ema50Width : draft.ema200Width}
            onChange={(n) =>
              setDraft((d) => ({
                ...d,
                ...(target === "ema20" ? { ema20Width: n } : target === "ema50" ? { ema50Width: n } : { ema200Width: n }),
              }))
            }
          />
        </div>
      )}
      {target === "rsi" && (
        <Field
          label="Período"
          value={draft.rsi}
          onChange={(n) => setDraft((d) => ({ ...d, rsi: n }))}
        />
      )}
      {target === "macd" && (
        <div className="grid grid-cols-3 gap-2">
          <Field
            label="Rápida"
            value={draft.macdFast}
            onChange={(n) => setDraft((d) => ({ ...d, macdFast: n }))}
          />
          <Field
            label="Lenta"
            value={draft.macdSlow}
            onChange={(n) => setDraft((d) => ({ ...d, macdSlow: n }))}
          />
          <Field
            label="Señal"
            value={draft.macdSignal}
            onChange={(n) => setDraft((d) => ({ ...d, macdSignal: n }))}
          />
        </div>
      )}
      {target === "volume" && (
        <p className="text-xs text-tv-text-muted">
          El indicador de volumen no tiene parámetros configurables en esta
          versión.
        </p>
      )}
      {target === "ao" && (
        <p className="text-xs text-tv-text-muted">
          Awesome Oscillator usa parámetros fijos: SMA(5) − SMA(34) sobre HL2.
          Compatible con la definición estándar de TradingView.
        </p>
      )}
      {target === "sma" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <ColorSwatch
              value={draft.smaColor}
              onChange={(v) => setDraft((d) => ({ ...d, smaColor: v }))}
            />
            <Field
              label="Período"
              value={draft.smaLength}
              onChange={(n) => setDraft((d) => ({ ...d, smaLength: n }))}
            />
          </div>
          <WidthPicker
            value={draft.smaWidth}
            onChange={(n) => setDraft((d) => ({ ...d, smaWidth: n }))}
          />
        </div>
      )}
      {target === "ema6x" && (
        <div className="flex flex-col gap-1">
          {/* Header row */}
          <div className="mb-0.5 flex items-center gap-1.5 px-0.5">
            <span className="w-6 shrink-0" />
            <span className="w-10 shrink-0 text-[9px] font-semibold uppercase tracking-wider text-tv-text-muted">EMA</span>
            <span className="flex-1 text-[9px] font-semibold uppercase tracking-wider text-tv-text-muted">Período</span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-tv-text-muted">Grosor</span>
          </div>
          {(
            [
              { period: "ema6x1", color: "ema6xColor1", width: "ema6xWidth1" },
              { period: "ema6x2", color: "ema6xColor2", width: "ema6xWidth2" },
              { period: "ema6x3", color: "ema6xColor3", width: "ema6xWidth3" },
              { period: "ema6x4", color: "ema6xColor4", width: "ema6xWidth4" },
              { period: "ema6x5", color: "ema6xColor5", width: "ema6xWidth5" },
              { period: "ema6x6", color: "ema6xColor6", width: "ema6xWidth6" },
            ] as const
          ).map(({ period, color, width }, i) => (
            <div key={period} className="flex items-center gap-1.5">
              <ColorSwatch
                value={draft[color]}
                onChange={(v) => setDraft((d) => ({ ...d, [color]: v }))}
              />
              <span className="w-10 shrink-0 text-[10px] text-tv-text-muted">{i + 1}</span>
              <Input
                type="number"
                min={2}
                max={1000}
                value={draft[period]}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) setDraft((d) => ({ ...d, [period]: n }));
                }}
                className="h-7 min-w-0 flex-1 bg-tv-bg text-xs tabular-nums"
              />
              <div className="flex shrink-0 gap-0.5">
                {([1, 2, 3, 4] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, [width]: w }))}
                    title={`Grosor ${w}`}
                    className={`flex h-6 w-6 items-center justify-center rounded border transition-colors ${
                      draft[width] === w
                        ? "border-tv-blue bg-tv-blue/20"
                        : "border-tv-border hover:border-tv-text-muted"
                    }`}
                  >
                    <div className="w-3 rounded-full bg-tv-text" style={{ height: w }} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-tv-text-muted hover:text-tv-text"
        >
          Reset defaults
        </Button>
        <Button size="sm" onClick={save} className="bg-tv-blue hover:bg-tv-blue/90">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        {label}
      </span>
      <Input
        type="number"
        min={2}
        max={500}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(n);
        }}
        className="bg-tv-bg tabular-nums"
      />
    </label>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="relative shrink-0 cursor-pointer" title="Cambiar color">
      <span
        className="block h-7 w-7 rounded border border-tv-border shadow-sm"
        style={{ background: value }}
      />
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function WidthPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-tv-text-muted">
        Grosor
      </span>
      <div className="flex gap-1.5">
        {([1, 2, 3, 4] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onChange(w)}
            title={`Grosor ${w}`}
            className={`flex h-8 w-10 items-center justify-center rounded border transition-colors ${
              value === w
                ? "border-tv-blue bg-tv-blue/20"
                : "border-tv-border hover:border-tv-text-muted"
            }`}
          >
            <div className="w-5 rounded-full bg-tv-text" style={{ height: w }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
