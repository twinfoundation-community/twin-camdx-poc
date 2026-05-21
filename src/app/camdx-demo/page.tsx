import { InboundPanel } from "./InboundPanel";
import { OutboundPanel } from "./OutboundPanel";

export const dynamic = "force-dynamic";

export default function CamdxDemoPage() {
  return (
    <main className="mx-auto max-w-[1200px] px-10 py-20 fade-in-stack">
      {/* Title block */}
      <header style={{ ["--d" as string]: 0 }}>
        <h1 className="display">
          Connecting <span className="emphasis">CamDX</span> to a{" "}
          <span className="emphasis">TWIN</span> node.
        </h1>
        <p className="body-lg mt-6 max-w-[60ch]" style={{ color: "var(--color-slate-light)" }}>
          Two directions, demonstrated independently. TWIN → CamDX calls the
          public X-Road Playground. CamDX → TWIN is delivered by a local
          simulator into a live TWIN pipeline that issues a real verifiable
          credential and anchors an NFT on IOTA.
        </p>
      </header>

      {/* Body — asymmetric two columns: outbound 5, inbound 7 */}
      <section
        className="mt-20 grid grid-cols-12 gap-10"
        style={{ ["--d" as string]: 1 }}
      >
        <div className="col-span-12 min-w-0 lg:col-span-5">
          <OutboundPanel />
        </div>
        <div className="col-span-12 min-w-0 lg:col-span-7">
          <InboundPanel />
        </div>
      </section>

      <footer
        className="mt-24 border-t pt-10"
        style={{
          ["--d" as string]: 2,
          borderColor: "var(--color-cloud-light)",
        }}
      >
        <span className="eyebrow">Important context</span>
        <ol className="mt-6 space-y-4 max-w-[78ch] body-sm" style={{ color: "var(--color-slate-light)" }}>
          <Note num="1">
            <strong style={{ color: "var(--color-slate-dark)" }}>
              Outbound
            </strong>{" "}
            uses a registered Playground subsystem. Responses carry a
            provider-attached{" "}
            <code className="font-mono text-[12px]" style={{ color: "var(--color-slate-dark)" }}>
              x-road-request-hash
            </code>{" "}
            per spec.
          </Note>
          <Note num="2">
            <strong style={{ color: "var(--color-slate-dark)" }}>
              Inbound
            </strong>{" "}
            simulator&apos;s{" "}
            <code className="font-mono text-[12px]" style={{ color: "var(--color-slate-dark)" }}>
              X-Road-Client
            </code>{" "}
            is fabricated. No Cambodian TWIN subsystem is registered on a real
            X-Road central server yet — procedural, not technical.
          </Note>
          <Note num="3">
            SS-to-SS mTLS is not modelled. We don&apos;t operate an X-Road
            security server, so we call the Playground&apos;s consumer SS REST
            gateway directly.
          </Note>
          <Note num="4">
            The consignment is an illustrative export declaration (Cambodian
            milled rice → Singapore, HS 1006.30) in UN/CEFACT D23B — the same
            model TWIN&apos;s UK supply-chain pilot uses. The VC and the
            attestation NFT are real and verifiable on the linked explorer.
          </Note>
          <Note num="5">
            Source and full runbook on{" "}
            <a
              className="link"
              href="https://github.com/twinfoundation-community/twin-camdx-poc"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            .
          </Note>
        </ol>
      </footer>
    </main>
  );
}

function Note({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] items-baseline gap-3">
      <span className="font-mono text-[12px] tnum" style={{ color: "var(--color-cloud-dark)" }}>
        {num.padStart(2, "0")}
      </span>
      <span>{children}</span>
    </li>
  );
}
