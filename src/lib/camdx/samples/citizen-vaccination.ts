/**
 * Illustrative citizen vaccination record — what a CamDX-routed health ministry
 * service might deliver for a verification query. Shape is plausible but NOT
 * derived from a published Cambodian MoH contract; treat as a stand-in for a
 * future real schema.
 */
export const sampleCitizenVaccination = {
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
