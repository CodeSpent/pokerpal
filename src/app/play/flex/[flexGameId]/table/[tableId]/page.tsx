import type { Metadata } from "next";
import FlexTableContent from "./flex-table-content";

export const metadata: Metadata = {
  title: "Flex Game Table",
};

interface PageProps {
  params: Promise<{ flexGameId: string; tableId: string }>;
}

export default function Page({ params }: PageProps) {
  return <FlexTableContent params={params} />;
}
