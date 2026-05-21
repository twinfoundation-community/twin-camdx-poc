import { NextResponse } from "next/server";
import { verifyCredential } from "@/lib/twin/kitsune-client";

export const dynamic = "force-dynamic";

/**
 * POST /api/camdx/verify-credential
 * Body: { jwt: string }
 *
 * Re-verifies a previously-issued VC against the same identity chain that
 * signed it. Returns `{ revoked, verifiableCredential? }` straight from the
 * TWIN node's identity service.
 */
export async function POST(request: Request): Promise<NextResponse> {
  let body: { jwt?: string };
  try {
    body = (await request.json()) as { jwt?: string };
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!body.jwt || typeof body.jwt !== "string") {
    return NextResponse.json(
      { error: "Missing required field: jwt" },
      { status: 400 },
    );
  }

  try {
    const result = await verifyCredential(body.jwt);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
