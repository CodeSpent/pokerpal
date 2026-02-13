import type { Metadata } from "next";
import ImportContent from "./import-content";

export const metadata: Metadata = {
  title: "Import Hands",
  description: "Import hand histories from PokerStars or GGPoker for review",
};

export default function Page() {
  return <ImportContent />;
}
