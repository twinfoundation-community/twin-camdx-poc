import { InboundPanel } from "./InboundPanel";
import { OutboundPanel } from "./OutboundPanel";

export const dynamic = "force-dynamic";

export default function CamdxDemoPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">
          CamDX ↔ TWIN Connector
        </h1>
        <p className="mt-2 text-neutral-600">
          Bidirectional interoperability demo: TWIN can both call CamDX services
          and receive records from CamDX via the X-Road protocol.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <OutboundPanel />
        <InboundPanel />
      </div>

      <footer className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
        <strong>Demo caveats.</strong>{" "}
        <strong>Outbound</strong> calls the public X-Road Playground using its
        real registered <code className="rounded bg-amber-100 px-1">PLAYGROUND/COM/1234567-8/TestClient</code>{" "}
        subsystem — the X-Road wire is real, not mocked.{" "}
        <strong>Inbound</strong> uses a CamDX-side simulator whose{" "}
        <code className="rounded bg-amber-100 px-1">X-Road-Client</code> identifier
        is fabricated (no Cambodian TWIN subsystem is registered yet — that&apos;s
        procedural, not technical). Real SS-to-SS mTLS is not modelled because
        we don&apos;t operate an X-Road security server ourselves; we call the
        Playground&apos;s consumer SS REST gateway directly. The vaccination
        record shape is illustrative, not derived from a published Cambodian MoH
        contract. The cryptographic artefacts in the timeline — the W3C VC, the
        on-chain attestation NFT — are real and verifiable on the linked IOTA
        Rebased Explorer.{" "}
        See <code className="rounded bg-amber-100 px-1">CAMDX_POC.md</code> for
        the full runbook.
      </footer>
    </main>
  );
}
