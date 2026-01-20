"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { PuzzleRushLeaderboard } from "./puzzle-rush-leaderboard";

export function PuzzleRushHeader() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-10 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Quiz Rush</h1>
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="p-1.5 hover:bg-[hsl(var(--secondary))] transition-colors"
            aria-label="Leaderboard"
          >
            <Trophy className="h-5 w-5 text-[hsl(var(--primary))]" />
          </button>
        </div>
      </div>
      <PuzzleRushLeaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </>
  );
}
