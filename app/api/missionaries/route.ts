import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.APPS_SCRIPT_EXEC_URL;
  if (!base) return NextResponse.json({ error: "Missing APPS_SCRIPT_EXEC_URL" }, { status: 500 });

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
    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Missionaries fetch error:", err.message);
    return NextResponse.json({ error: err.message, items: [] }, { status: 500 });
  }
}
