import { InboundPanel } from "./InboundPanel";
import { OutboundPanel } from "./OutboundPanel";

export const dynamic = "force-dynamic";

export default function CamdxDemoPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-10 py-16 fade-in-stack">
      {/* Title block */}
      <header style={{ ["--d" as string]: 0 }}>
        <h1 className="font-display text-[64px] leading-[1.02] tracking-[-0.015em] text-ink">
          Connecting <em className="font-display italic text-ochre">CamDX</em>{" "}
          to a TWIN node.
        </h1>
        <p className="mt-6 max-w-[58ch] font-display text-[20px] italic leading-[1.45] text-ink-soft">
          Two directions, demonstrated independently.{" "}
          <span className="not-italic font-body text-[14px] font-semibold tracking-[0.06em] uppercase text-navy">TWIN → CamDX</span>{" "}
          calls the public X-Road Playground.{" "}
          <span className="not-italic font-body text-[14px] font-semibold tracking-[0.06em] uppercase text-navy">CamDX → TWIN</span>{" "}
          is delivered by a local simulator into a live TWIN pipeline that
          issues a real verifiable credential and anchors an NFT on IOTA.
        </p>
      </header>

      {/* Body — asymmetric two columns: outbound 5, inbound 7 */}
      <section
        className="mt-16 grid grid-cols-12 gap-12"
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
        className="mt-20 border-t border-rule pt-8"
        style={{ ["--d" as string]: 2 }}
      >
        <span className="label">Important context</span>
        <ol className="mt-5 space-y-3 max-w-[78ch] text-[13px] leading-[1.65] text-ink-soft">
          <Note num="1">
            <strong className="text-ink">Outbound</strong> uses a registered
            Playground subsystem. Responses carry a provider-attached
            <code className="font-mono"> x-road-request-hash </code> per spec.
          </Note>
          <Note num="2">
            <strong className="text-ink">Inbound</strong> simulator&apos;s
            <code className="font-mono"> X-Road-Client </code> is fabricated.
            No Cambodian TWIN subsystem is registered on a real X-Road central
            server yet — procedural, not technical.
          </Note>
          <Note num="3">
            SS-to-SS mTLS is not modelled. We don&apos;t operate an X-Road
            security server, so we call the Playground&apos;s consumer SS
            REST gateway directly.
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
              className="ext-link"
              href="https://github.com/twinfoundation-community/twin-camdx-poc"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub <span className="arrow">↗</span>
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
    <li className="grid grid-cols-[1.5rem_1fr] items-baseline gap-3">
      <span className="font-display text-ochre tnum">{num}.</span>
      <span>{children}</span>
    </li>
  );
}
