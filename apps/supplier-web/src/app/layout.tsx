import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASN — Supplier OS & Wholesale Supply Network",
  description:
    "Operating system and inter-supplier commerce desk for automotive distributors and retailers.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-100">{children}</body>
    </html>
  );
}
