import type { Metadata } from "next";
import RangesContent from "./ranges-content";

export const metadata: Metadata = {
  title: "Range Sets",
  description: "Build and customize per-position opening ranges",
};

export default function Page() {
  return <RangesContent />;
}
