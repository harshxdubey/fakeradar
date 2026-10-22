import { NextResponse } from "next/server";
import { hasApifyToken } from "@/lib/apify";
import { aiProvider } from "@/lib/claude";
import { dbEnabled } from "@/lib/db";
import { emailEnabled } from "@/lib/email";
import { isMockMode } from "@/lib/scan";

export const dynamic = "force-dynamic";

/** What's switched on, so the UI can show the right options (no secrets returned). */
export function GET() {
  return NextResponse.json({
    db: dbEnabled(),
    email: emailEnabled(),
    cron: Boolean(process.env.CRON_SECRET),
    live: !isMockMode() && hasApifyToken(),
    ai: aiProvider(),
  });
}
