import type { Metadata, Viewport } from "next";
import {
  Inter,
  Newsreader,
  Noto_Sans,
} from "next/font/google";
import type { ReactNode } from "react";
import { RegisterSW } from "./components/RegisterSW";
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Agentis",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
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
        <RegisterSW />
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
