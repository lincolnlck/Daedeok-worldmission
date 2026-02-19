import { NextResponse } from "next/server";

const CACHE_TTL_MS = 2 * 60 * 1000; // 2분

let cached: { data: PrayerListResponse; expiresAt: number } | null = null;

export type PrayerListItem = {
  order: number;
  name: string;
  country: string;
  prayerContent: string;
  reference: string;
};

export type PrayerListResponse = {
  success: boolean;
  items: PrayerListItem[];
  fileName?: string;
  error?: string;
};

export async function GET(req: Request) {
  const base = process.env.APPS_SCRIPT_EXEC_URL;
  if (!base) {
    return NextResponse.json(
      { success: false, items: [], error: "Missing APPS_SCRIPT_EXEC_URL" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const skipCache = searchParams.get("refresh") === "1";

  const now = Date.now();
  if (!skipCache && cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  try {
    const url = `${base}?action=prayerList`;
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("GAS prayerList error:", res.status, text.substring(0, 200));
      return NextResponse.json(
        { success: false, items: [], error: `GAS error: ${res.status}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as PrayerListResponse;
    cached = { data, expiresAt: now + CACHE_TTL_MS };
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Prayer list fetch error:", message);
    return NextResponse.json(
      { success: false, items: [], error: message },
      { status: 500 }
    );
  }
}
