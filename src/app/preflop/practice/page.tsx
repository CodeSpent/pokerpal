import type { Metadata } from "next";
import PracticeContent from "./practice-content";

export const metadata: Metadata = {
  title: "Preflop Practice",
  description: "Practice preflop opening decisions with randomized scenarios and accuracy tracking",
};

export default function Page() {
  return <PracticeContent />;
}
