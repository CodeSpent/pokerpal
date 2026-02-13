import type { Metadata } from "next";
import { rangeSetRepo } from "@/lib/db/repositories";
import { POSITION_SHORT, type Position } from "@/types/poker";
import { SharedRangeView } from "./shared-range-view";

interface PageProps {
  params: Promise<{ shareCode: string }>;
}

function buildDescription(
  positions: Partial<Record<Position, { hands: string[] }>>,
  creatorName: string
): string {
  const entries = Object.entries(positions) as [Position, { hands: string[] }][];
  if (entries.length === 0) return `Shared by ${creatorName} on PokerPal.`;

  const parts = entries.map(([pos, data]) => {
    const pct = ((data.hands.length / 169) * 100).toFixed(0);
    return `${POSITION_SHORT[pos]}: ${data.hands.length} hands (${pct}%)`;
  });

  return `${parts.join(" | ")} — Shared by ${creatorName} on PokerPal.`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { shareCode } = await params;
  const result = await rangeSetRepo.getRangeSetByShareCode(shareCode);

  if (!result) {
    return {
      title: "Range Set Not Found | PokerPal",
    };
  }

  const positions = JSON.parse(result.positions) as Partial<Record<Position, { hands: string[] }>>;
  const description = buildDescription(positions, result.creatorName);

  return {
    title: `${result.name} | PokerPal Range Sets`,
    description,
    openGraph: {
      title: `${result.name} — PokerPal`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${result.name} — PokerPal`,
      description,
    },
  };
}

export default async function SharedRangeSetPage({ params }: PageProps) {
  const { shareCode } = await params;
  return <SharedRangeView shareCode={shareCode} />;
}
