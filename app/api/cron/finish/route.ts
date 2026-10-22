import { NextResponse } from "next/server";
import { finishDailyScan } from "@/lib/daily";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Apify calls this when a daily-scan run ends (URL carries CRON_SECRET; each run is processed once). */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    eventType?: string;
    eventData?: { actorRunId?: string };
    resource?: { id?: string };
  };
  const runId = body.eventData?.actorRunId || body.resource?.id;
  if (!runId) return NextResponse.json({ error: "No run id" }, { status: 400 });
  try {
    return NextResponse.json(await finishDailyScan(runId, body.eventType !== "ACTOR.RUN.SUCCEEDED"));
  } catch (err) {
    console.error("[cron] finish failed:", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
