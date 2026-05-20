import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { callXRoad, listMethods } from "@/lib/xroad/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/camdx/outbound
 * Triggers an X-Road REST call against the configured security server.
 *
 * Query params:
 *   action=listMethods   (default) — invoke the X-Road meta service
 *   action=service       — invoke the configured XROAD_SERVICE_IDENTIFIER
 */
export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "listMethods";

  try {
    const result =
      action === "service"
        ? await callXRoad({ service: getEnv().XROAD_SERVICE_IDENTIFIER })
        : await listMethods();

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
