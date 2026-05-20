/**
 * Server-side client for a hosted TWIN node (Kitsune staging).
 *
 * Follows the canonical TWIN consumption pattern (mirrors `identity-mvp`):
 *  - JWT login via raw fetch against `POST /authentication/login`
 *  - For everything else, instantiate the typed `@twin.org/*-rest-client`
 *    packages with `{ endpoint, headers: { Authorization: "Bearer <jwt>" } }`
 *    and call typed methods. The wire shape stays in sync with the node
 *    automatically because we share the models package.
 *
 * Reference: identity-mvp/lib/services/identity-management-client.ts
 */

import type { IBaseRestClientConfig } from "@twin.org/api-models";
import { AttestationRestClient } from "@twin.org/attestation-rest-client";
import { DataSpaceConnectorRestClient } from "@twin.org/data-space-connector-rest-client";
import { IdentityRestClient } from "@twin.org/identity-rest-client";
import { getEnv } from "../env";
import type { IActivity } from "../camdx/types";
import { PatchedIdentityRestClient } from "./patched-identity-rest-client";

interface AuthSession {
  token: string;
  expiry: number;
}

declare global {
  var __kitsuneAuth: AuthSession | null | undefined;
}

const REFRESH_SAFETY_MS = 60_000;

/**
 * Kitsune's node-core mounts the data-space-connector under `/dataspace` (per
 * Rodrigo's `TWIN_DATASPACE_DATA_PLANE_PATH=dataspace/entities`). The upstream
 * rest-client uses no prefix by default, so we override it.
 */
const DATASPACE_PATH_PREFIX = "dataspace";

class KitsuneNotConfiguredError extends Error {
  constructor() {
    super(
      "Kitsune TWIN node not configured. Set TWIN_NODE_URL, TWIN_NODE_SERVICE_EMAIL, TWIN_NODE_SERVICE_PASSWORD in .env.local.",
    );
    this.name = "KitsuneNotConfiguredError";
  }
}

export function isKitsuneConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.TWIN_NODE_URL &&
      env.TWIN_NODE_SERVICE_EMAIL &&
      env.TWIN_NODE_SERVICE_PASSWORD,
  );
}

async function login(): Promise<AuthSession> {
  const env = getEnv();
  if (!isKitsuneConfigured()) throw new KitsuneNotConfiguredError();

  const response = await fetch(`${env.TWIN_NODE_URL}/authentication/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: env.TWIN_NODE_SERVICE_EMAIL,
      password: env.TWIN_NODE_SERVICE_PASSWORD,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Kitsune login failed: HTTP ${response.status} ${text.slice(0, 200)}`,
    );
  }

  const body = (await response.json()) as {
    token?: string;
    access_token?: string;
    expiry?: number;
  };

  let token = body.token ?? body.access_token;
  if (!token) {
    const setCookie = response.headers.get("set-cookie") ?? "";
    const match = /access_token=([^;]+)/.exec(setCookie);
    token = match?.[1];
  }
  if (!token) throw new Error("Kitsune login returned no token");

  const expiry = body.expiry ?? Date.now() + 60 * 60_000;
  return { token, expiry };
}

async function getSession(): Promise<AuthSession> {
  const cached = globalThis.__kitsuneAuth;
  if (cached && cached.expiry - REFRESH_SAFETY_MS > Date.now()) return cached;
  const fresh = await login();
  globalThis.__kitsuneAuth = fresh;
  return fresh;
}

async function authedConfig(
  overrides: Partial<IBaseRestClientConfig> = {},
): Promise<IBaseRestClientConfig> {
  const env = getEnv();
  if (!env.TWIN_NODE_URL) throw new KitsuneNotConfiguredError();
  const session = await getSession();
  return {
    endpoint: env.TWIN_NODE_URL,
    headers: {
      Authorization: `Bearer ${session.token}`,
      Cookie: `access_token=${session.token}`,
    },
    ...overrides,
  };
}

// ─── Service wrappers ────────────────────────────────────────────────────────

export interface ForwardActivityResult {
  activityLogId: string;
}

export async function forwardActivity(
  activity: IActivity,
): Promise<ForwardActivityResult> {
  const client = new DataSpaceConnectorRestClient(
    await authedConfig({ pathPrefix: DATASPACE_PATH_PREFIX }),
  );
  // The rest-client returns the last segment of the Location header — the
  // activity log URN like `urn:x-activity-log:...`.
  const activityLogId = await client.notifyActivity(
    activity as Parameters<DataSpaceConnectorRestClient["notifyActivity"]>[0],
  );
  return { activityLogId };
}

export type ActivityLogEntry = Awaited<
  ReturnType<DataSpaceConnectorRestClient["getActivityLogEntry"]>
>;

export async function getActivityLog(id: string): Promise<ActivityLogEntry> {
  const client = new DataSpaceConnectorRestClient(
    await authedConfig({ pathPrefix: DATASPACE_PATH_PREFIX }),
  );
  return client.getActivityLogEntry(id);
}

export interface VerificationMethodResult {
  id: string;
  alreadyExisted: boolean;
}

/**
 * Idempotent: ensures an assertion-method verification key exists under the
 * given DID with the supplied local id. Kitsune returns 200 on duplicate (so
 * `alreadyExisted` is best-effort), but the route is safe to call repeatedly.
 */
export async function ensureVerificationMethod(
  identity: string,
  verificationMethodId: string,
): Promise<VerificationMethodResult> {
  const client = new IdentityRestClient(await authedConfig());
  try {
    const vm = await client.verificationMethodCreate(
      identity,
      "assertionMethod",
      verificationMethodId,
    );
    return {
      id: vm.id ?? `${identity}#${verificationMethodId}`,
      alreadyExisted: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already\s*exist|duplicate|exists/i.test(message)) {
      return {
        id: `${identity}#${verificationMethodId}`,
        alreadyExisted: true,
      };
    }
    throw err;
  }
}

export interface VerifiableCredentialResult {
  verifiableCredential: Record<string, unknown>;
  jwt: string;
}

export async function createCredential(input: {
  identity: string;
  verificationMethodId: string;
  credentialId: string;
  subject: Record<string, unknown>;
  revocationIndex?: number;
}): Promise<VerifiableCredentialResult> {
  // PatchedIdentityRestClient overrides verifiableCredentialCreate to fix an
  // upstream URL bug (drop the override once the published rest-client emits
  // /:identity/verifiable-credential/:verificationMethodId correctly).
  const client = new PatchedIdentityRestClient(await authedConfig());
  const fullVmId = `${input.identity}#${input.verificationMethodId}`;
  const result = await client.verifiableCredentialCreate(
    fullVmId,
    input.credentialId,
    input.subject as Parameters<
      IdentityRestClient["verifiableCredentialCreate"]
    >[2],
    input.revocationIndex !== undefined
      ? { revocationIndex: input.revocationIndex }
      : undefined,
  );
  return {
    verifiableCredential: result.verifiableCredential as unknown as Record<
      string,
      unknown
    >,
    jwt: result.jwt,
  };
}

export interface AttestationResult {
  attestationId: string;
}

export async function createAttestation(
  jsonLd: Record<string, unknown>,
): Promise<AttestationResult> {
  const client = new AttestationRestClient(await authedConfig());
  const attestationId = await client.create(
    jsonLd as Parameters<AttestationRestClient["create"]>[0],
  );
  return { attestationId };
}
