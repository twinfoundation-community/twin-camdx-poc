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
  const [status, setStatus] = useState<
    "idle" | "loading" | "simulating" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLOListElement | null>(null);

  const simulate = useCallback(async () => {
    // Clear any prior state immediately so the click feels real, even on
    // warm-lambda Vercel where the previous run might still be in module
    // memory.
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
      // Scroll the timeline into view so the user is taken to the result
      // rather than being left staring at the (now-empty) button area.
      requestAnimationFrame(() => {
        resultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStatus("error");
    }
  }, []);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/camdx/inbound");
      if (response.status === 404) {
        setRecord(null);
        setStatus("idle");
        return;
      }
      if (!response.ok) {
        setError(`HTTP ${response.status}`);
        setStatus("error");
        return;
      }
      const data = (await response.json()) as InboundRecord;
      setRecord(data);
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStatus("error");
    }
  }, []);

  // No on-mount auto-fetch. On Vercel warm lambdas the inbound cache from a
  // previous visitor's run would otherwise leak into the new page load, making
  // it impossible to tell that a click has done anything. The empty initial
  // state makes the "click Simulate" call-to-action unambiguous.

  const busy = status === "loading" || status === "simulating";

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <span className="cartouche">Exhibit B · CamDX → TWIN</span>
        <span
          className="status-pill"
          data-state={record ? "ok" : status === "error" ? "error" : "skipped"}
        >
          {record
            ? "Delivered"
            : status === "simulating"
              ? "Simulating"
              : status === "loading"
                ? "Loading"
                : status === "error"
                  ? "Failed"
                  : "Ready"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="channel" data-kind="simulated">
          Simulated transport
          <span className="detail">X-Road envelope built locally</span>
        </span>
        <span className="channel" data-kind="live">
          Live TWIN pipeline
          <span className="detail">
            kitsune.staging.twinnodes.com · IOTA Rebased testnet
          </span>
        </span>
      </div>

      <h2 className="mt-4 font-display text-[34px] leading-[1.1] tracking-[-0.01em] text-ink">
        CamDX delivers a record to TWIN.
      </h2>
      <p className="mt-3 max-w-[58ch] text-[14px] leading-[1.6] text-ink-soft">
        The X-Road upstream is simulated locally (no Cambodian TWIN subsystem
        is registered on a real X-Road central server yet — procedural, not
        technical). From the moment the envelope reaches our handler, the
        rest of the pipeline is fully live: real network calls to a hosted
        TWIN node, real Ed25519 signature, real on-chain NFT.
      </p>

      <div className="mt-7">
        <button
          type="button"
          onClick={simulate}
          disabled={busy}
          className="btn-primary"
        >
          {status === "simulating" ? (
            <>
              <span className="block h-2.5 w-2.5 animate-pulse rounded-full bg-ochre" />
              Simulating delivery…
            </>
          ) : record ? (
            "Run a fresh simulation"
          ) : (
            "Simulate CamDX delivery"
          )}
        </button>
      </div>

      {status === "simulating" && (
        <div className="mt-6 border-l-2 border-ochre bg-paper-tint p-4 text-[13px] leading-[1.6] text-ink-soft">
          <span className="label" style={{ color: "var(--color-ochre)" }}>
            Working
          </span>
          <p className="mt-1 text-ink">
            Building the X-Road envelope, translating, then sequencing four live
            calls to Kitsune (notify → activity-log → verifiable-credential →
            attestation). Usually completes in 3–6 seconds.
          </p>
        </div>
      )}

      <details className="mt-5 max-w-[62ch] text-[12px] leading-[1.6] text-ink-soft">
        <summary className="cursor-pointer select-none text-ink-faint hover:text-ink">
          Or trigger from a developer terminal
        </summary>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <pre className="border border-rule-soft bg-paper-tint px-3 py-2 font-mono text-[12px] text-ink">
            <span className="text-ink-faint">$ </span>npm run simulator
          </pre>
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="btn-ghost"
            style={{ fontSize: "11px", padding: "6px 12px" }}
          >
            {status === "loading" ? "Refreshing…" : "Refresh last seen"}
          </button>
          <span className="italic text-ink-faint">
            (single-process cache; reliable on local dev, not on multi-worker
            deploys)
          </span>
        </div>
      </details>

      {!record && status !== "simulating" && !error && (
        <p className="mt-8 max-w-[60ch] text-[13px] italic text-ink-soft">
          Click <em>Simulate CamDX delivery</em> above to drive the pipeline
          end-to-end and see the six-stage timeline populate with real
          cryptographic artefacts.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-8 border-l-2 border-brick bg-paper-tint p-4 text-[13px] text-brick"
        >
          <span className="label" style={{ color: "var(--color-brick)" }}>
            Error
          </span>
          <p className="mt-1 font-mono text-[12px]">{error}</p>
        </div>
      )}

      {record && (
        <ol className="timeline mt-10" ref={resultRef}>
          <Stage
            num={1}
            title="Envelope received"
            state="ok"
            channel={{
              kind: "simulated",
              detail: "X-Road envelope constructed in Node, then handed to the inbound route",
            }}
            caption="The headers below are exactly what a Cambodian Security Server would deliver to a registered TWIN subsystem — minus the SS-to-SS mTLS, which is the part we don't yet operate."
          >
            <Definitions
              entries={[
                ["X-Road-Client", record.envelope.client],
                ...(record.envelope.service
                  ? ([["X-Road-Service", record.envelope.service]] as [
                      string,
                      string,
                    ][])
                  : []),
                ["X-Road-Id", record.envelope.messageId],
                ...(record.envelope.userId
                  ? ([["X-Road-UserId", record.envelope.userId]] as [
                      string,
                      string,
                    ][])
                  : []),
                ["Received at", record.envelope.receivedAt],
              ]}
            />
          </Stage>

          <Stage
            num={2}
            title="Translated to W3C Activity Streams"
            state="ok"
            channel={{
              kind: "live",
              detail: "Pure code transformation in the inbound handler",
            }}
            caption={`Wrapped as type "${String(record.activity.type)}" with @context ${formatContext(record.activity["@context"])}.`}
          >
            <ScrollExhibit
              label="Activity payload"
              text={JSON.stringify(record.activity, null, 2)}
              maxHeight={220}
            />
          </Stage>

          <Stage
            num={3}
            title="Forwarded to the data-space-connector"
            state={stageState(record.twin.configured, record.twin.notify)}
            channel={{
              kind: "live",
              detail: "POST kitsune.staging.twinnodes.com/dataspace/notify",
            }}
            caption={notifyCaption(record.twin)}
          >
            {record.twin.notify?.status === "ok" && (
              <KVStack
                rows={[
                  [
                    "Activity log URN",
                    record.twin.notify.data.activityLogId,
                  ],
                ]}
              />
            )}
            {record.twin.notify?.status === "error" && (
              <ErrorLine text={record.twin.notify.error} />
            )}
          </Stage>

          <Stage
            num={4}
            title="Ingestion confirmed"
            state={stageState(record.twin.configured, record.twin.activityLog)}
            channel={{
              kind: "live",
              detail: "GET kitsune.staging.twinnodes.com/dataspace/activity-logs/:id",
            }}
            caption={activityLogCaption(record.twin)}
          >
            {record.twin.activityLog?.status === "ok" && (
              <ActivityLogSummary entry={record.twin.activityLog.data} />
            )}
            {record.twin.activityLog?.status === "error" && (
              <ErrorLine text={record.twin.activityLog.error} />
            )}
          </Stage>

          <Stage
            num={5}
            title="Signed as W3C Verifiable Credential"
            state={stageState(record.twin.configured, record.twin.credential)}
            channel={{
              kind: "live",
              detail: "Ed25519 signature by the admin DID on the IOTA Rebased testnet",
            }}
            caption={credentialCaption(record.twin)}
          >
            {record.twin.credential?.status === "ok" && (
              <CredentialSummary data={record.twin.credential.data} />
            )}
            {record.twin.credential?.status === "error" && (
              <ErrorLine text={record.twin.credential.error} />
            )}
          </Stage>

          <Stage
            num={6}
            title="Anchored on IOTA Rebased testnet"
            state={stageState(record.twin.configured, record.twin.attestation)}
            channel={{
              kind: "live",
              detail: "On-chain NFT minted on IOTA Rebased testnet",
            }}
            caption={attestationCaption(record.twin)}
            last
          >
            {record.twin.attestation?.status === "ok" && (
              <AttestationSummary
                attestationId={record.twin.attestation.data.attestationId}
              />
            )}
            {record.twin.attestation?.status === "error" && (
              <ErrorLine text={record.twin.attestation.error} />
            )}
          </Stage>
        </ol>
      )}

      {record?.note && (
        <p className="mt-10 max-w-[58ch] border-l-2 border-ochre-soft pl-4 text-[12px] leading-[1.6] italic text-ink-soft">
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
  /** What's actually happening at this step — `live` if external systems are
   *  touched, `simulated` if the work is local. The detail string shows what
   *  is touched (e.g. an endpoint hostname or "pure code transformation"). */
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
      <div className="stage-numeral" data-state={state}>
        {String(num).padStart(2, "0")}
      </div>
      <div className="stage-content">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-[22px] leading-[1.15] tracking-[-0.005em] text-ink">
            {title}
          </h3>
          <span className="status-pill" data-state={state}>
            {state === "ok" ? "Ok" : state === "error" ? "Error" : "Skipped"}
          </span>
        </div>
        {channel && (
          <div className="mt-1.5">
            <span className="channel" data-kind={channel.kind}>
              {channel.kind === "live" ? "Live" : "Simulated"}
              <span className="detail">{channel.detail}</span>
            </span>
          </div>
        )}
        {caption && (
          <p className="mt-1.5 text-[12.5px] italic leading-[1.55] text-ink-soft">
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
  left: 2.45rem;
  top: 0.7rem;
  bottom: 0.7rem;
  width: 1px;
  background: var(--color-rule);
}
.stage {
  display: grid;
  /* minmax(0, 1fr) so unbreakable content can't expand the column past the
     parent's width (default 1fr resolves to min-content). */
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: 1.75rem;
  padding-bottom: 2.5rem;
  position: relative;
}
.stage-last { padding-bottom: 0; }
.stage > .stage-numeral {
  justify-self: end;
  position: relative;
  background: var(--color-paper);
  padding: 0 0.3rem;
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
          <dt className="tnum font-mono text-ink-soft">{k}</dt>
          <dd
            className="min-w-0 font-mono text-ink"
            style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}
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
          <div className="label">{label}</div>
          <div
            className="mt-1 font-mono text-[12px] leading-[1.55] text-ink"
            style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}
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
  /** When true, wrap unbreakable strings (good for base64/JWT).
      When false (default), preserve `pre` whitespace and scroll horizontally. */
  wrap?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <pre
        className="mt-1.5 w-full max-w-full overflow-auto border border-rule-soft bg-paper-tint p-3 font-mono text-[11.5px] leading-[1.55] text-ink"
        style={{
          maxHeight: `${maxHeight}px`,
          ...(wrap
            ? { whiteSpace: "pre-wrap", overflowWrap: "anywhere" }
            : {}),
        }}
      >
        {text}
      </pre>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="border-l-2 border-brick bg-paper-tint p-3 text-[12px] leading-[1.5] text-brick">
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono">{text}</pre>
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
        <div className="label">Tasks</div>
        <div className="mt-2 grid grid-cols-4 gap-3">
          {counts.map(([k, v]) => (
            <div
              key={k}
              className="border border-rule-soft bg-paper-tint p-2.5 text-center"
            >
              <div className="font-display text-[22px] leading-none text-ink tnum">
                {v}
              </div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint">
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
  return (
    <div className="space-y-5">
      <div className="min-w-0">
        <div className="label">Issuer DID</div>
        <div
          className="mt-1.5 font-mono text-[12px] text-ink"
          style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}
        >
          {issuer || "—"}
        </div>
        {issuerObjectId && (
          <a
            href={explorerObjectUrl(issuerObjectId)}
            target="_blank"
            rel="noopener noreferrer"
            className="ext-link mt-2 text-[12px]"
          >
            View on IOTA Rebased Explorer{" "}
            <span className="font-mono text-[10px] text-ink-faint">
              ({issuerObjectId.slice(0, 12)}…)
            </span>{" "}
            <span className="arrow">↗</span>
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
        <div className="label">Proof</div>
        <dl className="mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-1 font-mono text-[12px]">
          <dt className="text-ink-soft">cryptosuite</dt>
          <dd className="text-ochre">{cryptosuite}</dd>
          <dt className="text-ink-soft">verificationMethod</dt>
          <dd
            className="min-w-0 text-ink"
            style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}
          >
            {verificationMethod}
          </dd>
        </dl>
      </div>

      <ScrollExhibit
        label="JWT (preview)"
        text={data.jwt.length > 240 ? `${data.jwt.slice(0, 240)}…` : data.jwt}
        maxHeight={120}
        wrap
      />
    </div>
  );
}

function AttestationSummary({ attestationId }: { attestationId: string }) {
  const objectId = attestationUrnToObjectId(attestationId);
  return (
    <div className="min-w-0 space-y-3">
      <div className="min-w-0">
        <div className="label">Attestation URN</div>
        <div
          className="mt-1.5 font-mono text-[12px] leading-[1.55] text-ink"
          style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}
        >
          {attestationId}
        </div>
      </div>
      {objectId && (
        <div className="verify-callout">
          <div className="min-w-0">
            <div className="label-row">
              <span className="moss-dot" />
              <span className="lead">Verify independently</span>
            </div>
            <p className="subject">
              This NFT was just minted on the IOTA Rebased testnet. The object
              id is publicly resolvable on the official explorer — anyone can
              audit it without our cooperation.
            </p>
          </div>
          <a
            href={explorerObjectUrl(objectId)}
            target="_blank"
            rel="noopener noreferrer"
            className="cta"
          >
            Open on explorer <span className="arrow">↗</span>
          </a>
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
  if (!twin.configured) {
    return "Skipped — TWIN_NODE_* env vars are not configured.";
  }
  const n = twin.notify;
  if (!n) return "Not attempted.";
  if (n.status === "ok") {
    return "POST /dataspace/notify returned 201 Created. The activity log URN sits in the Location header.";
  }
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
    if (total === 0) {
      return "Activity persisted under a TWIN-issued URN and re-queryable via the connector API. No downstream processors subscribe to this generic dataspace endpoint — by design — so no background tasks were dispatched. The cryptographic artefacts of interest are produced in the next two stages.";
    }
    return `Activity persisted and dispatched to ${total} downstream task${total === 1 ? "" : "s"}.`;
  }
  return "Activity log fetch failed.";
}

function attestationCaption(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped.";
  const a = twin.attestation;
  if (!a) return "Not attempted.";
  if (a.status === "ok") {
    return "POST /attestation returned 201 Created. The fingerprint is now an immutable on-chain NFT.";
  }
  return "Attestation create failed.";
}

function credentialCaption(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped.";
  const c = twin.credential;
  if (!c) return "Not attempted — TWIN_NODE_ADMIN_DID is unset.";
  if (c.status === "ok") {
    const verb = c.data.verificationMethodAlreadyExisted ? "reused" : "created";
    return `Assertion verification method ${verb}; the credential was signed with DataIntegrityProof.`;
  }
  return "VC issuance failed.";
}
