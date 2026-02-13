import type { Metadata } from "next";
import { Suspense } from "react";
import CreateContent from "./create-content";

export const metadata: Metadata = {
  title: "Create Tournament",
};

export default function Page() {
  return (
    <Suspense>
      <CreateContent />
    </Suspense>
  );
}
