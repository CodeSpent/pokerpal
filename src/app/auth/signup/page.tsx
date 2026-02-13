import type { Metadata } from "next";
import SignUpContent from "./signup-content";

export const metadata: Metadata = {
  title: "Sign Up",
};

export default function Page() {
  return <SignUpContent />;
}
