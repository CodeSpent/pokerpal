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
  title: {
    default: "LetsPlay Poker - Free Texas Hold'em Training Tools",
    template: "%s | LetsPlay Poker",
  },
  description: "Master Texas Hold'em with preflop charts, range analysis, scenario training, and math tools. Free poker training for all skill levels.",
  metadataBase: new URL("https://letsplay.poker"),
  robots: { index: true, follow: true },
  openGraph: {
    title: "LetsPlay Poker",
    description: "Master Texas Hold'em with preflop charts, range analysis, scenario training, and math tools",
    siteName: "LetsPlay Poker",
  },
  twitter: {
    card: "summary_large_image",
    title: "LetsPlay Poker",
    description: "Master Texas Hold'em with preflop charts, range analysis, scenario training, and math tools",
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
