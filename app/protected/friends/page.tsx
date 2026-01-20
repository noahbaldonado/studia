"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, X, UserPlus, UserMinus, ChevronRight, User } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface User {
  id: string;
  name: string;
  username: string | null;
  profilePictureUrl: string | null;
}

interface SuggestedUser {
  id: string;
  name: string;
  username: string | null;
  profilePictureUrl: string | null;
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
      <h1 className="text-2xl font-bold mb-6 text-foreground">Friends</h1>

      {/* Search Bar */}
      <div ref={searchRef} className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
          <input
            type="text"
            placeholder="Search for someone..."
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
            className="w-full border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-10 py-2.5 text-xs focus:border-[hsl(var(--primary))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] text-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowSuggestions(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search Suggestions */}
        {showSuggestions && (loading || searchResults.length > 0) && (
          <div className="absolute z-50 mt-1 w-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-lg">
            <div className="max-h-60 overflow-auto">
              {loading ? (
                <div className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">Searching...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => {
                  const isFollowing = followingMap.has(user.id);

                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[hsl(var(--secondary))] transition-colors border-b border-[hsl(var(--border))] last:border-b-0"
                    >
                      {/* Profile Picture */}
                      <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))]">
                        {user.profilePictureUrl ? (
                          <Image
                            src={user.profilePictureUrl}
                            alt={user.name}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <User className="w-6 h-6 h-full w-full p-2 text-[hsl(var(--muted-foreground))]" />
                        )}
                      </div>
                      <button
                        onClick={() => handleSelectUser(user)}
                        className="flex-1 text-left min-w-0"
                      >
                        {user.username ? (
                          <>
                            <div className="font-medium text-foreground text-sm truncate">
                              @{user.username}
                            </div>
                            {user.name && (
                              <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                                {user.name}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="font-medium text-foreground text-sm truncate">
                            {user.name || `User ${user.id.substring(0, 8)}`}
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => handleFollow(user.id)}
                        className="ml-4 flex items-center gap-1.5 px-3 py-1.5 border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors text-xs font-medium text-foreground flex-shrink-0"
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
                <div className="px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">No users found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Suggested Friends */}
      {!searchQuery && (
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Suggested Friends</h2>
            {suggestedFriends.length > 5 && (
              <Link
                href="/protected/friends/suggested"
                className="text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--accent))] flex items-center gap-1"
              >
                See All
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          {loadingSuggested ? (
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-xs">Loading suggested friends...</div>
          ) : suggestedFriends.length > 0 ? (
            <div className="space-y-2">
              {suggestedFriends.slice(0, 5).map((user) => {
                const isFollowing = followingMap.has(user.id);

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors bg-[hsl(var(--card))]"
                  >
                    {/* Profile Picture */}
                    <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))]">
                      {user.profilePictureUrl ? (
                        <Image
                          src={user.profilePictureUrl}
                          alt={user.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      ) : (
                        <User className="w-6 h-6 h-full w-full p-2 text-[hsl(var(--muted-foreground))]" />
                      )}
                    </div>
                    <button
                      onClick={() => handleSelectUser(user)}
                      className="flex-1 text-left min-w-0"
                    >
                      <div className="font-medium text-foreground text-sm truncate">{user.name}</div>
                      {user.username && (
                        <div className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 truncate">
                          @{user.username}
                        </div>
                      )}
                      <div className="text-xs text-[hsl(var(--primary))] mt-1">
                        {user.mutualCourses} {user.mutualCourses === 1 ? "mutual course" : "mutual courses"}
                      </div>
                    </button>
                    <button
                      onClick={() => handleFollow(user.id)}
                      className="ml-4 flex items-center gap-1.5 px-3 py-1.5 border border-[hsl(var(--border))] hover:bg-[hsl(var(--secondary))] transition-colors text-xs font-medium text-foreground flex-shrink-0"
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
            <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-xs">
              No suggested friends found. Try searching for friends above!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
