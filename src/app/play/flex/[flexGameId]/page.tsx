import type { Metadata } from "next";
import { flexGameRepo } from "@/lib/db/repositories";
import FlexGameContent from "./flex-game-content";

interface PageProps {
  params: Promise<{ flexGameId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { flexGameId } = await params;
  const game = await flexGameRepo.getFlexGame(flexGameId);

  if (!game) {
    return { title: "Flex Game Not Found" };
  }

  const title = game.name;
  const description = `${game.smallBlind}/${game.bigBlind} blinds flex game. ${game.turnTimerHours}h turn timer. Buy-in: ${game.minBuyIn.toLocaleString()}-${game.maxBuyIn.toLocaleString()} chips. Play at your own pace!`;
  const url = `https://letsplay.poker/play/flex/${flexGameId}`;

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
  return <FlexGameContent params={params} />;
}
