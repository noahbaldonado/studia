"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface OtherSubscription {
  id: string;
  professor: string | null;
  quarter: string | null;
}

interface SubscribeButtonProps {
  courseId: string;
  userId: string;
  courseName: string;
}

export function SubscribeButton({ courseId, userId, courseName }: SubscribeButtonProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'error' } | null>(null);
  const [otherSubscriptions, setOtherSubscriptions] = useState<OtherSubscription[]>([]);
  const supabase = createClient();

  // Check subscription status and fetch other subscriptions
  useEffect(() => {
    async function checkSubscriptionAndFetchOthers() {
      try {
        setLoading(true);
        
        // Check if subscribed to current course
        const { data: currentSubscription, error: currentError } = await supabase
          .from("course_subscription")
          .select("course_id")
          .eq("user_id", userId)
          .eq("course_id", courseId)
          .maybeSingle();

        if (currentError) {
          console.error("Error checking subscription:", currentError);
        } else {
          setIsSubscribed(!!currentSubscription);
        }

        // Get all subscriptions for this course name
        const { data: allSubscriptions } = await supabase
          .from("course_subscription")
          .select("course_id")
          .eq("user_id", userId);

        if (allSubscriptions && allSubscriptions.length > 0) {
          const subscribedCourseIds = allSubscriptions.map(s => s.course_id);
          
          // Get all courses with same name that user is subscribed to
          const { data: subscribedCourses } = await supabase
            .from("course")
            .select("id, professor, quarter")
            .in("id", subscribedCourseIds)
            .eq("name", courseName);

          if (subscribedCourses) {
            // Filter out the current course
            const others = subscribedCourses
              .filter(c => c.id !== courseId)
              .map(c => ({
                id: c.id,
                professor: c.professor,
                quarter: c.quarter,
              }));
            setOtherSubscriptions(others);
          } else {
            setOtherSubscriptions([]);
          }
        } else {
          setOtherSubscriptions([]);
        }
      } catch (err) {
        console.error("Error checking subscription:", err);
      } finally {
        setLoading(false);
      }
    }

    if (userId && courseId && courseName) {
      checkSubscriptionAndFetchOthers();
    }
  }, [userId, courseId, courseName, supabase]);


  const handleToggle = async () => {
    setUpdating(true);
    try {
      if (!isSubscribed) {
        // Subscribe to current course
        const { error } = await supabase
          .from("course_subscription")
          .insert([{ user_id: userId, course_id: courseId }]);

        if (error) {
          console.error("Error subscribing:", error);
          setNotification({ message: "Failed to subscribe. Please try again.", type: "error" });
          setTimeout(() => setNotification(null), 3000);
        } else {
          setIsSubscribed(true);
          // Refresh other subscriptions
          const { data: allSubscriptions } = await supabase
            .from("course_subscription")
            .select("course_id")
            .eq("user_id", userId);

          if (allSubscriptions && allSubscriptions.length > 0) {
            const subscribedCourseIds = allSubscriptions.map(s => s.course_id);
            const { data: subscribedCourses } = await supabase
              .from("course")
              .select("id, professor, quarter")
              .in("id", subscribedCourseIds)
              .eq("name", courseName);

            if (subscribedCourses) {
              const others = subscribedCourses
                .filter(c => c.id !== courseId)
                .map(c => ({
                  id: c.id,
                  professor: c.professor,
                  quarter: c.quarter,
                }));
              setOtherSubscriptions(others);
            }
          }
        }
      } else {
        // Unsubscribe from current course
        const { error } = await supabase
          .from("course_subscription")
          .delete()
          .eq("user_id", userId)
          .eq("course_id", courseId);

        if (error) {
          console.error("Error unsubscribing:", error);
          setNotification({ message: "Failed to unsubscribe. Please try again.", type: "error" });
          setTimeout(() => setNotification(null), 3000);
        } else {
          setIsSubscribed(false);
          // Refresh other subscriptions
          const { data: allSubscriptions } = await supabase
            .from("course_subscription")
            .select("course_id")
            .eq("user_id", userId);

          if (allSubscriptions && allSubscriptions.length > 0) {
            const subscribedCourseIds = allSubscriptions.map(s => s.course_id);
            const { data: subscribedCourses } = await supabase
              .from("course")
              .select("id, professor, quarter")
              .in("id", subscribedCourseIds)
              .eq("name", courseName);

            if (subscribedCourses) {
              const others = subscribedCourses
                .filter(c => c.id !== courseId)
                .map(c => ({
                  id: c.id,
                  professor: c.professor,
                  quarter: c.quarter,
                }));
              setOtherSubscriptions(others);
            } else {
              setOtherSubscriptions([]);
            }
          } else {
            setOtherSubscriptions([]);
          }
        }
      }
    } catch (err) {
      console.error("Error toggling subscription:", err);
      setNotification({ message: "An error occurred. Please try again.", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setUpdating(false);
    }
  };

  // Format "Also subscribed to..." message
  const getOtherSubscriptionsMessage = () => {
    if (otherSubscriptions.length === 0) return null;

    const prefix = isSubscribed ? "Also subscribed to" : "Subscribed to";

    if (otherSubscriptions.length === 1) {
      const sub = otherSubscriptions[0];
      const parts: string[] = [];
      if (sub.quarter) parts.push(sub.quarter);
      if (sub.professor) parts.push(`Professor ${sub.professor}`);
      return `${prefix} ${parts.join(", ")}`;
    } else {
      const sub = otherSubscriptions[0];
      const parts: string[] = [];
      if (sub.quarter) parts.push(sub.quarter);
      if (sub.professor) parts.push(`Professor ${sub.professor}`);
      const othersCount = otherSubscriptions.length - 1;
      return `${prefix} ${parts.join(", ")} and ${othersCount} other${othersCount !== 1 ? 's' : ''}`;
    }
  };

  if (loading) {
    return (
      <Button disabled className="w-full rounded-full h-14 px-2">
        Loading...
      </Button>
    );
  }

  const otherSubscriptionsMessage = getOtherSubscriptionsMessage();

  return (
    <div className="space-y-3">
      {/* Subscribe/Unsubscribe Button */}
      <Button
        onClick={handleToggle}
        disabled={updating}
        variant={isSubscribed ? "outline" : "default"}
        className="w-full rounded-full h-14 px-2"
      >
        {updating
          ? "Updating..."
          : isSubscribed
          ? "Unsubscribe"
          : "Subscribe"}
      </Button>
      
      {/* Other subscriptions note */}
      {otherSubscriptionsMessage && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] text-center">
          {otherSubscriptionsMessage}
        </p>
      )}
      
      {notification && (
        <div className="mt-2 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-300">
          {notification.message}
        </div>
      )}
    </div>
  );
}
