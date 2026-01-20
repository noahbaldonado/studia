import { requireUsername } from "@/lib/auth-utils";
import { QuizRush } from "@/components/quiz-rush";
import { QuizRushHeader } from "@/components/quiz-rush-header";

export default async function QuizRushPage() {
  await requireUsername();

  return (
    <div className="min-h-screen pb-20">
      <QuizRushHeader />
      <QuizRush />
    </div>
  );
}
