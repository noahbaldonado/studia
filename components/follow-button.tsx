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
          alert("Failed to unfollow. Please try again.");
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
          alert("Failed to follow. Please try again.");
        }
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
      alert("An error occurred. Please try again.");
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
  );
}
