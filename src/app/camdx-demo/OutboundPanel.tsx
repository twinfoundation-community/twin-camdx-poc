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
    setLoading(true);
    setError(null);
    setResult(null);
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
    <section className="rounded-xl border border-neutral-200 bg-white p-6">
      <header className="mb-4">
        <h2 className="text-lg font-semibold">Outbound</h2>
        <p className="text-sm text-neutral-600">
          TWIN → CamDX. Our adaptor calls an X-Road REST endpoint to prove wire
          compatibility with the protocol Cambodia&apos;s data exchange layer
          uses.
        </p>
      </header>

      <button
        type="button"
        onClick={call}
        disabled={loading}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {loading ? "Calling…" : "Call X-Road service"}
      </button>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 space-y-4 text-sm">
          <WireBlock label="Request" status={result.request.method}>
            <KV label="URL" value={result.request.url} mono />
            <Headers headers={result.request.headers} />
          </WireBlock>
          <WireBlock
            label="Response"
            status={`${result.response.status} ${result.response.statusText}`}
          >
            <Headers headers={result.response.headers} highlight="x-road-" />
            <KV
              label="Body"
              value={
                typeof result.response.body === "string"
                  ? result.response.body
                  : JSON.stringify(result.response.body, null, 2)
              }
              mono
              preformatted
            />
          </WireBlock>
        </div>
      )}
    </section>
  );
}

function WireBlock({
  label,
  status,
  children,
}: {
  label: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200">
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-700">
          {label}
        </span>
        <span className="font-mono text-xs text-neutral-600">{status}</span>
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  );
}

function KV({
  label,
  value,
  mono,
  preformatted,
}: {
  label: string;
  value: string;
  mono?: boolean;
  preformatted?: boolean;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-500">{label}</div>
      {preformatted ? (
        <pre className="mt-1 overflow-x-auto rounded bg-neutral-50 p-2 text-xs">
          {value}
        </pre>
      ) : (
        <div className={mono ? "mt-1 break-all font-mono text-xs" : "mt-1"}>
          {value}
        </div>
      )}
    </div>
  );
}

function Headers({
  headers,
  highlight,
}: {
  headers: Record<string, string>;
  highlight?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-500">Headers</div>
      <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 font-mono text-xs">
        {Object.entries(headers).map(([k, v]) => {
          const isXRoad = highlight && k.toLowerCase().startsWith(highlight);
          return (
            <div key={k} className="contents">
              <dt
                className={
                  isXRoad ? "text-emerald-700" : "text-neutral-700"
                }
              >
                {k}:
              </dt>
              <dd className="break-all text-neutral-900">{v}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
