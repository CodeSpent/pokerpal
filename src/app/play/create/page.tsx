import type { Metadata } from "next";
import CreateContent from "./create-content";

export const metadata: Metadata = {
  title: "Create Tournament",
};

export default function Page() {
  return <CreateContent />;
}
