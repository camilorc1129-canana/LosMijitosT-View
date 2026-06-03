// Temporary diagnostic — DELETE after debugging.
// Calls Twelve Data directly and returns the RAW upstream response so we
// can distinguish: invalid key vs per-minute limit vs per-day limit vs OK.
export async function GET() {
  const key = process.env.TWELVEDATA_API_KEY ?? "";
  if (!key) {
    return Response.json({ error: "TWELVEDATA_API_KEY missing in runtime" }, { status: 500 });
  }

  const url = `https://api.twelvedata.com/quote?symbol=AAPL&apikey=${key}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const raw = await res.json();
    return Response.json({
      key_present: true,
      key_length: key.length,
      key_first3: key.slice(0, 3),
      http_status: res.status,
      // The raw body tells us everything: a valid quote, or
      // { code: 429, message: "...current minute..." | "...current day..." },
      // or { code: 401, message: "invalid apikey" }.
      upstream_body: raw,
    });
  } catch (e) {
    return Response.json({ key_present: true, fetch_error: String(e) }, { status: 502 });
  }
}
