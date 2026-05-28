import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { translateToActivity } from "@/lib/camdx/translator";
import type { CamdxEnvelopeMetadata, IActivity } from "@/lib/camdx/types";
import {
  createAttestation,
  createCredential,
  ensureVerificationMethod,
  forwardActivity,
  getActivityLog,
  isKitsuneConfigured,
  type ActivityLogEntry,
} from "@/lib/twin/kitsune-client";

export const dynamic = "force-dynamic";

type StepResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: string };

interface TwinForwardSummary {
  configured: boolean;
  notify?: StepResult<{ activityLogId: string }>;
  activityLog?: StepResult<ActivityLogEntry>;
  credential?: StepResult<{
    verifiableCredential: Record<string, unknown>;
    jwt: string;
    verificationMethodId: string;
    verificationMethodAlreadyExisted: boolean;
  }>;
  attestation?: StepResult<{ attestationId: string }>;
}

interface InboundRecord {
  received: {
    headers: Record<string, string>;
    body: unknown;
  };
  envelope: CamdxEnvelopeMetadata;
  activity: IActivity;
  twin: TwinForwardSummary;
}

// Per-process cache, survives HMR via globalThis. Multi-worker caveat surfaced
// in the GET response below.
declare global {
  var __camdxInboundLast: InboundRecord | null | undefined;
}
const cache = {
  get last(): InboundRecord | null {
    return globalThis.__camdxInboundLast ?? null;
  },
  set last(value: InboundRecord | null) {
    globalThis.__camdxInboundLast = value;
  },
};

const PLACEHOLDER_ACTOR_DID = "did:iota:testnet:0xCAMDX_PROVIDER_PLACEHOLDER";
// Poll the activity log until tasks reach a terminal state (no pending/running,
// or any errored task), with a hard ceiling so a stuck handler can't hang the
// inbound request. Values are conservative: Kitsune's test-app typically
// finalizes within a couple seconds.
const ACTIVITY_LOG_INITIAL_DELAY_MS = 750;
const ACTIVITY_LOG_POLL_INTERVAL_MS = 1000;
const ACTIVITY_LOG_POLL_TIMEOUT_MS = 12_000;

function isTerminalActivityLog(log: ActivityLogEntry): boolean {
  // The new dataspace-models expose a single top-level status:
  // pending | registering | running | completed | error
  return log.status === "completed" || log.status === "error";
}

async function waitForActivityLog(
  activityLogId: string,
): Promise<ActivityLogEntry> {
  await new Promise((r) => setTimeout(r, ACTIVITY_LOG_INITIAL_DELAY_MS));
  const deadline = Date.now() + ACTIVITY_LOG_POLL_TIMEOUT_MS;
  let last: ActivityLogEntry | undefined;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      last = await getActivityLog(activityLogId);
      if (isTerminalActivityLog(last)) return last;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, ACTIVITY_LOG_POLL_INTERVAL_MS));
  }
  if (last) return last;
  throw lastError ?? new Error("Activity log did not become available");
}

function resolveActorDid(): string {
  return getEnv().TWIN_NODE_ADMIN_DID || PLACEHOLDER_ACTOR_DID;
}

function extractEnvelope(headers: Headers): CamdxEnvelopeMetadata {
  const client = headers.get("x-road-client");
  if (!client) {
    throw new Error("Missing required header: X-Road-Client");
  }
  return {
    client,
    service: headers.get("x-road-service") ?? undefined,
    messageId: headers.get("x-road-id") ?? crypto.randomUUID(),
    userId: headers.get("x-road-userid") ?? undefined,
    issue: headers.get("x-road-issue") ?? undefined,
    requestHash:
      headers.get("x-road-body-digest") ??
      headers.get("x-road-request-hash") ??
      undefined,
    receivedAt: new Date().toISOString(),
  };
}

