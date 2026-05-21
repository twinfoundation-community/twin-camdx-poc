"use client";

import { useState } from "react";

interface XRoadResult {
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string | null;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: unknown;
  };
}

export function OutboundPanel() {
  const [result, setResult] = useState<XRoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function call() {
    setResult(null);
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/camdx/outbound", { method: "POST" });
      const data = (await response.json()) as XRoadResult | { error: string };
      if (!response.ok || "error" in data) {
        setError("error" in data ? data.error : `HTTP ${response.status}`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">Outbound · TWIN → CamDX</span>
        <span
          className="status-pill"
          data-state={
            result
              ? "ok"
              : error
                ? "error"
                : loading
                  ? "running"
                  : "skipped"
          }
        >
          {result
            ? "Executed"
            : error
              ? "Failed"
              : loading
                ? "Calling"
                : "Ready"}
        </span>
      </div>

      <div className="mt-3">
        <span className="channel">
          <span className="label">Live</span>
          <span className="detail">public X-Road Playground</span>
        </span>
      </div>

      <h2 className="heading mt-6" style={{ fontSize: 32, lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.012em" }}>
        TWIN initiates an X-Road call.
      </h2>
      <p className="body-sm mt-3 max-w-[42ch]" style={{ color: "var(--color-slate-light)" }}>
        Our adaptor opens an X-Road REST gateway request to the public
        Playground using the same protocol Cambodia uses.
      </p>

      <div className="mt-8">
        <button type="button" onClick={call} disabled={loading} className="btn-primary">
          {loading ? "Calling…" : result ? "Run the call again" : "Execute X-Road call"}
        </button>
      </div>

      {loading && (
        <div className="mt-6">
          <span className="meta-label">Working</span>
          <p className="body-sm mt-1.5" style={{ color: "var(--color-slate-light)" }}>
            Opening the X-Road gateway.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="mt-6">
          <span className="meta-label" style={{ color: "var(--color-clay)" }}>
            Error
          </span>
          <p className="mt-1.5 font-mono text-[12px]" style={{ color: "var(--color-clay)" }}>
            {error}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-10 space-y-6">
          <Exhibit
            title="Outgoing wire"
            badge={result.request.method}
            badgeTone="default"
          >
            <KVRow label="URL" value={result.request.url} />
            <HeaderTable headers={result.request.headers} />
          </Exhibit>

          <Exhibit
            title="Returning wire"
            badge={`${result.response.status} ${result.response.statusText}`}
            badgeTone={result.response.status < 300 ? "default" : "error"}
          >
            <HeaderTable
              headers={result.response.headers}
              emphasise="x-road-"
            />
            <BodyBlock body={result.response.body} />
          </Exhibit>
        </div>
      )}
    </section>
  );
}

function Exhibit({
  title,
  badge,
  badgeTone,
  children,
}: {
  title: string;
  badge: string;
  badgeTone: "default" | "error";
  children: React.ReactNode;
}) {
  const badgeColor =
    badgeTone === "error" ? "var(--color-clay)" : "var(--color-slate-dark)";
  return (
    <div className="exhibit">
      <div className="exhibit-head">
        <span className="meta-label">{title}</span>
        <span className="font-mono text-[11px] font-medium tracking-wider" style={{ color: badgeColor }}>
          {badge}
        </span>
      </div>
      <div className="exhibit-body space-y-5">{children}</div>
    </div>
  );
}

function KVRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="meta-label">{label}</div>
      <div
        className="mt-1.5 font-mono text-[12px] leading-[1.55]"
        style={{ overflowWrap: "anywhere", wordBreak: "break-all", color: "var(--color-slate-dark)" }}
      >
        {value}
      </div>
    </div>
  );
}

function HeaderTable({
  headers,
  emphasise,
}: {
  headers: Record<string, string>;
  emphasise?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="meta-label">Headers</div>
      <dl className="mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1.5 font-mono text-[12px]">
        {Object.entries(headers).map(([k, v]) => {
          const isEmph =
            emphasise && k.toLowerCase().startsWith(emphasise);
          return (
            <div key={k} className="contents">
              <dt
                className="tnum"
                style={{
                  color: isEmph ? "var(--color-slate-dark)" : "var(--color-cloud-dark)",
                  fontWeight: isEmph ? 500 : 400,
                  textDecoration: isEmph ? "underline" : "none",
                  textDecorationThickness: "2px",
                  textUnderlineOffset: "3px",
                }}
              >
                {k}
              </dt>
              <dd
                className="min-w-0"
                style={{ overflowWrap: "anywhere", wordBreak: "break-all", color: "var(--color-slate-dark)" }}
              >
                {v}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function BodyBlock({ body }: { body: unknown }) {
  const text =
    typeof body === "string" ? body : JSON.stringify(body, null, 2);
  const preview = text.length > 1200 ? text.slice(0, 1200) + "\n…" : text;
  return (
    <div className="min-w-0">
      <div className="meta-label">Body</div>
      <pre
        className="mt-1.5 w-full max-w-full max-h-[260px] overflow-auto font-mono text-[11.5px] leading-[1.55] p-3"
        style={{
          background: "var(--color-ivory-medium)",
          color: "var(--color-slate-dark)",
        }}
      >
        {preview}
      </pre>
    </div>
  );
}
