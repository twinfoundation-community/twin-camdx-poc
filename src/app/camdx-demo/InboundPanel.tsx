"use client";

import { useCallback, useRef, useState } from "react";
import {
  attestationUrnToObjectId,
  didToObjectId,
  explorerObjectUrl,
} from "@/lib/twin/explorer";

interface ActivityLogEntry {
  id: string;
  generator?: string;
  dateCreated?: string;
  dateModified?: string;
  status?: string;
  pendingTasks?: unknown[];
  runningTasks?: unknown[];
  finalizedTasks?: unknown[];
  inErrorTasks?: unknown[];
  [key: string]: unknown;
}

type StepResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: string };

interface VerifiableCredentialData {
  verifiableCredential: Record<string, unknown>;
  jwt: string;
  verificationMethodId: string;
  verificationMethodAlreadyExisted: boolean;
}

interface TwinForwardSummary {
  configured: boolean;
  notify?: StepResult<{ activityLogId: string }>;
  activityLog?: StepResult<ActivityLogEntry>;
  credential?: StepResult<VerifiableCredentialData>;
  attestation?: StepResult<{ attestationId: string }>;
}

interface InboundRecord {
  received: {
    headers: Record<string, string>;
    body: unknown;
  };
  envelope: {
    client: string;
    service?: string;
    messageId: string;
    userId?: string;
    issue?: string;
    requestHash?: string;
    receivedAt: string;
  };
  activity: Record<string, unknown>;
  twin: TwinForwardSummary;
  note?: string;
}

type StageState = "ok" | "error" | "skipped";

