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
  "CAMDX/GOV/MOH/HEALTH-REGISTRY/citizen-vaccination";
const CONSUMER_IDENTIFIER =
  process.env.SIMULATOR_CONSUMER_IDENTIFIER ?? "DEV/COM/TWIN/CAMDX-POC";

function loadSamplePayload() {
  // Inline a sample so the script has no TypeScript dep. Mirrors
  // src/lib/camdx/samples/citizen-vaccination.ts.
  const candidate = resolve(
    __dirname,
    "..",
    "src",
    "lib",
    "camdx",
    "samples",
    "citizen-vaccination.json",
  );
  try {
    return JSON.parse(readFileSync(candidate, "utf8"));
  } catch {
    return {
      "@context": [
        "https://schema.org",
        {
          vaccinations: "https://schema.org/MedicalProcedure",
          issuedBy: "https://schema.org/issuedBy",
        },
      ],
      "@type": "Person",
      identifier: {
        "@type": "PropertyValue",
        propertyID: "KH-NID",
        value: "120399042X",
      },
      name: "Sok Vannarith",
      birthDate: "1990-03-14",
      nationality: "KH",
      vaccinations: [
        {
          "@type": "MedicalProcedure",
          name: "COVID-19 mRNA vaccine",
          vaccineCode: "208",
          lotNumber: "EW0150",
          occurrenceDate: "2024-01-22",
          location: "Khan Daun Penh Health Centre, Phnom Penh",
          issuedBy: {
            "@type": "GovernmentOrganization",
            name: "Cambodia Ministry of Health",
          },
        },
      ],
      recordedAt: "2024-01-22T09:14:00+07:00",
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
    "X-Road-UserId": "KH120399042X",
    "X-Road-Issue": `vaccination-${Date.now()}`,
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
