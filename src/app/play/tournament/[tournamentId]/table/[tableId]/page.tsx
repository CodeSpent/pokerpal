import type { Metadata } from "next";
import TableContent from "./table-content";

export const metadata: Metadata = {
  title: "Live Table",
};

interface PageProps {
  params: Promise<{ tournamentId: string; tableId: string }>;
}

export default function Page({ params }: PageProps) {
  return <TableContent params={params} />;
}
