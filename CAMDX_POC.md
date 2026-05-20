# CamDX ↔ TWIN Connector PoC — runbook

Bidirectional adaptor demonstrating that a TWIN node can interoperate with
Cambodia's CamDX (X-Road v7.7) national data exchange layer. Built for a
Ministry of Commerce briefing.

## What this proves

| Claim                                                                              | Evidence                                                                                              |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Our adaptor speaks the X-Road REST message protocol correctly                      | Outbound call to the public X-Road Playground returns HTTP 200 with `x-road-request-hash` from the provider SS |
| The adaptor can be addressed by a CamDX-side caller using the X-Road envelope      | Inbound handler accepts an X-Road envelope from the simulator and produces a typed W3C activity      |
| Records arriving from CamDX can be expressed in TWIN's canonical ingestion shape   | The translated payload is a valid Activity Streams `Add` activity ready for `POST /dataspace/notify` on Kitsune |
| The data-space-connector's `/dataspace/notify` is the right TWIN-side ingestion point | Confirmed against `data-space-connector/packages/data-space-connector-service/src/dataSpaceConnectorRoutes.ts` (route accepts any `IActivity`, `object` slot is open) and confirmed live on Kitsune by Rodrigo (`TWIN_DATASPACE_ENABLED=true`, `TWIN_DATASPACE_DATA_PLANE_PATH=dataspace/entities`) |

## What this does NOT prove

| Out of scope                                            | Why                                                                                                    | Path to address                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Real subsystem registration on the Cambodian SS         | No registered subsystem exists for "TWIN" on any X-Road central server; we use the Playground's `TestClient` | Procedural — register a TWIN subsystem with the Cambodian SS once an engagement begins                |
| Real SS-to-SS mTLS between consumer and provider SSes   | The simulator stands in for a real Cambodian security server                                            | Spin up a real CamDX Docker stack (out of scope; ~4-5 additional engineering days)                          |
| Entity query via `GET /dataspace/entities`              | Requires `consumerPid` — a process identifier issued by `POST /dataspace-control-plane/transfers/request` per the Dataspace Protocol. That's a multi-step negotiation (request → start → complete) just to read an entity back. The activity log URN already proves ingestion, so we skip this dance for the demo | Implement the Dataspace Protocol consumer flow if MoC asks (Phase 3) |
| A canonical Cambodian MoH data schema                   | The vaccination record shape is illustrative, not derived from a published Cambodian government contract | Align with a real MoH schema once MoC provides one or once we engage their technical advisor              |

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  camdx-poc  (Next.js, deployed to Vercel)                      │
│                                                                 │
│  /camdx-demo            ← UI: two panels (outbound + inbound)  │
│  /api/camdx/outbound    ← POST: triggers an X-Road REST call   │
│  /api/camdx/inbound     ← POST: receives X-Road envelope       │
│                           GET:  returns last received record   │
│                                                                 │
│  lib/xroad/client.ts       — X-Road REST client (server-side)  │
│  lib/camdx/translator.ts   — envelope → W3C Activity Streams   │
│  tools/camdx-simulator.mjs — mock CamDX security server        │
└──────────────────┬─────────────────────────────────┬───────────┘
                   │                                  │
           OUTBOUND │                                 │ INBOUND
                   ▼                                  ▲
        ┌────────────────────────┐         ┌──────────────────┐
        │ X-Road Playground       │         │ camdx-simulator   │
        │ testcomss01.playground  │         │ (Node script)    │
        │   .x-road.systems       │         │ Sends X-Road     │
        │ Pre-registered          │         │ envelope with    │
        │  TestClient subsystem   │         │ fabricated       │
        │  + TestService          │         │ X-Road-Client    │
        └────────────────────────┘         └──────────────────┘
```

## Run locally

```sh
cp .env.local.example .env.local
npm install
npm run dev                 # http://localhost:3000
```

Open `http://localhost:3000` (auto-redirects to `/camdx-demo`).

### Outbound demo

Click **Call X-Road service** in the left panel. The UI shows:

- Our outgoing request URL: `http://testcomss01.playground.x-road.systems/r1/PLAYGROUND/GOV/8765432-1/TestService/listMethods`
- Our outgoing headers (highlight the `X-Road-Client` and `X-Road-Id`)
- The Playground's response headers (highlight `x-road-request-hash`, `x-road-service`, `x-road-id` — these are emitted by the provider's SS per spec)
- The response body — the list of REST/OpenAPI services advertised by the test subsystem

