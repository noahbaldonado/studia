"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, ArrowLeft } from "lucide-react";
import { QuizRushLeaderboard } from "./quiz-rush-leaderboard";

export function QuizRushHeader() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/protected/minigames"
              className="p-1.5 hover:bg-[hsl(var(--secondary))] transition-colors"
              aria-label="Back to Minigames"
            >
              <ArrowLeft className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
            </Link>
            <h1 className="text-xl font-bold text-foreground">Quiz Rush</h1>
          </div>
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="p-1.5 hover:bg-[hsl(var(--secondary))] transition-colors"
            aria-label="Leaderboard"
          >
            <Trophy className="h-5 w-5 text-[hsl(var(--primary))]" />
          </button>
        </div>
      </div>
      <QuizRushLeaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </>
  );
}
