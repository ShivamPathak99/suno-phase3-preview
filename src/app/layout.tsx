import type { Metadata } from "next";
import { Andika, Baloo_2, Noto_Sans, Noto_Sans_Devanagari } from "next/font/google";
import "./globals.css";

const uiFont = Noto_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "600"],
});

const devanagariFont = Noto_Sans_Devanagari({
  display: "swap",
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  weight: ["400", "600"],
});

const displayFont = Baloo_2({
  display: "swap",
  subsets: ["devanagari", "latin"],
  variable: "--font-display",
  weight: "600",
});

const passageFont = Andika({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-passage",
  weight: "400",
});

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
      <body className={`${uiFont.variable} ${devanagariFont.variable} ${displayFont.variable} ${passageFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
