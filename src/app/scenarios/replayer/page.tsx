import type { Metadata } from "next";
import ReplayerContent from "./replayer-content";

export const metadata: Metadata = {
  title: "Hand Replayer",
  description: "Step through poker hands action-by-action with board cards and pot sizes",
};

export default function Page() {
  return <ReplayerContent />;
}
