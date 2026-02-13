import type { Metadata } from "next";
import SetupContent from "./setup-content";

export const metadata: Metadata = {
  title: "Profile Setup",
};

export default function Page() {
  return <SetupContent />;
}
