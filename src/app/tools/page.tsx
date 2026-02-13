import type { Metadata } from "next";
import ToolsContent from "./tools-content";

export const metadata: Metadata = {
  title: "Poker Math Tools",
  description: "Free poker calculators for pot odds, push/fold decisions, and ICM equity",
};

export default function Page() {
  return <ToolsContent />;
}
