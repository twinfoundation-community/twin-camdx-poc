#!/usr/bin/env node
// CamDX simulator — emits a credible X-Road REST envelope and POSTs it to our
// inbound handler. Stands in for a real Cambodian security server while the
// PoC runs against the public X-Road Playground.
//
// IMPORTANT: the X-Road-Client identifier used here is fabricated. No real
// subsystem is registered with any X-Road central server. The simulator proves
// the wire shape, not subsystem registration or SS-to-SS mTLS.

import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TARGET_URL =
  process.env.SIMULATOR_TARGET_URL ?? "http://localhost:3000/api/camdx/inbound";
const PROVIDER_IDENTIFIER =
  process.env.SIMULATOR_PROVIDER_IDENTIFIER ??
  "CAMDX/GOV/MOC/CUSTOMS-REGISTRY/consignment-declaration";
const CONSUMER_IDENTIFIER =
  process.env.SIMULATOR_CONSUMER_IDENTIFIER ?? "CAMDX/GOV/MOC/CUSTOMS-EXPORT";

function loadSamplePayload() {
  // Inline a sample so the script has no TypeScript dep. Mirrors
  // src/lib/camdx/samples/customs-consignment.ts (UN/CEFACT D23B Consignment)
  // — matches the canonical `data-space-connector-test-app` activity filter
  // (objectType: https://vocabulary.uncefact.org/Consignment), so once the
  // test app is registered as a Kitsune extension, this payload triggers
  // the full task lifecycle on stage 04.
  const candidate = resolve(
    __dirname,
    "..",
    "src",
    "lib",
    "camdx",
    "samples",
    "customs-consignment.json",
  );
  try {
    return JSON.parse(readFileSync(candidate, "utf8"));
  } catch {
    return {
      "@context": "https://vocabulary.uncefact.org/unece-context-D23B.jsonld",
      "@type": "Consignment",
      globalId: "urn:ucr:24KH-EX-251205-00342171",
      consignor: {
        "@type": "TradeParty",
        name: "Phnom Penh Export Trading Co., Ltd.",
        id: "urn:kh-bizid:0042-EXP-2024-PNH",
        postalAddress: {
          "@type": "TradeAddress",
          cityName: "Phnom Penh",
          countryId: "unece:CountryId#KH",
        },
      },
      consignee: {
        "@type": "TradeParty",
        name: "Singapore Distribution Pte. Ltd.",
        postalAddress: {
          "@type": "TradeAddress",
          cityName: "Singapore",
          countryId: "unece:CountryId#SG",
        },
      },
      loadingLocation: {
        "@type": "TradeLocation",
        id: "unece:LocationCode#KHPNH",
        name: "Port of Phnom Penh",
      },
      unloadingLocation: {
        "@type": "TradeLocation",
        id: "unece:LocationCode#SGSIN",
        name: "Port of Singapore",
      },
      destinationCountry: {
        "@type": "Country",
        countryId: "unece:CountryId#SG",
      },
      goodsItem: [
        {
          "@type": "ConsignmentItem",
          sequenceNumber: 1,
          grossMass: { value: 18500, unitCode: "KGM" },
          packageCount: { value: 740, unitCode: "BG" },
          tradeCommodity: {
            "@type": "Commodity",
            cargoDescription: "Cambodian fragrant jasmine rice (milled)",
            classificationCode: "1006.30",
            classificationSystem: "HS",
          },
        },
      ],
      transportContractDocument: {
        "@type": "TransportDocument",
        documentTypeCode: "BL",
        issueDate: "2026-05-15",
      },
      customsDeclaration: {
        "@type": "Document",
        id: "KH-EX-2026-00342171",
        documentTypeCode: "830",
        issueDate: "2026-05-18",
      },
      recordedAt: "2026-05-20T08:30:00+07:00",
    };
  }
}

function computeBodyDigest(body) {
  // SHA-512 of the request body — a real Cambodian provider backend can verify
  // this matches what its security server received. Included as
  // `X-Road-Body-Digest` (non-standard but documented in our runbook). The
  // actual `X-Road-Request-Hash` per spec is a RESPONSE header set by the
  // provider's SS, not a request header, so we don't fabricate one here.
  return createHash("sha512").update(body).digest("base64");
}

async function main() {
  const payload = loadSamplePayload();
  const body = JSON.stringify(payload);
  const messageId = randomUUID();
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Road-Client": CONSUMER_IDENTIFIER,
    "X-Road-Service": PROVIDER_IDENTIFIER,
    "X-Road-Id": messageId,
    "X-Road-UserId": "KH-EXPORTER-DEMO",
    "X-Road-Issue": `consignment-${Date.now()}`,
  };
  headers["X-Road-Body-Digest"] = computeBodyDigest(body);

  console.log("→ POST", TARGET_URL);
  console.log("→ Headers:");
  for (const [k, v] of Object.entries(headers)) console.log(`    ${k}: ${v}`);
  console.log("→ Body:", body.slice(0, 200) + (body.length > 200 ? "…" : ""));

  const response = await fetch(TARGET_URL, {
    method: "POST",
    headers,
    body,
  });
  const text = await response.text();

  console.log("\n← Status:", response.status, response.statusText);
  console.log("← Body:");
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }

  if (!response.ok) process.exit(1);
}

main().catch((err) => {
  console.error("Simulator failed:", err);
  process.exit(1);
});
