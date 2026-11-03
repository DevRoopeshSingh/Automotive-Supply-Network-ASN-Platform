import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Automotive Supply Network (ASN) — Buyer Marketplace",
  description:
    "The digital infrastructure connecting India automotive aftermarket.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50">{children}</body>
    </html>
  );
}
