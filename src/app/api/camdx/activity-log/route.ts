import { NextResponse } from "next/server";
import { getActivityLog, isKitsuneConfigured } from "@/lib/twin/kitsune-client";

export const dynamic = "force-dynamic";

const URN_PREFIX = "urn:x-activity-log:";

/**
 * GET /api/camdx/activity-log?id=urn:x-activity-log:...
 *
 * Thin client-poll endpoint. The inbound flow returns the first non-pending
 * snapshot quickly; the browser then polls this endpoint until the activity
 * reaches a terminal state (completed | error) — so the demo stays live for
 * tasks that take longer than the inbound request's poll window.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!isKitsuneConfigured()) {
    return NextResponse.json(
      { error: "Kitsune not configured" },
      { status: 503 },
    );
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id || !id.startsWith(URN_PREFIX)) {
    return NextResponse.json(
      { error: "Missing or invalid `id` (expected urn:x-activity-log:...)" },
      { status: 400 },
    );
  }

  try {
    const log = await getActivityLog(id);
    return NextResponse.json(log);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
