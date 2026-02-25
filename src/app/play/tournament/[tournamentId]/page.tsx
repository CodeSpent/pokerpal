import type { Metadata } from "next";
import { tournamentRepo } from "@/lib/db/repositories";
import TournamentContent from "./tournament-content";

interface PageProps {
  params: Promise<{ tournamentId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { tournamentId } = await params;
  const tournament = await tournamentRepo.getTournament(tournamentId);

  if (!tournament) {
    return { title: "Tournament Not Found" };
  }

  const title = tournament.name;
  const description = `${tournament.maxPlayers}-player Sit & Go tournament. Starting stack: ${tournament.startingChips.toLocaleString()} chips. Status: ${tournament.status}.`;
  const url = `https://letsplay.poker/play/tournament/${tournamentId}`;

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
  return <TournamentContent params={params} />;
}