### Inbound demo

In another shell:

```sh
npm run simulator
```

The simulator builds a credible X-Road envelope and POSTs an illustrative citizen vaccination record to `/api/camdx/inbound`. Click **Refresh** on the right panel of the UI to see a six-stage timeline, each card colour-coded by status:

1. **Envelope received** — X-Road headers parsed (`X-Road-Client`, `X-Road-Service`, `X-Road-Id`, `X-Road-UserId`)
2. **Translated to W3C Activity Streams** — wrapped as an `Add` activity, with `@type` mirrored to `type` so the Activity Streams validator accepts it
3. **Forwarded to Kitsune `/dataspace/notify`** — `POST` returns 201 Created with an `urn:x-activity-log:...` URN in the Location header
4. **Activity log status** — `GET /dataspace/activity-logs/:id` returns the ingestion record (generator DID + task counts)
5. **Signed as W3C Verifiable Credential** — first call ensures an `assertionMethod` key (`camdx-demo`) exists on the admin DID via `POST /identity/<DID>/verification-method`, then `POST /identity/<DID>/verifiable-credential/<vmId>` issues a real VC with `DataIntegrityProof` (`eddsa-jcs-2022` cryptosuite) signed by the new key — returned as both a JSON-LD document and a JWT
6. **Anchored as attestation** — `POST /attestation` returns 201 Created with an `attestation:nft:...` URN; the record is now anchored as an NFT on IOTA testnet via `@twin.org/nft-connector-iota`

## Demo script (5 minutes, minister briefing)

1. **Open `/camdx-demo`** on the deployed Vercel URL. One-sentence framing: "Bidirectional integration between TWIN and Cambodia's CamDX."
2. **Outbound:** click the button. Walk through:
   - "This is the REST URL our adaptor calls — note the `/r1/` X-Road gateway prefix."
   - "Our service identifier in `X-Road-Client` matches X-Road's `instance/class/member/subsystem` shape."
   - "The response includes `x-road-request-hash` — that's the provider's security server cryptographically attesting to the message contents per the X-Road spec. It's how we know we're talking real X-Road, not a mock."
3. **Inbound:** trigger the simulator (live in a terminal, or via a button on a future iteration). Walk through:
   - "When a Cambodian system sends us a record over X-Road, we receive the envelope here."
   - "Our adaptor translates that into TWIN's canonical W3C Activity Streams ingestion shape."
   - "From there, the standard TWIN data-space-connector handles the rest — identity binding, indexing, queryability."
4. **Caveats:** be honest about what's mock (the simulator's identity, the SS-to-SS mTLS), what's real (the X-Road wire protocol, the W3C standards), and what's the next step (registering a real Cambodian subsystem; enabling the connector package on Kitsune).

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import in Vercel — framework auto-detects Next.js.
3. Set environment variables (Production + Preview):
   - `XROAD_PLAYGROUND_BASE_URL`, `XROAD_PLAYGROUND_AUTH_USER`, `XROAD_PLAYGROUND_AUTH_PASS`
   - `XROAD_CLIENT_IDENTIFIER`, `XROAD_SERVICE_IDENTIFIER`
   - (Phase 2, once Rodrigo enables the connector) `TWIN_NODE_URL`, `TWIN_NODE_SERVICE_EMAIL`, `TWIN_NODE_SERVICE_PASSWORD`
4. Deploy. Share the URL.

The simulator runs locally only — for a remote demo, either show it via screen share, or wrap it as a Vercel cron / API route in a follow-up.

## Phase 2 — forwarding to Kitsune (shipped 2026-05-20)

Implemented: server-side Kitsune client (`src/lib/twin/kitsune-client.ts`) handles JWT login (`POST /authentication/login`), caches the token with expiry, refreshes on 401. The inbound handler chains four calls against Kitsune:

