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
    // Clear any prior state immediately so the click feels real.
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
        <span className="label">Outbound · TWIN → CamDX</span>
        <span
          className="status-pill"
          data-state={result ? "ok" : error ? "error" : "skipped"}
        >
          {result ? "Executed" : error ? "Failed" : "Ready"}
        </span>
      </div>

      <div className="mt-3">
        <span className="channel" data-kind="live">
          Live
          <span className="detail">public X-Road Playground</span>
        </span>
      </div>

      <h2 className="mt-4 font-display text-[34px] leading-[1.1] tracking-[-0.01em] text-ink">
        TWIN initiates an X-Road call.
      </h2>
      <p className="mt-3 max-w-[42ch] text-[14px] leading-[1.6] text-ink-soft">
        Our adaptor opens an X-Road REST gateway request to the public
        Playground using the same protocol Cambodia uses.
      </p>

      <div className="mt-7">
        <button
          type="button"
          onClick={call}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <span className="block h-2.5 w-2.5 animate-pulse rounded-full bg-ochre" />
              Calling…
            </>
          ) : result ? (
            "Run the call again"
          ) : (
            "Execute X-Road call"
          )}
        </button>
      </div>

      {loading && (
        <div className="mt-6 border-l-2 border-ochre bg-paper-tint p-4 text-[13px] leading-[1.6] text-ink-soft">
          <span className="label" style={{ color: "var(--color-ochre)" }}>
            Working
          </span>
          <p className="mt-1 text-ink">Opening the X-Road gateway.</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-7 border-l-2 border-brick bg-paper-tint p-4 text-[13px] text-brick"
        >
          <span className="label" style={{ color: "var(--color-brick)" }}>
            Error
          </span>
          <p className="mt-1 font-mono text-[12px]">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <Exhibit
            title="Outgoing wire"
            badge={result.request.method}
            badgeTone="navy"
          >
            <KVRow label="URL" value={result.request.url} />
            <HeaderTable headers={result.request.headers} />
          </Exhibit>

          <Exhibit
            title="Returning wire"
            badge={`${result.response.status} ${result.response.statusText}`}
            badgeTone={result.response.status < 300 ? "moss" : "brick"}
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
  badgeTone: "navy" | "moss" | "brick";
  children: React.ReactNode;
}) {
  const colorVar = {
    navy: "var(--color-navy)",
    moss: "var(--color-moss)",
    brick: "var(--color-brick)",
  }[badgeTone];
  return (
    <div className="exhibit">
      <div className="exhibit-head">
        <span className="label">{title}</span>
        <span
          className="font-mono text-[11px] font-semibold tracking-wider"
          style={{ color: colorVar }}
        >
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
      <div className="label">{label}</div>
      <div
        className="mt-1.5 font-mono text-[12px] leading-[1.55] text-ink"
        style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}
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
      <div className="label">Headers</div>
      <dl className="mt-1.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1 font-mono text-[12px]">
        {Object.entries(headers).map(([k, v]) => {
          const isEmph =
            emphasise && k.toLowerCase().startsWith(emphasise);
          return (
            <div key={k} className="contents">
              <dt
                className="tnum"
                style={{
                  color: isEmph ? "var(--color-ochre)" : "var(--color-ink-soft)",
                  fontWeight: isEmph ? 600 : 400,
                }}
              >
                {k}
              </dt>
              <dd
                className="min-w-0 text-ink"
                style={{ overflowWrap: "anywhere", wordBreak: "break-all" }}
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
      <div className="label">Body</div>
      <pre className="mt-1.5 w-full max-w-full max-h-[260px] overflow-auto border border-rule-soft bg-paper p-3 font-mono text-[11.5px] leading-[1.55] text-ink">
        {preview}
      </pre>
    </div>
  );
}
