import type { Metadata } from "next";
import AuthErrorContent from "./error-content";

export const metadata: Metadata = {
  title: "Authentication Error",
};

export default function Page() {
  return <AuthErrorContent />;
}
