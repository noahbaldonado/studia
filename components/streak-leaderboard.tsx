"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LeaderboardEntry {
  id: string;
  name: string;
  streak: number;
  rank: number;
}

interface StreakLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StreakLeaderboard({ isOpen, onClose }: StreakLeaderboardProps) {
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
      const response = await fetch(`/api/streaks/leaderboard?type=${type}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/50 p-4">
      <div className="w-full max-w-md bg-gradient-to-br from-white to-blue-50 rounded-lg shadow-xl max-h-[80vh] flex flex-col border-2 border-blue-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-blue-200">
          <h2 className="text-xl font-bold flex items-center gap-2 text-blue-900">
            <Trophy className="h-5 w-5 text-blue-600" />
            Daily Streak Leaderboard
          </h2>
          <button
            onClick={onClose}
            className="text-blue-500 hover:text-blue-700 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Toggle */}
        <div className="flex gap-2 p-4 border-b border-blue-200">
          <Button
            variant={type === "global" ? "default" : "outline"}
            onClick={() => setType("global")}
            className="flex-1"
          >
            Global
          </Button>
          <Button
            variant={type === "friends" ? "default" : "outline"}
            onClick={() => setType("friends")}
            className="flex-1"
          >
            Friends
          </Button>
        </div>

        {/* Leaderboard Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-blue-600">Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-blue-600">
              No {type === "friends" ? "friends" : "users"} with streaks yet
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-blue-200 hover:bg-blue-50 bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-sm text-blue-700">
                      {entry.rank}
                    </div>
                    <div>
                      <div className="font-semibold text-blue-900">{entry.name}</div>
                    </div>
                  </div>
                  <div className="font-bold text-blue-600">
                    🔥 {entry.streak} {entry.streak === 1 ? "day" : "days"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