1. `POST /dataspace/notify` — forwards the `IActivity`, captures `urn:x-activity-log:...` from the Location header
2. `GET /dataspace/activity-logs/:id` — reads the ingestion record after a brief settle interval
3. `POST /identity/<DID>/verification-method` (idempotent) → `POST /identity/<DID>/verifiable-credential/<vmId>` — issues a real signed W3C VC for the citizen with `DataIntegrityProof` (`eddsa-jcs-2022`)
4. `POST /attestation` — anchors the citizen JSON-LD payload as an on-chain NFT, captures `attestation:nft:...` from the Location header

All four are visible on the demo page as stages 3, 4, 5, 6 of the inbound timeline.

### Best-practice alignment

Per the canonical TWIN consumption pattern (see `identity-mvp/lib/services/identity-management-client.ts`), the adaptor uses the typed `@twin.org/*-rest-client` packages — `IdentityRestClient`, `AttestationRestClient`, `DataSpaceConnectorRestClient` — instantiated per call with `{ endpoint, headers: { Authorization: "Bearer <jwt>" } }`. Login stays as raw fetch (no auth-rest-client).

Known upstream bug, handled with a one-method subclass: `@twin.org/identity-rest-client@0.0.3-next.25`'s `verifiableCredentialCreate` emits the URL `/:identity/verifiable-credential` and drops the trailing `/:verificationMethodId` segment. The server route requires it (the neighbouring `verifiableCredentialRevoke` / `verifiableCredentialUnrevoke` rest-client methods correctly include `:revocationIndex`, so the issue is isolated to one method). `src/lib/twin/patched-identity-rest-client.ts` is a single-method override following the same convention `identity-mvp` uses in `lib/services/identity-management-client.ts` for its PATCH method overrides. Delete the file when the upstream emits the correct URL.

### Route discoveries that mattered

- **`POST /identity/<DID>/proof/create` doesn't exist** — the actual path is `/identity/:identity/proof/:verificationMethodId`. My first attempt at VC issuance failed because I was probing the wrong path name.
- **`POST /identity/` (DID creation) returns 404 on Kitsune.** The playground spec lists it but the live Kitsune node doesn't expose it. Workaround: add a verification method to the existing admin DID via `POST /identity/<adminDID>/verification-method`, then sign using that VM.
- **Admin DID starts with zero verification methods.** Resolving the DID document only returned a `RevocationBitmap2022` service. Adding the `camdx-demo` assertion method to the admin DID populates the `assertionMethod` array and unlocks both `verifiable-credential` and `proof` routes.

### What's still deliberately skipped

- **Entity query via `GET /dataspace/entities`** — requires a `consumerPid` produced by a Dataspace Protocol transfer negotiation: `POST /dataspace-control-plane/transfers/request` → `/start` → `/complete`. That's a meaningful multi-step dance just to read back what we just wrote. The activity log URN already proves ingestion, the VC and attestation prove cryptographic binding — entity query is a Phase 3 enhancement if MoC specifically asks.

## File-level map

| File                                                  | Purpose                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/env.ts`                                       | Zod-validated environment access                         |
| `src/lib/xroad/types.ts`                               | X-Road message protocol TypeScript types                 |
| `src/lib/xroad/client.ts`                              | Server-side X-Road REST client (fetch + headers)         |
| `src/lib/camdx/types.ts`                               | Local IActivity shape (mirrors `@twin.org/standards-w3c-activity-streams`) |
| `src/lib/camdx/translator.ts`                          | Pure function: envelope + payload → `IActivity`          |
| `src/lib/camdx/samples/citizen-vaccination.ts`         | Illustrative payload (not from real MoH contract)        |
| `src/lib/twin/kitsune-client.ts`                       | JWT auth + typed `@twin.org/*-rest-client` wrappers (notify, activity-log, verification-method, VC create, attestation) following identity-mvp's pattern |
| `src/app/api/camdx/outbound/route.ts`                  | Triggers an X-Road REST call                             |
| `src/app/api/camdx/inbound/route.ts`                   | Receives X-Road envelope, translates, pipes through Kitsune |
| `src/app/camdx-demo/page.tsx`                          | Two-panel demo UI                                        |
| `src/app/camdx-demo/OutboundPanel.tsx`                 | Client component for the outbound flow                   |
| `src/app/camdx-demo/InboundPanel.tsx`                  | Client component — five-stage inbound timeline           |
| `tools/camdx-simulator.mjs`                            | Standalone mock CamDX security server                    |
