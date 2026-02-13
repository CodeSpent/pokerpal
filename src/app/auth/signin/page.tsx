import type { Metadata } from "next";
import SignInContent from "./signin-content";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function Page() {
  return <SignInContent />;
}
