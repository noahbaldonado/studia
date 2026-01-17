"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SubscribeButtonProps {
  courseId: string;
  userId: string;
}

export function SubscribeButton({ courseId, userId }: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const supabase = createClient();

  // Check if user is subscribed
  useEffect(() => {
    async function checkSubscription() {
      try {
        const { data, error } = await supabase
          .from("course_subscription")
          .select("course_id")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .single();

        if (error && error.code !== "PGRST116") {
          // PGRST116 is "no rows returned" which is fine
          console.error("Error checking subscription:", error);
        } else {
          setIsSubscribed(!!data);
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
      } finally {
        setLoading(false);
      }
    }

    if (userId && courseId) {
      checkSubscription();
    }
  }, [userId, courseId, supabase]);

  const handleToggle = async () => {
    setUpdating(true);
    try {
      if (isSubscribed) {
        // Unsubscribe
        const { error } = await supabase
          .from("course_subscription")
          .delete()
          .eq("user_id", userId)
          .eq("course_id", courseId);

        if (error) {
          console.error("Error unsubscribing:", error);
          alert("Failed to unsubscribe. Please try again.");
        } else {
          setIsSubscribed(false);
        }
      } else {
        // Subscribe
        const { error } = await supabase
          .from("course_subscription")
          .insert([{ user_id: userId, course_id: courseId }]);

        if (error) {
          console.error("Error subscribing:", error);
          alert("Failed to subscribe. Please try again.");
        } else {
          setIsSubscribed(true);
        }
      }
    } catch (err) {
      console.error("Error toggling subscription:", err);
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
      variant={isSubscribed ? "outline" : "default"}
      className="w-full sm:w-auto"
    >
      {updating
        ? "Updating..."
        : isSubscribed
        ? "Unsubscribe"
        : "Subscribe"}
    </Button>
  );
}
