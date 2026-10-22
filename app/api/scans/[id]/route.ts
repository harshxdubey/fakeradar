import { NextResponse } from "next/server";
import { dbEnabled, getScanRow } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Open a saved scan by its link on any device (scan ids are random and unguessable). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ db: false }, { status: 404 });
  const { id } = await params;
  if (!/^[a-z0-9-]{6,40}$/i.test(id)) return NextResponse.json({ error: "Invalid scan id" }, { status: 400 });
  try {
    const row = await getScanRow(id);
    if (!row) return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    return NextResponse.json({ stored: row.stored }); // never expose the owning workspace id
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
