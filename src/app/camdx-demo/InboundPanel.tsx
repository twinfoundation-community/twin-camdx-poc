"use client";

import { useCallback, useEffect, useState } from "react";
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

export function InboundPanel() {
  const [record, setRecord] = useState<InboundRecord | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const response = await fetch("/api/camdx/inbound");
      if (response.status === 404) {
        setRecord(null);
        setStatus("empty");
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Inbound</h2>
        <p className="text-sm text-neutral-600">
          CamDX → TWIN. Run the simulator from a terminal — it POSTs an X-Road
          envelope to our handler, which translates it, forwards it to
          Kitsune&apos;s data-space-connector, and anchors the record as an
          attestation.
        </p>
      </header>

      <pre className="mb-4 overflow-x-auto rounded-md bg-neutral-900 p-3 text-xs text-neutral-100">
        npm run simulator
      </pre>

      <button
        type="button"
        onClick={refresh}
        disabled={status === "loading"}
        className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
      >
        {status === "loading" ? "Refreshing…" : "Refresh"}
      </button>

      {status === "empty" && (
        <p className="mt-4 text-sm text-neutral-600">
          No inbound envelope received yet.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      {record && (
        <div className="mt-6 space-y-4 text-sm">
          <Stage
            number={1}
            label="Envelope received"
            state="ok"
            detail="X-Road headers parsed"
          >
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 font-mono text-xs">
              <dt className="text-neutral-700">X-Road-Client:</dt>
              <dd className="break-all">{record.envelope.client}</dd>
              {record.envelope.service && (
                <>
                  <dt className="text-neutral-700">X-Road-Service:</dt>
                  <dd className="break-all">{record.envelope.service}</dd>
                </>
              )}
              <dt className="text-neutral-700">X-Road-Id:</dt>
              <dd className="break-all">{record.envelope.messageId}</dd>
              {record.envelope.userId && (
                <>
                  <dt className="text-neutral-700">X-Road-UserId:</dt>
                  <dd>{record.envelope.userId}</dd>
                </>
              )}
              <dt className="text-neutral-700">Received at:</dt>
              <dd>{record.envelope.receivedAt}</dd>
            </dl>
          </Stage>

          <Stage
            number={2}
            label="Translated to W3C Activity Streams"
            state="ok"
            detail={`type: "${String(record.activity.type)}", @context: ${formatContext(record.activity["@context"])}`}
          >
            <pre className="overflow-x-auto rounded bg-neutral-50 p-2 text-xs">
              {JSON.stringify(record.activity, null, 2)}
            </pre>
          </Stage>

          <Stage
            number={3}
            label="Forwarded to Kitsune /dataspace/notify"
            state={stageState(record.twin.configured, record.twin.notify)}
            detail={notifyDetail(record.twin)}
          >
            {record.twin.notify?.status === "ok" && (
              <KV
                label="Activity log URN"
                value={record.twin.notify.data.activityLogId}
              />
            )}
            {record.twin.notify?.status === "error" && (
              <ErrorBox text={record.twin.notify.error} />
            )}
          </Stage>

          <Stage
            number={4}
            label="Activity log status"
            state={stageState(record.twin.configured, record.twin.activityLog)}
            detail={activityLogDetail(record.twin)}
          >
            {record.twin.activityLog?.status === "ok" && (
              <ActivityLogSummary entry={record.twin.activityLog.data} />
            )}
            {record.twin.activityLog?.status === "error" && (
              <ErrorBox text={record.twin.activityLog.error} />
            )}
          </Stage>

          <Stage
            number={5}
            label="Signed as W3C Verifiable Credential"
            state={stageState(record.twin.configured, record.twin.credential)}
            detail={credentialDetail(record.twin)}
          >
            {record.twin.credential?.status === "ok" && (
              <CredentialSummary data={record.twin.credential.data} />
            )}
            {record.twin.credential?.status === "error" && (
              <ErrorBox text={record.twin.credential.error} />
            )}
          </Stage>

          <Stage
            number={6}
            label="Anchored as attestation"
            state={stageState(record.twin.configured, record.twin.attestation)}
            detail={attestationDetail(record.twin)}
          >
            {record.twin.attestation?.status === "ok" && (
              <AttestationSummary
                attestationId={record.twin.attestation.data.attestationId}
              />
            )}
            {record.twin.attestation?.status === "error" && (
              <ErrorBox text={record.twin.attestation.error} />
            )}
          </Stage>

          {record.note && (
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-900">
              {record.note}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

type StageState = "ok" | "error" | "skipped";

function stageState(
  configured: boolean,
  result: StepResult<unknown> | undefined,
): StageState {
  if (!configured || !result) return "skipped";
  return result.status === "ok" ? "ok" : "error";
}

function Stage({
  number,
  label,
  state,
  detail,
  children,
}: {
  number: number;
  label: string;
  state: StageState;
  detail?: string;
  children?: React.ReactNode;
}) {
  const tone = {
    ok: "border-emerald-200 bg-emerald-50",
    error: "border-red-200 bg-red-50",
    skipped: "border-neutral-200 bg-neutral-50",
  }[state];
  const dot = {
    ok: "bg-emerald-500",
    error: "bg-red-500",
    skipped: "bg-neutral-300",
  }[state];
  const stateLabel = {
    ok: "ok",
    error: "error",
    skipped: "skipped",
  }[state];

  return (
    <div className={`rounded-lg border ${tone}`}>
      <div className="flex items-center gap-2 border-b border-neutral-200/60 px-3 py-2">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${dot} text-[10px] font-bold text-white`}
        >
          {number}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {label}
        </span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-neutral-500">
          {stateLabel}
        </span>
      </div>
      {detail && (
        <div className="border-b border-neutral-200/60 px-3 py-1.5 text-[11px] text-neutral-600">
          {detail}
        </div>
      )}
      {children && <div className="p-3">{children}</div>}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      <div className="mt-1 break-all font-mono text-xs">{value}</div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded bg-red-100/50 p-2 text-xs text-red-900">
      {text}
    </pre>
  );
}

function ActivityLogSummary({ entry }: { entry: ActivityLogEntry }) {
  const counts: Array<[string, unknown[] | undefined]> = [
    ["pending", entry.pendingTasks],
    ["running", entry.runningTasks],
    ["finalized", entry.finalizedTasks],
    ["errors", entry.inErrorTasks],
  ];
  return (
    <div className="space-y-2">
      <KV label="id" value={entry.id} />
      {entry.generator && <KV label="generator (DID)" value={entry.generator} />}
      <div>
        <div className="text-xs font-medium text-neutral-500">Task counts</div>
        <div className="mt-1 flex gap-3 font-mono text-xs">
          {counts.map(([k, v]) => (
            <span key={k}>
              {k}: <strong>{(v ?? []).length}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatContext(ctx: unknown): string {
  if (typeof ctx === "string") return ctx;
  if (Array.isArray(ctx)) return `[${ctx.length} entries]`;
  return "<object>";
}

function notifyDetail(twin: TwinForwardSummary): string {
  if (!twin.configured) {
    return "Skipped — TWIN_NODE_* env vars not set in .env.local";
  }
  const n = twin.notify;
  if (!n) return "Not attempted";
  if (n.status === "ok") return `POST /dataspace/notify → 201 Created`;
  return "Forward failed";
}

function activityLogDetail(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped";
  const al = twin.activityLog;
  if (!al) return "Not attempted";
  if (al.status === "ok") {
    const total =
      (al.data.pendingTasks?.length ?? 0) +
      (al.data.runningTasks?.length ?? 0) +
      (al.data.finalizedTasks?.length ?? 0) +
      (al.data.inErrorTasks?.length ?? 0);
    return `GET /dataspace/activity-logs/:id → 200 OK (${total} task${total === 1 ? "" : "s"} tracked)`;
  }
  return "Activity log fetch failed";
}

function attestationDetail(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped";
  const a = twin.attestation;
  if (!a) return "Not attempted";
  if (a.status === "ok") return `POST /attestation → 201 Created`;
  return "Attestation create failed";
}

function credentialDetail(twin: TwinForwardSummary): string {
  if (!twin.configured) return "Skipped";
  const c = twin.credential;
  if (!c) return "Not attempted (TWIN_NODE_ADMIN_DID not set)";
  if (c.status === "ok") {
    const verb = c.data.verificationMethodAlreadyExisted ? "reused" : "created";
    return `Verification method ${verb} → POST /identity/<DID>/verifiable-credential/<vmId> → 200 OK`;
  }
  return "VC issuance failed";
}

function CredentialSummary({ data }: { data: VerifiableCredentialData }) {
  const vc = data.verifiableCredential;
  const proof = (vc.proof as Record<string, unknown> | undefined) ?? {};
  const types = Array.isArray(vc.type) ? (vc.type as string[]).join(", ") : String(vc.type ?? "");
  const cryptosuite = String(proof.cryptosuite ?? "—");
  const verificationMethod = String(proof.verificationMethod ?? "—");
  const issuer = String(vc.issuer ?? "");
  const issuerObjectId = didToObjectId(issuer);
  return (
    <div className="space-y-2">
      <div>
        <div className="text-xs font-medium text-neutral-500">Issuer DID</div>
        <div className="mt-1 break-all font-mono text-xs">{issuer || "—"}</div>
        {issuerObjectId && (
          <ExplorerLink
            objectId={issuerObjectId}
            label="View issuer DID on IOTA Rebased Explorer"
          />
        )}
      </div>
      <KV label="Credential id" value={String(vc.id ?? "—")} />
      <div>
        <div className="text-xs font-medium text-neutral-500">Types</div>
        <div className="mt-1 font-mono text-xs">{types}</div>
      </div>
      <div>
        <div className="text-xs font-medium text-neutral-500">Proof</div>
        <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
          <dt className="text-neutral-700">cryptosuite:</dt>
          <dd>{cryptosuite}</dd>
          <dt className="text-neutral-700">verificationMethod:</dt>
          <dd className="break-all">{verificationMethod}</dd>
        </dl>
      </div>
      <div>
        <div className="text-xs font-medium text-neutral-500">JWT (preview)</div>
        <pre className="mt-1 overflow-x-auto rounded bg-neutral-50 p-2 font-mono text-[11px]">
          {data.jwt.length > 220 ? `${data.jwt.slice(0, 220)}…` : data.jwt}
        </pre>
      </div>
    </div>
  );
}

function AttestationSummary({ attestationId }: { attestationId: string }) {
  const objectId = attestationUrnToObjectId(attestationId);
  return (
    <div className="space-y-2">
      <KV label="Attestation URN" value={attestationId} />
      {objectId && (
        <ExplorerLink
          objectId={objectId}
          label="View attestation NFT on IOTA Rebased Explorer"
        />
      )}
    </div>
  );
}

function ExplorerLink({
  objectId,
  label,
}: {
  objectId: string;
  label: string;
}) {
  return (
    <a
      href={explorerObjectUrl(objectId)}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
    >
      <span>↗</span>
      <span>{label}</span>
      <span className="font-mono text-[10px] text-neutral-500">
        ({objectId.slice(0, 10)}…)
      </span>
    </a>
  );
}