// Headers we never want to echo back to the browser via the GET handler — even
// in a testing/demo environment. Filtering happens at capture time so the cache
// itself never holds them.
const SENSITIVE_HEADER_PREFIXES = ["authorization", "cookie", "set-cookie"];

function headerSnapshot(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADER_PREFIXES.some((p) => lower.startsWith(p))) {
      out[key] = "<redacted>";
      return;
    }
    out[key] = value;
  });
  return out;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function pipeToTwin(
  activity: IActivity,
  payload: Record<string, unknown>,
  envelope: CamdxEnvelopeMetadata,
): Promise<TwinForwardSummary> {
  if (!isKitsuneConfigured()) {
    return { configured: false };
  }

  const env = getEnv();
  const issuerDid = env.TWIN_NODE_ADMIN_DID;
  const vmLocalId = env.TWIN_NODE_ASSERTION_VM_ID;

  const summary: TwinForwardSummary = { configured: true };

  // Stages 3 + 4: forward activity to /inbox (unauthenticated local push),
  // then poll the activity log until it reaches a terminal state.
  try {
    const notify = await forwardActivity(activity);
    summary.notify = { status: "ok", data: notify };

    try {
      const log = await waitForActivityLog(notify.activityLogId);
      summary.activityLog = { status: "ok", data: log };
    } catch (err) {
      summary.activityLog = { status: "error", error: errorMessage(err) };
    }
  } catch (err) {
    summary.notify = { status: "error", error: errorMessage(err) };
  }

  // Stage 5: issue a signed W3C VC for the consignment, using an assertion-
  // method key on the admin DID. The VM is created on-demand if missing
  // (idempotent).
  if (issuerDid) {
    try {
      const vm = await ensureVerificationMethod(issuerDid, vmLocalId);
      // Distinct revocation slot per credential so revoking one VC doesn't
      // invalidate the others. 16-bit space is what the BitstringStatusList
      // / RevocationBitmap2022 schemes commonly support.
      const revocationIndex = Math.floor(Math.random() * 65_536);
      const credential = await createCredential({
        identity: issuerDid,
        verificationMethodId: vmLocalId,
        credentialId: `urn:camdx:credential:${envelope.messageId}`,
        subject: payload,
        revocationIndex,
      });
      summary.credential = {
        status: "ok",
        data: {
          ...credential,
          verificationMethodId: vmLocalId,
          verificationMethodAlreadyExisted: vm.alreadyExisted,
        },
      };
    } catch (err) {
      summary.credential = { status: "error", error: errorMessage(err) };
    }
  }

  // Stage 6: anchor as on-chain attestation
  try {
    const attestation = await createAttestation(payload);
    summary.attestation = { status: "ok", data: attestation };
  } catch (err) {
    summary.attestation = { status: "error", error: errorMessage(err) };
  }

  return summary;
}

export async function POST(request: Request): Promise<NextResponse> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  if (!isJsonObject(payload)) {
    return NextResponse.json(
      { error: "Body must be a JSON object" },
      { status: 400 },
    );
  }

  let envelope: CamdxEnvelopeMetadata;
  try {
    envelope = extractEnvelope(request.headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad envelope";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const activity = translateToActivity({
    envelope,
    actorDid: resolveActorDid(),
    payload,
  });

  const twin = await pipeToTwin(activity, payload, envelope);

  const record: InboundRecord = {
    received: {
      headers: headerSnapshot(request.headers),
      body: payload,
    },
    envelope,
    activity,
    twin,
  };

  cache.last = record;

  return NextResponse.json(record, { status: 201 });
}

export async function GET(): Promise<NextResponse> {
  const last = cache.last;
  if (!last) {
    return NextResponse.json(
      { message: "No inbound envelope received yet. Run `npm run simulator`." },
      { status: 404 },
    );
  }
  return NextResponse.json({
    ...last,
    note: "Single-process in-memory cache. On a multi-worker or serverless deploy, the POST and this GET may hit different workers; for production this would be backed by KV or a database.",
  });
}
