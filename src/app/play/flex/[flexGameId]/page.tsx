import type { Metadata } from "next";
import FlexGameContent from "./flex-game-content";

export const metadata: Metadata = {
  title: "Flex Game",
};

interface PageProps {
  params: Promise<{ flexGameId: string }>;
}

export default function Page({ params }: PageProps) {
  return <FlexGameContent params={params} />;
}
