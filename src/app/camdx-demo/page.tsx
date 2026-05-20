import { InboundPanel } from "./InboundPanel";
import { OutboundPanel } from "./OutboundPanel";

export const dynamic = "force-dynamic";

const TODAY = new Date().toLocaleDateString("en-GB", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export default function CamdxDemoPage() {
  return (
    <main className="mx-auto max-w-[1280px] px-10 py-12 fade-in-stack">
      {/* Letterhead */}
      <div style={{ ["--d" as string]: 0 }}>
        <div className="flex items-baseline justify-between border-b border-rule pb-3 text-[11px] tracking-[0.18em] uppercase text-ink-soft tnum">
          <span>Technical Brief · CamDX × TWIN</span>
          <span>
            Ref. 2026/05 — Prepared {TODAY}
          </span>
        </div>
      </div>

      {/* Title block */}
      <header
        className="mt-10 grid grid-cols-12 gap-10"
        style={{ ["--d" as string]: 1 }}
      >
        <div className="col-span-12 md:col-span-9">
          <span className="cartouche">Ministry of Commerce Briefing</span>
          <h1 className="mt-6 font-display text-[64px] leading-[1.02] tracking-[-0.015em] text-ink">
            Connecting <em className="font-display italic text-ochre">CamDX</em>{" "}
            to a TWIN node.
          </h1>
          <p className="mt-6 max-w-[58ch] font-display text-[20px] italic leading-[1.45] text-ink-soft">
            A bidirectional proof of concept demonstrating that Cambodia&apos;s
            X-Road v7.7 data exchange layer can interoperate with TWIN — passing
            real data, issuing verifiable credentials, and anchoring records
            on-chain — using existing TWIN infrastructure and published X-Road
            protocols.
          </p>
        </div>
        <aside className="col-span-12 md:col-span-3 md:border-l md:border-rule md:pl-6">
          <dl className="space-y-4 text-[12px] leading-relaxed">
            <Meta term="Subject">
              TWIN ↔ CamDX (X-Road v7.7) bidirectional connector
            </Meta>
            <Meta term="Audience">
              Ministry of Commerce — Junior Minister, Technical Advisor
            </Meta>
            <Meta term="Status">Working prototype, hosted</Meta>
            <Meta term="Repository">
              <a
                className="ext-link"
                href="https://github.com/twinfoundation-community/twin-camdx-poc"
                target="_blank"
                rel="noopener noreferrer"
              >
                twin-camdx-poc <span className="arrow">↗</span>
              </a>
            </Meta>
          </dl>
        </aside>
      </header>

      <div
        className="mt-14 rule-ornament"
        style={{ ["--d" as string]: 2 }}
        aria-hidden
      >
        <span className="mark" />
      </div>

      {/* Body — asymmetric two columns: outbound 5, inbound 7.
          `min-w-0` is load-bearing: without it, the grid track defaults to
          min-content sizing and any unbreakable string (JWT, URN, JSON line)
          blows the column out past its 5/7 allocation. */}
      <section className="mt-14 grid grid-cols-12 gap-12">
        <div
          className="col-span-12 min-w-0 lg:col-span-5"
          style={{ ["--d" as string]: 3 }}
        >
          <OutboundPanel />
        </div>
        <div
          className="col-span-12 min-w-0 lg:col-span-7"
          style={{ ["--d" as string]: 4 }}
        >
          <InboundPanel />
        </div>
      </section>

      {/* Notes — the caveats, framed as proper editorial footnotes */}
      <footer
        className="mt-20 border-t border-rule pt-8"
        style={{ ["--d" as string]: 5 }}
      >
        <span className="label">Notes &amp; provenance</span>
        <ol className="mt-5 space-y-3 max-w-[78ch] text-[13px] leading-[1.65] text-ink-soft">
          <Note num="i">
            <strong className="text-ink">Outbound</strong> calls the public
            X-Road Playground using its real, pre-registered
            <code className="font-mono"> PLAYGROUND/COM/1234567-8/TestClient </code>
            subsystem. The X-Road wire is real, not mocked — every response
            carries a provider-attached
            <code className="font-mono"> x-road-request-hash </code> per spec.
          </Note>
          <Note num="ii">
            <strong className="text-ink">Inbound</strong> uses a CamDX-side
            simulator whose
            <code className="font-mono"> X-Road-Client </code> identifier is
            fabricated: no Cambodian TWIN subsystem is yet registered on a real
            X-Road central server. That step is procedural, not technical, and
            would happen as part of an implementation engagement.
          </Note>
          <Note num="iii">
            Real SS-to-SS mTLS is not modelled because we do not operate an
            X-Road security server ourselves. We call the Playground&apos;s
            consumer SS REST gateway directly, exactly as a registered
            subsystem would.
          </Note>
          <Note num="iv">
            The illustrative vaccination record is not derived from a published
            Cambodian Ministry of Health schema. The cryptographic artefacts
            generated downstream — the W3C Verifiable Credential, the on-chain
            attestation NFT — are real and independently verifiable on the
            linked IOTA Rebased Explorer.
          </Note>
          <Note num="v">
            For the full runbook, see
            <code className="font-mono"> CAMDX_POC.md </code>
            in the repository.
          </Note>
        </ol>
      </footer>
    </main>
  );
}

function Meta({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="label">{term}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}

function Note({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] items-baseline gap-3">
      <span className="font-display italic text-ochre tnum">{num}.</span>
      <span>{children}</span>
    </li>
  );
}
