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

const DEFAULT_CONSUMER = "SIM/CAMDX/GOV/MOH/CITIZEN-REGISTRY";
const DEFAULT_PROVIDER =
  "SIM/CAMDX/GOV/MOH/HEALTH-REGISTRY/citizen-vaccination";

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
    "x-road-userid": options.userId ?? "KH-CITIZEN-DEMO",
    "x-road-issue": `vaccination-${Date.now()}`,
  };
  // Non-standard but useful for receivers that want to verify body integrity
  // before SS-to-SS mTLS is in place. The simulator CLI sets the same header.
  headers["x-road-body-digest"] = createHash("sha512")
    .update(body)
    .digest("base64");
  return { headers, body };
}