export function InboundPanel() {
  const [record, setRecord] = useState<InboundRecord | null>(null);
  const [status, setStatus] = useState<"idle" | "simulating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLOListElement | null>(null);

  const simulate = useCallback(async () => {
    setRecord(null);
    setError(null);
    setStatus("simulating");
    try {
      const response = await fetch("/api/camdx/simulate", { method: "POST" });
      const data = (await response.json()) as InboundRecord | { error: string };
      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : `HTTP ${response.status}`);
        setStatus("error");
        return;
      }
      setRecord(data);
      setStatus("idle");
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStatus("error");
    }
  }, []);

  const busy = status === "simulating";

  return (
    <section>
      <div className="flex flex-col" style={{ minHeight: 340 }}>
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">Inbound · CamDX → TWIN</span>
          <span
            className="status-pill"
            data-state={
              record
                ? "ok"
                : status === "error"
                  ? "error"
                  : status === "simulating"
                    ? "running"
                    : "skipped"
            }
          >
            {record
              ? "Delivered"
              : status === "simulating"
                ? "Simulating"
                : status === "error"
                  ? "Failed"
                  : "Ready"}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <span className="channel" data-kind="simulated">
            <span className="label">Simulated</span>
            <span className="detail">X-Road transport</span>
          </span>
          <span className="channel">
            <span className="label">Live</span>
            <span className="detail">TWIN node · IOTA testnet</span>
          </span>
        </div>

        <h2
          className="heading mt-6"
          style={{
            fontSize: 32,
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: "-0.012em",
          }}
        >
          CamDX delivers a record to TWIN.
        </h2>
        <p
          className="body-sm mt-3 max-w-[58ch]"
          style={{ color: "var(--color-slate-light)" }}
        >
          The X-Road upstream is simulated. Everything downstream is live.
        </p>

        <div style={{ marginTop: "auto", paddingTop: 32 }}>
          <button
            type="button"
            onClick={simulate}
            disabled={busy}
            className="btn-primary"
          >
            {status === "simulating"
              ? "Simulating delivery…"
              : record
                ? "Run a fresh simulation"
                : "Simulate CamDX delivery"}
          </button>
        </div>
      </div>

      {status === "simulating" && (
        <div className="mt-8">
          <span className="meta-label">Working</span>
          <p className="body-sm mt-1.5" style={{ color: "var(--color-slate-light)" }}>
            Notify → activity log → credential → attestation. ~5s.
          </p>
        </div>
      )}

      {!record && status !== "simulating" && !error && (
        <p className="body-sm mt-8 max-w-[60ch]" style={{ color: "var(--color-cloud-dark)", fontStyle: "italic" }}>
          Click <em>Simulate CamDX delivery</em> to run the six-stage pipeline.
        </p>
      )}

      {error && (
        <div role="alert" className="mt-8">
          <span className="meta-label" style={{ color: "var(--color-clay)" }}>
            Error
          </span>
          <p className="mt-1.5 font-mono text-[12px]" style={{ color: "var(--color-clay)" }}>
            {error}
          </p>
        </div>
      )}

      {record && (
        <ol className="timeline mt-12" ref={resultRef}>
          <Stage num={1} title="Envelope received" state="ok" channel={{ kind: "simulated", detail: "no real X-Road wire" }} caption="The headers below match what a Cambodian Security Server would deliver.">
            <Definitions
              entries={[
                ["X-Road-Client", record.envelope.client],
                ...(record.envelope.service
                  ? ([["X-Road-Service", record.envelope.service]] as [string, string][])
                  : []),
                ["X-Road-Id", record.envelope.messageId],
                ...(record.envelope.userId
                  ? ([["X-Road-UserId", record.envelope.userId]] as [string, string][])
                  : []),
                ["Received at", record.envelope.receivedAt],
              ]}
            />
          </Stage>

          <Stage num={2} title="Translated to W3C Activity Streams" state="ok" channel={{ kind: "live", detail: "Inbound handler" }} caption={`type: "${String(record.activity.type)}", @context: ${formatContext(record.activity["@context"])}`}>
            <ScrollExhibit label="Activity payload" text={JSON.stringify(record.activity, null, 2)} maxHeight={220} />
          </Stage>

          <Stage num={3} title="Forwarded to TWIN's data layer" state={stageState(record.twin.configured, record.twin.notify)} channel={{ kind: "live", detail: "POST /dataspace/notify" }} caption={notifyCaption(record.twin)}>
            {record.twin.notify?.status === "ok" && (
              <KVStack rows={[["Activity log URN", record.twin.notify.data.activityLogId]]} />
            )}
            {record.twin.notify?.status === "error" && <ErrorLine text={record.twin.notify.error} />}
          </Stage>

          <Stage num={4} title="Ingestion confirmed" state={stageState(record.twin.configured, record.twin.activityLog)} channel={{ kind: "live", detail: "GET /dataspace/activity-logs/:id" }} caption={activityLogCaption(record.twin)}>
            {record.twin.activityLog?.status === "ok" && <ActivityLogSummary entry={record.twin.activityLog.data} />}
            {record.twin.activityLog?.status === "error" && <ErrorLine text={record.twin.activityLog.error} />}
          </Stage>

          <Stage num={5} title="Signed as W3C Verifiable Credential" state={stageState(record.twin.configured, record.twin.credential)} channel={{ kind: "live", detail: "Ed25519 signature anchored on IOTA" }} caption={credentialCaption(record.twin)}>
            {record.twin.credential?.status === "ok" && <CredentialSummary data={record.twin.credential.data} />}
            {record.twin.credential?.status === "error" && <ErrorLine text={record.twin.credential.error} />}
          </Stage>

          <Stage num={6} title="Anchored on IOTA" state={stageState(record.twin.configured, record.twin.attestation)} channel={{ kind: "live", detail: "On-chain NFT on IOTA testnet" }} caption={attestationCaption(record.twin)} last>
            {record.twin.attestation?.status === "ok" && <AttestationSummary attestationId={record.twin.attestation.data.attestationId} />}
            {record.twin.attestation?.status === "error" && <ErrorLine text={record.twin.attestation.error} />}
          </Stage>
        </ol>
      )}

      {record?.note && (
        <p
          className="body-sm mt-12 max-w-[58ch]"
          style={{ color: "var(--color-cloud-dark)", fontStyle: "italic", borderLeft: "2px solid var(--color-cloud-light)", paddingLeft: 16 }}
        >
          {record.note}
        </p>
      )}
    </section>
  );
}

/* ─── Timeline plumbing ─────────────────────────────────────────────────── */

