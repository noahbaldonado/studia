"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { UserPlus, UserMinus, ArrowLeft, User } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface SuggestedUser {
  id: string;
  name: string;
  username: string | null;
  profilePictureUrl: string | null;
  mutualCourses: number;
}

const ITEMS_PER_PAGE = 10;

export default function AllSuggestedFriendsPage() {
  const [suggestedFriends, setSuggestedFriends] = useState<SuggestedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [followingMap, setFollowingMap] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const router = useRouter();
  const supabase = createClient();

  // Get current user ID
  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadFollowing(user.id);
        loadSuggestedFriends();
      }
    }
    getUserId();
  }, [supabase]);

  // Load who the user is following
  async function loadFollowing(currentUserId: string) {
    try {
      const { data, error } = await supabase
        .from("follow")
        .select("following_id")
        .eq("follower_id", currentUserId);

      if (!error && data) {
        setFollowingMap(new Set(data.map((f) => f.following_id)));
      }
    } catch (err) {
      console.error("Error loading following:", err);
    }
  }

  // Load suggested friends
  async function loadSuggestedFriends() {
    setLoading(true);
    try {
      const response = await fetch("/api/users/suggested-friends");
      if (response.ok) {
        const data = await response.json();
        setSuggestedFriends(data.users || []);
      }
    } catch (error) {
      console.error("Error loading suggested friends:", error);
    } finally {
      setLoading(false);
    }
  }

  const handleFollow = async (targetUserId: string) => {
    if (!userId) return;

    const isFollowing = followingMap.has(targetUserId);

    try {
      if (isFollowing) {
        // Unfollow
        const response = await fetch(`/api/users/follow?followingId=${targetUserId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setFollowingMap((prev) => {
            const next = new Set(prev);
            next.delete(targetUserId);
            return next;
          });
          // Reload suggested friends after unfollowing
          loadSuggestedFriends();
        }
      } else {
        // Follow
        const response = await fetch("/api/users/follow", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ followingId: targetUserId }),
        });

        if (response.ok) {
          setFollowingMap((prev) => new Set([...prev, targetUserId]));
          // Reload suggested friends after following
          loadSuggestedFriends();
        }
      }
    } catch (error) {
      console.error("Error toggling follow:", error);
    }
  };

  const handleSelectUser = (user: SuggestedUser) => {
    router.push(`/protected/profile/${user.id}`);
  };

  // Calculate pagination
  const totalPages = Math.ceil(suggestedFriends.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedFriends = suggestedFriends.slice(startIndex, endIndex);

  return (
    <div className="px-4 py-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/protected/friends"
          className="text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-blue-900">Suggested Friends</h1>
      </div>

      {loading ? (
        <div className="text-center py-12 text-blue-600">Loading suggested friends...</div>
      ) : suggestedFriends.length === 0 ? (
        <div className="text-center py-12 text-blue-600">
          <p className="mb-2">No suggested friends found</p>
          <p className="text-sm">Try subscribing to more courses to find friends with similar interests!</p>
        </div>
      ) : (
        <>
          {/* Friends List */}
          <div className="space-y-2 mb-6">
            {paginatedFriends.map((user) => {
              const isFollowing = followingMap.has(user.id);

              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors bg-white"
                >
                  {/* Profile Picture */}
                  <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-blue-100">
                    {user.profilePictureUrl ? (
                      <Image
                        src={user.profilePictureUrl}
                        alt={user.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    ) : (
                      <User className="w-6 h-6 h-full w-full p-2 text-blue-600" />
                    )}
                  </div>
                  <button
                    onClick={() => handleSelectUser(user)}
                    className="flex-1 text-left min-w-0"
                  >
                    <div className="font-medium text-blue-900 truncate">{user.name}</div>
                    {user.username && (
                      <div className="text-xs text-blue-600 mt-0.5 truncate">
                        @{user.username}
                      </div>
                    )}
                    <div className="text-xs text-blue-500 mt-1">
                      {user.mutualCourses} {user.mutualCourses === 1 ? "mutual course" : "mutual courses"}
                    </div>
                  </button>
                  <button
                    onClick={() => handleFollow(user.id)}
                    className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors text-sm font-medium text-blue-700 flex-shrink-0"
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="h-4 w-4" />
                        <span>Unfollow</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg border border-blue-200 bg-white text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 transition-colors"
              >
                Previous
              </button>
              <span className="text-blue-600 px-4">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-blue-200 bg-white text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-50 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
