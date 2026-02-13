import type { Metadata } from "next";
import ICMContent from "./icm-content";

export const metadata: Metadata = {
  title: "ICM Calculator",
  description: "Calculate Independent Chip Model equity for tournament bubble decisions",
};

export default function Page() {
  return <ICMContent />;
}
