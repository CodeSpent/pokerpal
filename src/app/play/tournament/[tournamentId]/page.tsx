import type { Metadata } from "next";
import TournamentContent from "./tournament-content";

export const metadata: Metadata = {
  title: "Tournament Lobby",
};

interface PageProps {
  params: Promise<{ tournamentId: string }>;
}

export default function Page({ params }: PageProps) {
  return <TournamentContent params={params} />;
}
