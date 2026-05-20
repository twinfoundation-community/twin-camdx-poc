import { randomUUID } from "node:crypto";
import { getEnv } from "../env";
import type {
  XRoadCallOptions,
  XRoadCallResult,
  XRoadHttpMethod,
} from "./types";

/**
 * Build the full REST gateway URL for an X-Road call.
 * Shape: {baseUrl}/r1/{serviceId}[/path][?query]
 * Per spec the service identifier parts are NOT percent-encoded (slashes are
 * path separators), but the optional sub-path components and query values are.
 */
function buildUrl(
  baseUrl: string,
  service: string,
  path?: string,
  query?: Record<string, string>,
): string {
  const base = baseUrl.replace(/\/+$/, "");
  const suffix = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  const url = new URL(`${base}/r1/${service}${suffix}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

function basicAuthHeader(user?: string, pass?: string): string | undefined {
  if (!user || !pass) return undefined;
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

function parseResponseBody(text: string, contentType: string | null): unknown {
  if (!text) return null;
  if (contentType?.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

/**
 * Perform an X-Road REST call against a security server's /r1/ gateway.
 *
 * Returns the full request and response (URL, headers, body) so the demo UI can
 * display the wire as the artefact — the point of this demo is to show CamDX
 * protocol compatibility, not the payload itself.
 */
export async function callXRoad<T = unknown>(
  options: XRoadCallOptions,
): Promise<XRoadCallResult<T>> {
  const env = getEnv();
  const method: XRoadHttpMethod = options.method ?? "GET";
  const url = buildUrl(
    env.XROAD_PLAYGROUND_BASE_URL,
    options.service,
    options.path,
    options.query,
  );

  const headers: Record<string, string> = {
    "X-Road-Client": env.XROAD_CLIENT_IDENTIFIER,
    "X-Road-Id": randomUUID(),
    Accept: "application/json",
  };
  if (options.userId) headers["X-Road-UserId"] = options.userId;
  if (options.issue) headers["X-Road-Issue"] = options.issue;

  const auth = basicAuthHeader(
    env.XROAD_PLAYGROUND_AUTH_USER,
    env.XROAD_PLAYGROUND_AUTH_PASS,
  );
  if (auth) headers.Authorization = auth;

  const body = options.body !== undefined ? JSON.stringify(options.body) : null;
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: body ?? undefined,
  });

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const text = await response.text();
  const parsed = parseResponseBody(text, response.headers.get("content-type"));

  // Strip credentials before returning the request snapshot to callers — both
  // the API route and any browser consumer receive this object.
  const safeRequestHeaders = { ...headers };
  if (safeRequestHeaders.Authorization) {
    safeRequestHeaders.Authorization = "Basic <redacted>";
  }
  const safeResponseHeaders = { ...responseHeaders };
  if (safeResponseHeaders.authorization) {
    safeResponseHeaders.authorization = "Basic <redacted>";
  }

  return {
    request: {
      method,
      url,
      headers: safeRequestHeaders,
      body,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: safeResponseHeaders,
      body: parsed as T | string | null,
    },
  };
}

/**
 * Convenience: invoke the X-Road meta service `listMethods` for the configured
 * service identifier's subsystem. Returns the list of services the subsystem
 * advertises. Works against any compliant X-Road instance.
 *
 * The meta service is invoked by replacing the SERVICECODE in the service
 * identifier with `listMethods`.
 */
export async function listMethods<T = unknown>(
  serviceIdentifier?: string,
): Promise<XRoadCallResult<T>> {
  const env = getEnv();
  const id = serviceIdentifier ?? env.XROAD_SERVICE_IDENTIFIER;
  const parts = id.split("/");
  // Drop the trailing SERVICECODE if present, then append listMethods.
  // Identifier shapes: INSTANCE/CLASS/MEMBER/SUBSYSTEM/SERVICECODE
  //                or  INSTANCE/CLASS/MEMBER/SUBSYSTEM (rare)
  const subsystemId = parts.length >= 5 ? parts.slice(0, 4).join("/") : id;
  return callXRoad<T>({ service: `${subsystemId}/listMethods` });
}
