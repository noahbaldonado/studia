"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { StreakLeaderboard } from "./streak-leaderboard";

export function StreakLeaderboardButton() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsLeaderboardOpen(true)}
        className="p-1.5 hover:bg-[hsl(var(--secondary))] transition-colors rounded"
        aria-label="Daily Streak Leaderboard"
      >
        <Trophy className="h-4 w-4 text-[hsl(var(--primary))]" />
      </button>
      <StreakLeaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </>
  );
}
