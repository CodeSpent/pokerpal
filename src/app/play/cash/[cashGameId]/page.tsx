import type { Metadata } from "next";
import CashGameContent from "./cash-game-content";

export const metadata: Metadata = {
  title: "Cash Game",
};

interface PageProps {
  params: Promise<{ cashGameId: string }>;
}

export default function Page({ params }: PageProps) {
  return <CashGameContent params={params} />;
}
