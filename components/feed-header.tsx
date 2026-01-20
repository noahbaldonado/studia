"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { StreakLeaderboard } from "./streak-leaderboard";

export function FeedHeader() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-40 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Home</h1>
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="p-1.5 hover:bg-[hsl(var(--secondary))] transition-colors"
            aria-label="Daily Streak Leaderboard"
          >
            <Trophy className="h-5 w-5 text-[hsl(var(--primary))]" />
          </button>
        </div>
      </div>
      <StreakLeaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </>
  );
}
