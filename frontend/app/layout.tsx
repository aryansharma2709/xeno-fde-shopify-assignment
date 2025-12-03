// app/layout.tsx
import "./globals.css";
import React from "react";

export const metadata = {
  title: "Xeno Shopify Insights",
  description: "Multi-tenant Shopify Data Ingestion & Insights Dashboard"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
