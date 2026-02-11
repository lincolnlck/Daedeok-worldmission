import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const base = process.env.APPS_SCRIPT_EXEC_URL;
  if (!base) return NextResponse.json({ error: "Missing APPS_SCRIPT_EXEC_URL" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const folderId = searchParams.get("folderId");

  if (!folderId) {
    return NextResponse.json({ error: "folderId required" }, { status: 400 });
  }

  const res = await fetch(
    `${base}?action=images&folderId=${encodeURIComponent(folderId)}`,
    { cache: "no-store" }
  );
  const data = await res.json();
  return NextResponse.json(data);
}
