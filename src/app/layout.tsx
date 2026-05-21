import type { Metadata } from "next";
import { Inter, Lora, JetBrains_Mono } from "next/font/google";
import "../styles/global.css";

// Anthropic Sans substitute. Used for all UI chrome, headlines on light
// surfaces, body copy.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

// Anthropic Serif substitute. Used ONLY inside dark editorial cards per spec.
const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-serif",
  weight: ["400", "500", "600"],
});

// Anthropic Mono substitute. Used for technical metadata labels (DATE,
// CATEGORY, structured data within editorial layout).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "CamDX ↔ TWIN Connector — Technical Brief",
  description:
    "Bidirectional adaptor demonstrating that a Cambodian customs consignment delivered over CamDX (X-Road v7.7) can be ingested by a TWIN node, verifiably credentialed, and anchored on-chain — using the same supply-chain models that power TWIN's existing UK pilot. Prepared for the Ministry of Commerce technical feasibility briefing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${lora.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-ivory-light text-slate-dark antialiased">
        {children}
      </body>
    </html>
  );
}
