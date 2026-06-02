import { describe, it, expect } from "vitest";
import { bucketTrade } from "../finnhub";

const TF_60 = 60;    // 1m
const TF_900 = 900;  // 15m

describe("bucketTrade", () => {
  it("first trade with no prior candle creates one with all OHLC = price", () => {
    const r = bucketTrade(null, { price: 100, timeMs: 60_000, volume: 10 }, TF_60);
    expect(r.time).toBe(60);
    expect(r.open).toBe(100);
    expect(r.high).toBe(100);
    expect(r.low).toBe(100);
    expect(r.close).toBe(100);
    expect(r.volume).toBe(10);
    expect(r.isFinal).toBe(false);
  });

  it("aligns bucketStart to floor(timeSec / tfSec) * tfSec for a non-aligned timestamp", () => {
    // 15m bucket. Trade at 12:07:34 → bucket starts at 12:00:00.
    const noon = 12 * 3600;
    const tradeMs = (noon + 7 * 60 + 34) * 1000;
    const r = bucketTrade(null, { price: 50, timeMs: tradeMs, volume: 1 }, TF_900);
    expect(r.time).toBe(noon); // 12:00:00 UTC offset zero
  });

  it("same bucket → updates high/low/close and accumulates volume, preserves open", () => {
    const first = bucketTrade(null, { price: 100, timeMs: 60_000, volume: 10 }, TF_60);
    const second = bucketTrade(first, { price: 105, timeMs: 90_000, volume: 5 }, TF_60);
    expect(second.time).toBe(60);
    expect(second.open).toBe(100);
    expect(second.high).toBe(105);
    expect(second.low).toBe(100);
    expect(second.close).toBe(105);
    expect(second.volume).toBe(15);
  });

  it("a lower trade extends the low without touching the high or open", () => {
    const first = bucketTrade(null, { price: 100, timeMs: 60_000, volume: 10 }, TF_60);
    const second = bucketTrade(first, { price: 110, timeMs: 70_000, volume: 1 }, TF_60);
    const third = bucketTrade(second, { price: 95, timeMs: 80_000, volume: 1 }, TF_60);
    expect(third.open).toBe(100);
    expect(third.high).toBe(110);
    expect(third.low).toBe(95);
    expect(third.close).toBe(95);
    expect(third.volume).toBe(12);
  });

  it("crossing the bucket boundary starts a fresh candle with open = first trade in new bucket", () => {
    // 1m bucket from 60s. Next bucket starts at 120s.
    const first = bucketTrade(null, { price: 100, timeMs: 90_000, volume: 10 }, TF_60);
    expect(first.time).toBe(60);

    const second = bucketTrade(first, { price: 200, timeMs: 120_001, volume: 7 }, TF_60);
    expect(second.time).toBe(120); // new bucket
    expect(second.open).toBe(200);
    expect(second.high).toBe(200);
    expect(second.low).toBe(200);
    expect(second.close).toBe(200);
    expect(second.volume).toBe(7); // volume does NOT carry over
  });

  it("an out-of-order (older) trade that lands in an earlier bucket starts a fresh candle for that bucket", () => {
    // Edge case: a delayed trade arrives. The function is stateless across
    // calls, so the caller decides which `current` to pass. Documenting the
    // pure-function behavior: same-bucket → update; different-bucket → reset.
    const newer = bucketTrade(null, { price: 100, timeMs: 120_000, volume: 1 }, TF_60);
    const older = bucketTrade(newer, { price: 50, timeMs: 60_500, volume: 2 }, TF_60);
    expect(older.time).toBe(60);
    expect(older.open).toBe(50);
    expect(older.volume).toBe(2);
  });

  it("isFinal is always false (live data, candle still in progress)", () => {
    const r = bucketTrade(null, { price: 100, timeMs: 60_000, volume: 1 }, TF_60);
    expect(r.isFinal).toBe(false);
  });
});
