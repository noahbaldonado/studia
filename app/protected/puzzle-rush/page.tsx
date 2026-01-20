import { requireUsername } from "@/lib/auth-utils";
import { PuzzleRush } from "@/components/puzzle-rush";
import { PuzzleRushHeader } from "@/components/puzzle-rush-header";

export default async function PuzzleRushPage() {
  await requireUsername();

  return (
    <div className="min-h-screen pb-20">
      <PuzzleRushHeader />
      <PuzzleRush />
    </div>
  );
}
