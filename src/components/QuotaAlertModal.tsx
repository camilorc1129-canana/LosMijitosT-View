"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DAILY_LIMIT_EVENT,
  getStocksDailyLimitDeadline,
} from "@/lib/providers/twelvedata";

const DISMISSED_KEY = "td-quota-alert-dismissed-until";

/** Human-readable time remaining until `deadline` (epoch ms), in Spanish. */
function formatTimeRemaining(deadline: number): string {
  const diffMs = Math.max(0, deadline - Date.now());
  const totalMinutes = Math.ceil(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  const hPart = `${hours} ${hours === 1 ? "hora" : "horas"}`;
  if (minutes === 0) return hPart;
  return `${hPart} y ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

/**
 * Shows a modal when the Twelve Data daily quota is exhausted. Appears once
 * per exhaustion period: dismissing it records the period's deadline so it
 * won't nag on reloads, but a fresh exhaustion (new deadline after the next
 * daily reset) shows it again.
 */
export function QuotaAlertModal() {
  const [open, setOpen] = useState(false);
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    const maybeShow = () => {
      const deadline = getStocksDailyLimitDeadline();
      if (deadline === null) return;
      const dismissed = window.localStorage.getItem(DISMISSED_KEY);
      if (dismissed === String(deadline)) return; // already acknowledged this period
      setRemaining(formatTimeRemaining(deadline));
      setOpen(true);
    };

    // Check on mount (covers reload while still rate-limited) and on the
    // live event (covers exhaustion happening during the session).
    maybeShow();
    window.addEventListener(DAILY_LIMIT_EVENT, maybeShow);
    return () => window.removeEventListener(DAILY_LIMIT_EVENT, maybeShow);
  }, []);

  const handleClose = () => {
    const deadline = getStocksDailyLimitDeadline();
    if (deadline !== null) {
      window.localStorage.setItem(DISMISSED_KEY, String(deadline));
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DialogContent className="max-w-sm bg-tv-panel">
        <DialogHeader>
          <DialogTitle>Lo sentimos</DialogTitle>
          <DialogDescription className="text-tv-text-muted">
            Has agotado el límite máximo gratuito diario del uso del mercado de
            acciones del proveedor Twelve Data. En {remaining} podrás volverlo a
            usar.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleClose}>Aceptar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
