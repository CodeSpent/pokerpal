import type { Metadata } from "next";
import PreflopContent from "./preflop-content";

export const metadata: Metadata = {
  title: "Preflop Strategy",
  description: "Position-based opening ranges for Texas Hold'em with interactive charts and decision practice",
};

export default function Page() {
  return <PreflopContent />;
}
