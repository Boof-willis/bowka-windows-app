import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boka Glass",
  description: "Boka Glass internal ops & P&L",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  );
}
