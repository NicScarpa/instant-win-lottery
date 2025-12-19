import type { Metadata } from "next";
import { Josefin_Sans } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "./components/ErrorBoundary";
import { GoogleTagManagerHead, GoogleTagManagerBody } from "./components/GoogleTagManager";
import { MetaPixelHead, MetaPixelBody, MetaPixelScript } from "./components/MetaPixel";

const josefin = Josefin_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-josefin",
});

export const metadata: Metadata = {
  title: "Campari Soda Instant Win",
  description: "Concorso a premi Campari Soda - Weiss Café - v0.2.5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        <GoogleTagManagerHead />
        <MetaPixelHead />
      </head>
      {/* suppressHydrationWarning è necessario perché alcune estensioni browser
        (come ColorZilla o Password Manager) iniettano attributi nel body,
        causando falsi positivi negli errori di Next.js.
      */}
      <body
        className={`${josefin.className} antialiased`}
        suppressHydrationWarning={true}
      >
        <GoogleTagManagerBody />
        <MetaPixelScript />
        <MetaPixelBody />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