function Stage({
  num,
  title,
  state,
  caption,
  channel,
  children,
  last,
}: {
  num: number;
  title: string;
  state: StageState;
  caption?: string;
  channel?: { kind: "live" | "simulated"; detail: string };
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li
      className={`stage ${last ? "stage-last" : ""}`}
      style={{
        opacity: 0,
        animation: `stage-in 420ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards`,
        animationDelay: `${num * 90}ms`,
      }}
    >
      <div className="stage-numeral">{String(num).padStart(2, "0")}</div>
      <div className="stage-content">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h3 className="subheading">{title}</h3>
          <span className="status-pill" data-state={state}>
            {state === "ok" ? "Ok" : state === "error" ? "Error" : "Skipped"}
          </span>
        </div>
        {channel && (
          <div className="mt-2">
            <span className="channel" data-kind={channel.kind}>
              <span className="label">{channel.kind === "live" ? "Live" : "Simulated"}</span>
              <span className="detail">{channel.detail}</span>
            </span>
          </div>
        )}
        {caption && (
          <p className="body-sm mt-2" style={{ color: "var(--color-slate-light)" }}>
            {caption}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
      <style>{stageStyles}</style>
    </li>
  );
}

const stageStyles = `
.timeline { position: relative; list-style: none; padding: 0; margin: 0; min-width: 0; }
.timeline::before {
  content: "";
  position: absolute;
  left: 1.5rem;
  top: 0.8rem;
  bottom: 0.8rem;
  width: 1px;
  background: var(--color-cloud-light);
}
.stage {
  display: grid;
  grid-template-columns: 3rem minmax(0, 1fr);
  gap: 1.5rem;
  padding-bottom: 2.5rem;
  position: relative;
}
.stage-last { padding-bottom: 0; }
.stage > .stage-numeral {
  position: relative;
  background: var(--color-ivory-light);
  padding-top: 2px;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-cloud-dark);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  z-index: 1;
}
.stage > .stage-content { min-width: 0; }
@keyframes stage-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .stage { animation: none !important; opacity: 1 !important; }
}
`;

function stageState(
  configured: boolean,
  result: StepResult<unknown> | undefined,
): StageState {
  if (!configured || !result) return "skipped";
  return result.status === "ok" ? "ok" : "error";
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function Definitions({ entries }: { entries: [string, string][] }) {
  return (
    <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1.5 text-[12.5px]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="tnum font-mono" style={{ color: "var(--color-cloud-dark)" }}>
            {k}
          </dt>
          <dd
            className="min-w-0 font-mono"
            style={{ overflowWrap: "anywhere", wordBreak: "break-all", color: "var(--color-slate-dark)" }}
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function KVStack({ rows }: { rows: [string, string][] }) {
  return (
    <div className="min-w-0 space-y-3">
      {rows.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <div className="meta-label">{label}</div>
          <div
            className="mt-1 font-mono text-[12px] leading-[1.55]"
            style={{ overflowWrap: "anywhere", wordBreak: "break-all", color: "var(--color-slate-dark)" }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScrollExhibit({
  label,
  text,
  maxHeight,
  wrap,
}: {
  label: string;
  text: string;
  maxHeight: number;
  wrap?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="meta-label">{label}</div>
      <pre
        className="mt-1.5 w-full max-w-full overflow-auto font-mono text-[11.5px] leading-[1.55] p-3"
        style={{
          maxHeight: `${maxHeight}px`,
          background: "var(--color-ivory-medium)",
          color: "var(--color-slate-dark)",
          border: "1px solid var(--color-cloud-light)",
          ...(wrap ? { whiteSpace: "pre-wrap", overflowWrap: "anywhere" } : {}),
        }}
      >
        {text}
      </pre>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div
      className="font-mono text-[12px] leading-[1.5] p-3"
      style={{
        color: "var(--color-clay)",
        background: "var(--color-ivory-medium)",
        borderLeft: "2px solid var(--color-clay)",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}
    >
      {text}
    </div>
  );
}

function ActivityLogSummary({ entry }: { entry: ActivityLogEntry }) {
  const counts: [string, number][] = [
    ["pending", entry.pendingTasks?.length ?? 0],
    ["running", entry.runningTasks?.length ?? 0],
    ["finalized", entry.finalizedTasks?.length ?? 0],
    ["errors", entry.inErrorTasks?.length ?? 0],
  ];
  return (
    <div className="space-y-4">
      <KVStack
        rows={[
          ["Log id", entry.id],
          ...(entry.generator
            ? ([["Generator DID", entry.generator]] as [string, string][])
            : []),
        ]}
      />
      <div>
        <div className="meta-label">Tasks</div>
        <div className="mt-2 grid grid-cols-4 gap-3">
          {counts.map(([k, v]) => (
            <div
              key={k}
              className="p-3 text-center"
              style={{ background: "var(--color-ivory-medium)" }}
            >
              <div
                className="font-sans tnum"
                style={{ fontSize: 22, fontWeight: 600, lineHeight: 1, color: "var(--color-slate-dark)" }}
              >
                {v}
              </div>
              <div
                className="mt-1.5"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  color: "var(--color-cloud-dark)",
                }}
              >
                {k}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CredentialSummary({ data }: { data: VerifiableCredentialData }) {
  const vc = data.verifiableCredential;
  const proof = (vc.proof as Record<string, unknown> | undefined) ?? {};
  const types = Array.isArray(vc.type)
    ? (vc.type as string[]).join(", ")
    : String(vc.type ?? "");
  const cryptosuite = String(proof.cryptosuite ?? "—");
  const verificationMethod = String(proof.verificationMethod ?? "—");
  const issuer = String(vc.issuer ?? "");
  const issuerObjectId = didToObjectId(issuer);
  const decoded = decodeJwt(data.jwt);
  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <div className="meta-label">Issuer DID</div>
        <div
          className="mt-1.5 font-mono text-[12px]"
          style={{ overflowWrap: "anywhere", wordBreak: "break-all", color: "var(--color-slate-dark)" }}
        >
          {issuer || "—"}
        </div>
        {issuerObjectId && (
          <a
            href={explorerObjectUrl(issuerObjectId)}
            target="_blank"
            rel="noopener noreferrer"
            className="link mt-2 inline-block text-[12px]"
          >
            View on IOTA explorer ↗
          </a>
        )}
      </div>

      <KVStack
        rows={[
          ["Credential id", String(vc.id ?? "—")],
          ["Types", types],
        ]}
      />

      <div className="min-w-0">
        <div className="meta-label">Proof</div>
        <dl className="mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1 font-mono text-[12px]">
          <dt style={{ color: "var(--color-cloud-dark)" }}>cryptosuite</dt>
          <dd
            style={{
              color: "var(--color-slate-dark)",
              textDecoration: "underline",
              textDecorationThickness: "2px",
              textUnderlineOffset: "3px",
            }}
          >
            {cryptosuite}
          </dd>
          <dt style={{ color: "var(--color-cloud-dark)" }}>verificationMethod</dt>
          <dd
            className="min-w-0"
            style={{ overflowWrap: "anywhere", wordBreak: "break-all", color: "var(--color-slate-dark)" }}
          >
            {verificationMethod}
          </dd>
        </dl>
      </div>

      {decoded && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ScrollExhibit
            label="Decoded · header"
            text={JSON.stringify(decoded.header, null, 2)}
            maxHeight={150}
          />
          <ScrollExhibit
            label="Decoded · payload"
            text={JSON.stringify(decoded.payload, null, 2)}
            maxHeight={150}
          />
        </div>
      )}

      <VerifyCredential jwt={data.jwt} />
    </div>
  );
}

interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
}

function decodeJwt(jwt: string): DecodedJwt | null {
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const decode = (segment: string): Record<string, unknown> => {
      const padded =
        segment.replace(/-/g, "+").replace(/_/g, "/") +
        "===".slice((segment.length + 3) % 4);
      const text =
        typeof atob === "function"
          ? atob(padded)
          : Buffer.from(padded, "base64").toString("utf8");
      return JSON.parse(text) as Record<string, unknown>;
    };
    return { header: decode(parts[0] ?? ""), payload: decode(parts[1] ?? "") };
  } catch {
    return null;
  }
}

interface VerifyResult {
  revoked: boolean;
  verifiableCredential?: Record<string, unknown>;
}

function VerifyCredential({ jwt }: { jwt: string }) {
  const [state, setState] = useState<"idle" | "verifying" | "ok" | "error">(
    "idle",
  );
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setState("verifying");
    setResult(null);
    setError(null);
    try {
      const response = await fetch("/api/camdx/verify-credential", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jwt }),
      });
      const data = (await response.json()) as VerifyResult | { error: string };
      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : `HTTP ${response.status}`);
        setState("error");
        return;
      }
      setResult(data);
      setState("ok");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setState("error");
    }
  }

  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={verify}
        disabled={state === "verifying"}
        className="btn-ghost"
      >
        {state === "verifying" ? "Verifying…" : "Verify credential"}
      </button>

      {state === "ok" && result && (
        <div className="mt-3">
          <span
            className="status-pill"
            data-state={result.revoked ? "error" : "ok"}
          >
            {result.revoked ? "Revoked" : "Signature valid · not revoked"}
          </span>
          <p
            className="body-sm mt-2"
            style={{ color: "var(--color-slate-light)" }}
          >
            Kitsune verified the EdDSA signature against the issuer&apos;s
            published verification method and checked the revocation
            bitmap. Independent of our app.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="mt-3">
          <span className="status-pill" data-state="error">
            Verification failed
          </span>
          <p
            className="mt-2 font-mono text-[12px]"
            style={{ color: "var(--color-clay)" }}
          >
            {error}
          </p>
        </div>
      )}
    </div>
  );
}

function AttestationSummary({ attestationId }: { attestationId: string }) {
  const objectId = attestationUrnToObjectId(attestationId);
  return (
    <div className="min-w-0 space-y-5">
      <div className="min-w-0">
        <div className="meta-label">Attestation URN</div>
        <div
          className="mt-1.5 font-mono text-[12px] leading-[1.55]"
          style={{ overflowWrap: "anywhere", wordBreak: "break-all", color: "var(--color-slate-dark)" }}
        >
          {attestationId}
        </div>
      </div>

      {objectId && (
        <div className="card-dark">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_max-content] sm:items-end">
            <div>
              <span
                className="meta-label"
                style={{ color: "var(--color-ivory-dark)" }}
              >
                Verify independently
              </span>
              <h4 className="display-serif mt-2">
                Audit this NFT on IOTA.
              </h4>
              <p
                className="body-sm mt-3 max-w-[40ch]"
                style={{ color: "var(--color-ivory-dark)" }}
              >
                The object id resolves on the public explorer. Anyone can
                verify the on-chain record without our cooperation.
              </p>
            </div>
            <a
              href={explorerObjectUrl(objectId)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-on-dark"
            >
              Open explorer ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Caption helpers ───────────────────────────────────────────────────── */

function formatContext(ctx: unknown): string {
  if (typeof ctx === "string") return ctx;
  if (Array.isArray(ctx)) return `[${ctx.length} entries]`;
  return "<object>";
}

function notifyCaption(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped — TWIN node not configured.";
  const n = twin.notify;
  if (!n) return "Not attempted.";
  if (n.status === "ok") return "201 Created. Activity log URN in Location header.";
  return "Forward failed.";
}

function activityLogCaption(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped.";
  const al = twin.activityLog;
  if (!al) return "Not attempted.";
  if (al.status === "ok") {
    const total =
      (al.data.pendingTasks?.length ?? 0) +
      (al.data.runningTasks?.length ?? 0) +
      (al.data.finalizedTasks?.length ?? 0) +
      (al.data.inErrorTasks?.length ?? 0);
    if (total === 0) return "Activity persisted; no subscribers on this generic endpoint.";
    return `Activity dispatched to ${total} task${total === 1 ? "" : "s"}.`;
  }
  return "Activity log fetch failed.";
}

function attestationCaption(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped.";
  const a = twin.attestation;
  if (!a) return "Not attempted.";
  if (a.status === "ok") return "201 Created. Fingerprint is now an on-chain NFT.";
  return "Attestation create failed.";
}

function credentialCaption(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped.";
  const c = twin.credential;
  if (!c) return "Not attempted — TWIN node not configured.";
  if (c.status === "ok") {
    const verb = c.data.verificationMethodAlreadyExisted ? "reused" : "created";
    return `Verification method ${verb}. Signed with DataIntegrityProof.`;
  }
  return "VC issuance failed.";
}
