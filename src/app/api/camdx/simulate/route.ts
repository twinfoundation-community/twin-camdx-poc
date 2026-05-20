import { NextResponse } from "next/server";
import { POST as inboundPost } from "../inbound/route";
import { buildSimulatorEnvelope } from "@/lib/camdx/build-envelope";
import { sampleCitizenVaccination } from "@/lib/camdx/samples/citizen-vaccination";

export const dynamic = "force-dynamic";

/**
 * POST /api/camdx/simulate
 *
 * Builds an X-Road REST envelope identical in shape to what the CLI simulator
 * (`tools/camdx-simulator.mjs`) emits, then invokes the inbound POST handler
 * in-process and returns its full response directly to the browser. The
 * browser doesn't need to follow up with a GET — sidesteps the multi-worker
 * cache problem on Vercel.
 */
export async function POST(): Promise<Response> {
  try {
    const envelope = buildSimulatorEnvelope({
      payload: sampleCitizenVaccination as Record<string, unknown>,
    });
    const synthetic = new Request("http://internal/api/camdx/inbound", {
      method: "POST",
      headers: envelope.headers,
      body: envelope.body,
    });
    return await inboundPost(synthetic);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
