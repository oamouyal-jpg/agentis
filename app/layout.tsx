import type { Metadata } from "next";
import {
  Inter,
  Newsreader,
  Noto_Sans,
} from "next/font/google";
import type { ReactNode } from "react";
import { I18nProvider } from "../lib/i18n/I18nProvider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

const notoSans = Noto_Sans({
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agentis — Groups",
  description:
    "Turn crowd input into clear questions, votes, and shared insight.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${newsreader.variable} ${notoSans.variable}`}
      suppressHydrationWarning
    >
      <body
        className={`${inter.className} min-h-screen bg-zinc-950 text-zinc-100 antialiased [color-scheme:dark]`}
      >
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
