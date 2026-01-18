"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, X, UserPlus, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string | null;
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
  const router = useRouter();

  const supabase = createClient();

  // Get current user ID
  useEffect(() => {
    async function getUserId() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Load following list
        loadFollowing(user.id);
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

      {/* Instructions */}
      {!searchQuery && (
        <div className="text-center py-12 text-blue-600">
          <p className="mb-2">Search for friends by name or UCSC email</p>
          <p className="text-sm">You can search by email prefix (e.g., "username" for username@ucsc.edu)</p>
        </div>
      )}
    </div>
  );
}
