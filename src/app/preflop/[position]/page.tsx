import type { Metadata } from "next";
import { POSITION_NAMES, POSITIONS_9MAX, Position } from "@/types/poker";
import PositionContent from "./position-content";

interface PageProps {
  params: Promise<{ position: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { position: positionParam } = await params;
  const position = positionParam.toUpperCase() as Position;

  if (!POSITIONS_9MAX.includes(position)) {
    return { title: "Position Not Found" };
  }

  const fullName = POSITION_NAMES[position];
  return {
    title: `${position} (${fullName}) Preflop Ranges`,
    description: `${fullName} opening range strategy, tips, and common mistakes for 6-max Texas Hold'em poker`,
  };
}

export default function Page({ params }: PageProps) {
  return <PositionContent params={params} />;
}
