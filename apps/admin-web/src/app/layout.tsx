import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASN — Admin Control Centre",
  description:
    "Master operational governance, catalog management and logistics monitoring for ASN.",
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
