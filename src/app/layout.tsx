import type { Metadata } from "next";
import "../styles/global.css";

export const metadata: Metadata = {
  title: "CamDX ↔ TWIN Connector PoC",
  description:
    "Bidirectional adaptor demonstrating interoperability between Cambodia's CamDX (X-Road v7.7) and a TWIN node.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
