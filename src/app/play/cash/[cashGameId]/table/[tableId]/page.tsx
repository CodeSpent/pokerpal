import type { Metadata } from "next";
import CashTableContent from "./cash-table-content";

export const metadata: Metadata = {
  title: "Cash Game Table",
};

interface PageProps {
  params: Promise<{ cashGameId: string; tableId: string }>;
}

export default function Page({ params }: PageProps) {
  return <CashTableContent params={params} />;
}
