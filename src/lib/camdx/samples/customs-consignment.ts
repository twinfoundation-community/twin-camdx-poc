/**
 * Illustrative Cambodian customs export Consignment in the UN/CEFACT D23B
 * vocabulary. This is the object type the canonical TWIN data-space-connector
 * test app (`@twin.org/data-space-connector-test-app`) subscribes to:
 *
 *   activitiesHandled(): [{ objectType: "https://vocabulary.uncefact.org/Consignment" }]
 *
 * Once the test app is registered as an extension on Kitsune, this payload
 * will trigger the full activity-log task lifecycle (pending → running →
 * finalized) on stage 04 of the demo timeline.
 *
 * Shape and context match the test data in:
 *   data-space-connector/packages/data-space-connector-service/tests/testData.ts
 * which is the closest published reference until twin-supply-chain ships a
 * public `@twin.org/supply-chain-models` package.
 *
 * Commodity classification: HS 1006.30 (milled rice) — Cambodia's flagship
 * export. Trade lane Phnom Penh → Singapore is among the country's largest
 * for commercial rice volumes.
 */
export const sampleCustomsConsignment = {
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
