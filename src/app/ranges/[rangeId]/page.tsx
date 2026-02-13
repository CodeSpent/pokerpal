import type { Metadata } from "next";
import RangeEditorContent from "./range-editor-content";

export const metadata: Metadata = {
  title: "Range Editor",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ rangeId: string }>;
}

export default function Page({ params }: PageProps) {
  return <RangeEditorContent params={params} />;
}
