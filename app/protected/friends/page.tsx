"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, X, UserPlus, UserMinus, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
  id: string;
  name: string;
  email: string | null;
}

interface SuggestedUser extends User {
  mutualCourses: number;
}

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [followingMap, setFollowingMap] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestedFriends, setSuggestedFriends] = useState<SuggestedUser[]>([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const router = useRouter();

  const supabase = createClient();

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

  // Load suggested friends based on mutual courses
  const loadSuggestedFriends = useCallback(async () => {
    if (!userId) return;
    setLoadingSuggested(true);
    try {
      const response = await fetch("/api/users/suggested-friends");
      if (response.ok) {
        const data = await response.json();
        setSuggestedFriends(data.users || []);
      }
    } catch (error) {
      console.error("Error loading suggested friends:", error);
    } finally {
      setLoadingSuggested(false);
    }
  }, [userId]);

  // Get current user ID
  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Load following list
        loadFollowing(user.id);
        // Load suggested friends
        loadSuggestedFriends();
      }
    }
    getUserId();
  }, [supabase, loadSuggestedFriends]);

  // Reload suggested friends when following changes
  useEffect(() => {
    if (userId) {
      loadSuggestedFriends();
    }
  }, [followingMap, userId, loadSuggestedFriends]);

  // Search users with debounce
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.users || []);
          setShowSuggestions(true);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const handleSelectUser = (user: User) => {
    router.push(`/protected/profile/${user.id}`);
  };

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold mb-6 text-blue-900">Friends</h1>

      {/* Search Bar */}
      <div ref={searchRef} className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400" />
          <input
            type="text"
            placeholder="Search by name or UCSC email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim().length >= 2) {
                setShowSuggestions(true);
              }
            }}
            onFocus={() => {
              if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
                setShowSuggestions(true);
              }
            }}
            className="w-full rounded-lg border border-blue-200 bg-white px-10 py-2.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 text-blue-900"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowSuggestions(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Suggestions */}
        {showSuggestions && (loading || searchResults.length > 0) && (
          <div className="absolute z-50 mt-2 w-full rounded-lg border border-blue-200 bg-white shadow-lg">
            <div className="max-h-60 overflow-auto">
              {loading ? (
                <div className="px-4 py-3 text-sm text-blue-600">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => {
                  const isFollowing = followingMap.has(user.id);
                  const emailDisplay = user.email
                    ? user.email.replace("@ucsc.edu", "")
                    : "";

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-blue-100 last:border-b-0"
                    >
                      <button
                        onClick={() => handleSelectUser(user)}
                        className="flex-1 text-left"
                      >
                        <div className="font-medium text-blue-900">{user.name}</div>
                        {emailDisplay && (
                          <div className="text-xs text-blue-600 mt-0.5">
                            {emailDisplay}@ucsc.edu
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => handleFollow(user.id)}
                        className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors text-sm font-medium text-blue-700"
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
                })
              ) : (
                <div className="px-4 py-3 text-sm text-blue-600">No users found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Suggested Friends */}
      {!searchQuery && (
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-blue-900">Suggested Friends</h2>
            {suggestedFriends.length > 5 && (
              <Link
                href="/protected/friends/suggested"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                See All
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          {loadingSuggested ? (
            <div className="text-center py-8 text-blue-600">Loading suggested friends...</div>
          ) : suggestedFriends.length > 0 ? (
            <div className="space-y-2">
              {suggestedFriends.slice(0, 5).map((user) => {
                const isFollowing = followingMap.has(user.id);
                const emailDisplay = user.email
                  ? user.email.replace("@ucsc.edu", "")
                  : "";

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors bg-white"
                  >
                    <button
                      onClick={() => handleSelectUser(user)}
                      className="flex-1 text-left"
                    >
                      <div className="font-medium text-blue-900">{user.name}</div>
                      {emailDisplay && (
                        <div className="text-xs text-blue-600 mt-0.5">
                          {emailDisplay}@ucsc.edu
                        </div>
                      )}
                      <div className="text-xs text-blue-500 mt-1">
                        {user.mutualCourses} {user.mutualCourses === 1 ? "mutual course" : "mutual courses"}
                      </div>
                    </button>
                    <button
                      onClick={() => handleFollow(user.id)}
                      className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors text-sm font-medium text-blue-700"
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
          ) : (
            <div className="text-center py-8 text-blue-600">
              No suggested friends found. Try searching for friends above!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
