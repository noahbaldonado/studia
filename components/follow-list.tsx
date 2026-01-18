"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string | null;
}

interface FollowListProps {
  userId: string;
  type: "following" | "followers";
  limit?: number;
  showCount?: boolean;
}

export function FollowList({ userId, type, limit = 5, showCount = false }: FollowListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/users/following?userId=${userId}&type=${type}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }

        const data = await response.json();
        const allUsers = data.users || [];
        setTotalCount(allUsers.length);
        setUsers(limit ? allUsers.slice(0, limit) : allUsers);
      } catch (err) {
        console.error(`Error fetching ${type}:`, err);
        setError("Failed to load users");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [userId, type]);

  if (loading) {
    return (
      <div className="text-sm text-zinc-500 py-4">Loading {type}...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 py-4">Error: {error}</div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-4">
        No {type} yet
      </div>
    );
  }

  const displayedUsers = users;
  const hasMore = totalCount !== null && totalCount > displayedUsers.length;

  return (
    <div className="space-y-2">
      {showCount && totalCount !== null && (
        <div className="text-sm text-zinc-500 mb-2">
          {totalCount} {totalCount === 1 ? type.slice(0, -1) : type}
        </div>
      )}
      {displayedUsers.map((user) => {
        const emailDisplay = user.email
          ? user.email.replace("@ucsc.edu", "")
          : "";

        return (
          <Link
            key={user.id}
            href={`/protected/profile/${user.id}`}
            className="block"
          >
            <div className="flex items-center justify-between py-2 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-colors cursor-pointer">
              <div className="flex-1">
                <div className="font-medium text-zinc-900">{user.name}</div>
                {emailDisplay && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {emailDisplay}@ucsc.edu
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
      {hasMore && (
        <Link
          href={`/protected/profile/${type}/${userId}`}
          className="block py-2 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-center text-sm text-blue-600 hover:underline"
        >
          View all {totalCount} {type}
        </Link>
      )}
    </div>
  );
}
