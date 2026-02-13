import type { Metadata } from "next";
import QuizContent from "./quiz-content";

export const metadata: Metadata = {
  title: "Poker Quiz",
  description: "Test poker decision-making with configurable scenario quizzes",
};

export default function Page() {
  return <QuizContent />;
}
