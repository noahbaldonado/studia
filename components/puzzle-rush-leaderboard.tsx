"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
}

interface PuzzleRushLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PuzzleRushLeaderboard({ isOpen, onClose }: PuzzleRushLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [type, setType] = useState<"global" | "friends">("global");

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
    }
  }, [isOpen, type]);

  const loadLeaderboard = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/puzzle-rush/leaderboard?type=${type}`);
      if (!response.ok) {
        console.error("Error loading leaderboard");
        return;
      }
      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
    } catch (error) {
      console.error("Error loading leaderboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Leaderboard
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-900 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Toggle */}
        <div className="flex gap-2 p-4 border-b">
          <Button
            variant={type === "global" ? "outline" : "default"}
            onClick={() => setType("global")}
            className="flex-1"
          >
            Global
          </Button>
          <Button
            variant={type === "friends" ? "outline" : "default"}
            onClick={() => setType("friends")}
            className="flex-1"
          >
            Friends
          </Button>
        </div>

        {/* Leaderboard Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-zinc-500">Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-zinc-500">
              No {type === "friends" ? "friends" : "users"} with scores yet
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center font-bold text-sm">
                      {entry.rank}
                    </div>
                    <div>
                      <div className="font-semibold">{entry.name}</div>
                    </div>
                  </div>
                  <div className="font-bold text-purple-600">{entry.score} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
