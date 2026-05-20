/**
 * Server-side helper to construct an X-Road REST envelope identical in shape
 * to the one produced by `tools/camdx-simulator.mjs`. Used by the
 * `/api/camdx/simulate` route so the inbound flow can be triggered from the
 * browser (Vercel-safe: no need for the visitor to run the CLI script).
 */
import { createHash, randomUUID } from "node:crypto";

export interface SimulatorEnvelope {
  /** Lowercase header keys — Web Headers normalises them anyway. */
  headers: Record<string, string>;
  body: string;
}

export interface BuildEnvelopeOptions {
  /** The CamDX-side caller subsystem (fabricated for the demo). */
  consumerIdentifier?: string;
  /** The CamDX-side service this would have addressed. */
  providerIdentifier?: string;
  /** End-user identifier on the upstream system. */
  userId?: string;
  /** JSON-LD payload to deliver. */
  payload: Record<string, unknown>;
}

/**
 * The simulator presents as a CamDX Ministry of Commerce customs subsystem.
 * These identifiers are illustrative — no real Cambodian TWIN subsystem is
 * yet registered on a real X-Road central server (that's procedural, not
 * technical; see CAMDX_POC.md). Format follows the canonical X-Road
 * INSTANCE/CLASS/MEMBER/SUBSYSTEM shape.
 */
const DEFAULT_CONSUMER = "SIM/CAMDX/GOV/MOC/CUSTOMS-EXPORT";
const DEFAULT_PROVIDER =
  "SIM/CAMDX/GOV/MOC/CUSTOMS-REGISTRY/consignment-declaration";

export function buildSimulatorEnvelope(
  options: BuildEnvelopeOptions,
): SimulatorEnvelope {
  const body = JSON.stringify(options.payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "x-road-client": options.consumerIdentifier ?? DEFAULT_CONSUMER,
    "x-road-service": options.providerIdentifier ?? DEFAULT_PROVIDER,
    "x-road-id": randomUUID(),
    "x-road-userid": options.userId ?? "KH-EXPORTER-DEMO",
    "x-road-issue": `consignment-${Date.now()}`,
  };
  // Non-standard but useful for receivers that want to verify body integrity
  // before SS-to-SS mTLS is in place. The simulator CLI sets the same header.
  headers["x-road-body-digest"] = createHash("sha512")
    .update(body)
    .digest("base64");
  return { headers, body };
}
