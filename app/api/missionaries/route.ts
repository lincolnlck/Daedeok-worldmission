import { NextResponse } from "next/server";

export async function GET() {
  const base = process.env.APPS_SCRIPT_EXEC_URL;
  if (!base) return NextResponse.json({ error: "Missing APPS_SCRIPT_EXEC_URL" }, { status: 500 });

  const res = await fetch(`${base}?action=missionaries`, { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data);
}
