import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AISAC Orbs",
  description: "A state-aware visual runtime for AI agents.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
