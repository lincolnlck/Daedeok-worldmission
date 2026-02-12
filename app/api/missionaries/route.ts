import { NextResponse } from "next/server";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

let cached: { data: { items: unknown[] }; expiresAt: number } | null = null;

export async function GET(req: Request) {
  const base = process.env.APPS_SCRIPT_EXEC_URL;
  if (!base) return NextResponse.json({ error: "Missing APPS_SCRIPT_EXEC_URL" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const skipCache = searchParams.get("refresh") === "1";

  const now = Date.now();
  if (!skipCache && cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  try {
    const url = `${base}?action=missionaries`;
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("GAS response error:", res.status, text.substring(0, 200));
      return NextResponse.json({ error: `GAS error: ${res.status}`, items: [] }, { status: 502 });
    }

    const data = await res.json();
    cached = { data, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Missionaries fetch error:", message);
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
