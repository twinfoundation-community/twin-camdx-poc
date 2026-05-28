# CamDX ↔ TWIN connector PoC

Bidirectional adaptor connecting Cambodia's CamDX (X-Road v7.7) to a TWIN node.
Built to demonstrate technical feasibility to Cambodia's Ministry of Commerce
ahead of a ministerial briefing.

- **Outbound** (TWIN → CamDX): server-side X-Road REST client calling the public
  X-Road Playground. Proves wire compatibility with the protocol CamDX uses.
- **Inbound** (CamDX → TWIN): mock CamDX simulator posts an X-Road REST envelope
  to our handler, which translates it into a W3C Activity Streams `Add` activity
  ready to forward to a hosted Kitsune TWIN node's `POST /dataspace/inbox`.

The audience-facing demo lives at `/camdx-demo`.

For caveats, deploy notes, and demo script see [CAMDX_POC.md](./CAMDX_POC.md).

## Quick start

```sh
cp .env.local.example .env.local   # fill in TWIN_NODE_SERVICE_PASSWORD
npm install
npm run dev                         # http://localhost:3000
npm run simulator                   # in another shell: triggers an inbound call
```
