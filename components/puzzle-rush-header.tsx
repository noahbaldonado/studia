"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";
import { PuzzleRushLeaderboard } from "./puzzle-rush-leaderboard";

export function PuzzleRushHeader() {
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  return (
    <>
      <div className="sticky top-0 bg-gradient-to-r from-white via-blue-50 to-white/80 backdrop-blur-sm z-10 px-4 py-4 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-900">Puzzle Rush</h1>
          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className="p-2 hover:bg-blue-100 rounded-full transition-colors"
            aria-label="Leaderboard"
          >
            <Trophy className="h-6 w-6 text-blue-600" />
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
