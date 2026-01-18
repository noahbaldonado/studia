"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { StreakLeaderboard } from "./streak-leaderboard";

export function FeedHeader() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 bg-gradient-to-r from-white via-blue-50 to-white/80 backdrop-blur-sm z-40 px-4 py-4 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-900">Home</h1>
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="p-2 hover:bg-blue-100 rounded-full transition-colors"
            aria-label="Daily Streak Leaderboard"
          >
            <Trophy className="h-6 w-6 text-blue-600" />
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
