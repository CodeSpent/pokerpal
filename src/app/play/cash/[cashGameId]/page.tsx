import type { Metadata } from "next";
import { cashGameRepo } from "@/lib/db/repositories";
import CashGameContent from "./cash-game-content";

interface PageProps {
  params: Promise<{ cashGameId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cashGameId } = await params;
  const game = await cashGameRepo.getCashGame(cashGameId);

  if (!game) {
    return { title: "Cash Game Not Found" };
  }

  const title = game.name;
  const description = `${game.smallBlind}/${game.bigBlind} blinds cash game. Buy-in: ${game.minBuyIn.toLocaleString()}-${game.maxBuyIn.toLocaleString()} chips. Up to ${game.maxPlayers} players.`;
  const url = `https://letsplay.poker/play/cash/${cashGameId}`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} - LetsPlay Poker`,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - LetsPlay Poker`,
      description,
    },
  };
}

export default function Page({ params }: PageProps) {
  return <CashGameContent params={params} />;
}
