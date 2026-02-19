import { NextResponse } from "next/server";

const CACHE_TTL_MS = 2 * 60 * 1000; // 2분
const imagesCache = new Map<string, { data: { images: unknown[] }; expiresAt: number }>();

export async function GET(req: Request) {
  const base = process.env.APPS_SCRIPT_EXEC_URL;
  if (!base) return NextResponse.json({ error: "Missing APPS_SCRIPT_EXEC_URL" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId");

  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const now = Date.now();
  const cached = imagesCache.get(folderId);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  try {
    const url = `${base}?action=images&folderId=${encodeURIComponent(folderId)}`;
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("GAS images error:", res.status, text.substring(0, 200));
      return NextResponse.json({ error: `GAS error: ${res.status}`, images: [] }, { status: 502 });
    }

    const data = await res.json();
    imagesCache.set(folderId, { data, expiresAt: now + CACHE_TTL_MS });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Images fetch error:", message);
    return NextResponse.json({ error: message, images: [] }, { status: 500 });
  }
}
