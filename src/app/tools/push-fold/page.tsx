import type { Metadata } from "next";
import PushFoldContent from "./push-fold-content";

export const metadata: Metadata = {
  title: "Push/Fold Charts",
  description: "Nash equilibrium push/fold ranges for short stack tournament play",
};

export default function Page() {
  return <PushFoldContent />;
}
