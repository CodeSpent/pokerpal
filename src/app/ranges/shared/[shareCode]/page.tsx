import type { Metadata } from "next";
import SharedRangeContent from "./shared-range-content";

export const metadata: Metadata = {
  title: "Shared Range Set",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ shareCode: string }>;
}

export default function Page({ params }: PageProps) {
  return <SharedRangeContent params={params} />;
}
