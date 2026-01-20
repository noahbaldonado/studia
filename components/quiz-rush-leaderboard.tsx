"use client";

import { useState, useEffect } from "react";
import { Trophy, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  rank: number;
  profilePictureUrl?: string | null;
}

interface QuizRushLeaderboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuizRushLeaderboard({ isOpen, onClose }: QuizRushLeaderboardProps) {
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
      const response = await fetch(`/api/quiz-rush/leaderboard?type=${type}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-[hsl(var(--card))] shadow-xl max-h-[80vh] flex flex-col border-2 border-[hsl(var(--border))]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
            <Trophy className="h-5 w-5 text-[hsl(var(--primary))]" />
            Leaderboard
          </h2>
          <button
            onClick={onClose}
            className="text-foreground hover:text-[hsl(var(--primary))] text-xl font-bold transition-colors"
          >
            ×
          </button>
        </div>

        {/* Toggle */}
        <div className="flex gap-2 p-4 border-b border-[hsl(var(--border))]">
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
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-xs">Loading...</div>
          ) : leaderboard.length === 0 ? (
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-xs">
              No {type === "friends" ? "friends" : "users"} with scores yet
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] bg-[hsl(var(--card))] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[hsl(var(--secondary))] flex items-center justify-center font-bold text-xs text-foreground">
                      {entry.rank}
                    </div>
                    {/* Profile picture */}
                    <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))]">
                      {entry.profilePictureUrl ? (
                        <Image
                          src={entry.profilePictureUrl}
                          alt={entry.name}
                          fill
                          className="object-cover"
                          sizes="32px"
                        />
                      ) : (
                        <User className="w-5 h-5 h-full w-full p-1.5 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </div>
                    <div>
                      <Link
                        href={`/protected/profile/${entry.id}`}
                        className="font-semibold text-foreground text-sm hover:text-[hsl(var(--primary))] hover:underline"
                      >
                        {entry.name}
                      </Link>
                    </div>
                  </div>
                  <div className="font-bold text-[hsl(var(--primary))] text-sm">{entry.score} pts</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
