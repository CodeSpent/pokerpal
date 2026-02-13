import { Suspense } from "react";
import LobbyContent from "./lobby-content";

export default function Page() {
  return (
    <Suspense>
      <LobbyContent />
    </Suspense>
  );
}
