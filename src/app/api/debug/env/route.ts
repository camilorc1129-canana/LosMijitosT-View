// Temporary diagnostic endpoint — DELETE after debugging.
// Reports whether Finnhub env vars are visible to the runtime without
// leaking the actual values.
export async function GET() {
  const restKey = process.env.FINNHUB_API_KEY ?? "";
  const wsKey = process.env.NEXT_PUBLIC_FINNHUB_WS_TOKEN ?? "";

  return Response.json({
    rest: {
      present: restKey.length > 0,
      length: restKey.length,
      first3: restKey.slice(0, 3),
      last2: restKey.slice(-2),
    },
    ws: {
      present: wsKey.length > 0,
      length: wsKey.length,
      first3: wsKey.slice(0, 3),
      last2: wsKey.slice(-2),
    },
    vercel: {
      env: process.env.VERCEL_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
      deployment_id: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    },
    // List any env var key that mentions "finnhub" — catches typos
    // like FINHUB_API_KEY, FINNHUB__API_KEY, etc.
    finnhub_related_keys: Object.keys(process.env).filter((k) =>
      k.toLowerCase().includes("finnhub") || k.toLowerCase().includes("finhub"),
    ),
  });
}
