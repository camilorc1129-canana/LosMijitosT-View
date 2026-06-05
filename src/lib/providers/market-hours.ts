// Helpers shared by stock-market data providers to avoid burning API
// credits when polling would be pointless (tab hidden, market closed) and
// to compute a sensible cooldown when a daily quota is exhausted.

/**
 * US equities regular session: 09:30–16:00 America/New_York, Mon–Fri.
 * Uses Intl with the IANA zone so DST (EST/EDT) is handled automatically.
 */
export function isUsMarketOpen(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value;
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);

  if (weekday === "Sat" || weekday === "Sun") return false;
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

/** True when the document is backgrounded (browser tab not visible). */
export function isDocHidden(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

/**
 * Should an automatic (non-user-initiated) poll run right now? Skips when
 * the tab is hidden or the US market is closed — manual refreshes bypass
 * this by calling the fetch directly.
 */
export function shouldAutoPollStocks(): boolean {
  return !isDocHidden() && isUsMarketOpen();
}

/** Epoch ms of the next 00:00 UTC — Twelve Data's daily quota reset point. */
export function nextUtcMidnightMs(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}
