"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui/button";

interface FollowButtonProps {
  targetUserId: string;
}

export function FollowButton({ targetUserId }: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'error' } | null>(null);
  const supabase = createClient();

  // Check if current user is following the target user
  useEffect(() => {
    async function checkFollowing() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("follow")
          .select("follower_id, following_id")
          .eq("follower_id", user.id)
          .eq("following_id", targetUserId)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error checking follow status:", error);
        } else {
          setIsFollowing(!!data);
        }
      } catch (err) {
        console.error("Error checking follow status:", err);
      } finally {
        setLoading(false);
      }
    }

    if (targetUserId) {
      checkFollowing();
    }
  }, [targetUserId, supabase]);

  const handleToggle = async () => {
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isFollowing) {
        // Unfollow
        const response = await fetch(`/api/users/follow?followingId=${targetUserId}`, {
          method: "DELETE",
        });

        if (response.ok) {
          setIsFollowing(false);
        } else {
          setNotification({ message: "Failed to unfollow. Please try again.", type: "error" });
          setTimeout(() => setNotification(null), 3000);
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
          setIsFollowing(true);
        } else {
          setNotification({ message: "Failed to follow. Please try again.", type: "error" });
          setTimeout(() => setNotification(null), 3000);
        }
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
      setNotification({ message: "An error occurred. Please try again.", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Button disabled className="w-full sm:w-auto">
        Loading...
      </Button>
    );
  }

  return (
    <div>
      <Button
        onClick={handleToggle}
        disabled={updating}
        variant={isFollowing ? "outline" : "default"}
        className="w-full sm:w-auto"
      >
        {updating
          ? "Updating..."
          : isFollowing
          ? "Unfollow"
          : "Follow"}
      </Button>
      {notification && (
        <div className="mt-2 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-300">
          {notification.message}
        </div>
      )}
    </div>
  );
}
