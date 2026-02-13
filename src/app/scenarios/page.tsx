import type { Metadata } from "next";
import ScenariosContent from "./scenarios-content";

export const metadata: Metadata = {
  title: "Poker Scenarios",
  description: "Quiz-style poker decision training with hand replays and progress tracking",
};

export default function Page() {
  return <ScenariosContent />;
}
