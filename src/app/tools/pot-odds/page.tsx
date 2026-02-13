import type { Metadata } from "next";
import PotOddsContent from "./pot-odds-content";

export const metadata: Metadata = {
  title: "Pot Odds Calculator",
  description: "Calculate pot odds and equity to determine profitable calls",
};

export default function Page() {
  return <PotOddsContent />;
}
