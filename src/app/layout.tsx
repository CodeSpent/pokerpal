import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LetsPlay Poker - Texas Hold'em Training",
  description: "Master Texas Hold'em with preflop charts, range analysis, and scenario training",
  metadataBase: new URL("https://letsplay.poker"),
  openGraph: {
    title: "LetsPlay Poker",
    description: "Master Texas Hold'em with preflop charts, range analysis, and scenario training",
    siteName: "LetsPlay Poker",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans min-h-screen bg-background`}>
        <Providers>
          <Header />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
