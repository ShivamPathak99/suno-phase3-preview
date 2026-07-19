import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Suno",
  description: "Teacher-first oral reading assessment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
