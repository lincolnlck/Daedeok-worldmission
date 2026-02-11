import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const base = process.env.APPS_SCRIPT_EXEC_URL;
  if (!base) return NextResponse.json({ error: "Missing APPS_SCRIPT_EXEC_URL" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId");

  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
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
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Images fetch error:", err.message);
    return NextResponse.json({ error: err.message, images: [] }, { status: 500 });
  }
}
