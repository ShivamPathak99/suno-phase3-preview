import { NextRequest, NextResponse } from "next/server";

import { previewResetConfirmation, resetDemoData } from "../../../../../scripts/reset-demo";
import { createDemoSupabaseAdminClient } from "../../../../../scripts/seed";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/** F1.2 nightly preview-only reset endpoint; Vercel Cron provides the bearer secret. */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.SUNO_DEMO_RESET_TARGET !== previewResetConfirmation) {
    console.error("Demo cron reset rejected because the preview confirmation is missing.");
    return NextResponse.json({ error: "Preview reset is not configured." }, { status: 503 });
  }

  try {
    const result = await resetDemoData(createDemoSupabaseAdminClient(), { dryRun: false });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Demo cron reset failed.", error);
    return NextResponse.json({ error: "Couldn't reset the demo classroom." }, { status: 502 });
  }
}
