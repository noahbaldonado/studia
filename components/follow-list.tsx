"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";

interface User {
  id: string;
  name: string | null;
  username: string | null;
  profilePictureUrl: string | null;
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
      <div className="text-sm text-blue-600 py-4">Loading {type}...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-blue-600 py-4">Error: {error}</div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-sm text-blue-600 py-4">
        No {type} yet
      </div>
    );
  }

  const displayedUsers = users;
  const hasMore = totalCount !== null && totalCount > displayedUsers.length;

  return (
    <div className="space-y-2">
      {showCount && totalCount !== null && (
        <div className="text-sm text-blue-600 mb-2">
          {totalCount} {totalCount === 1 ? type.slice(0, -1) : type}
        </div>
      )}
      {displayedUsers.map((user) => {
        return (
          <Link
            key={user.id}
            href={`/protected/profile/${user.id}`}
            className="block"
          >
            <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer bg-white">
              {/* Profile Picture */}
              <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-blue-100">
                {user.profilePictureUrl ? (
                  <Image
                    src={user.profilePictureUrl}
                    alt={user.username || user.name || "User"}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  <User className="w-6 h-6 h-full w-full p-2 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {user.username ? (
                  <>
                    <div className="font-medium text-blue-900 truncate">@{user.username}</div>
                    {user.name && (
                      <div className="text-xs text-blue-600 mt-0.5 truncate">
                        {user.name}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="font-medium text-blue-900 truncate">
                    {user.name || `User ${user.id.substring(0, 8)}`}
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
          className="block py-2 px-3 rounded-lg border border-blue-200 hover:bg-blue-50 text-center text-sm text-blue-600 hover:underline bg-white"
        >
          View all {totalCount} {type}
        </Link>
      )}
    </div>
  );
}
