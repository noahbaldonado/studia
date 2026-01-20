import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatUsername } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all users that the current user is following
    const { data: follows, error: followError } = await supabase
      .from("follow")
      .select("following_id")
      .eq("follower_id", user.id);

    if (followError) {
      console.error("Error fetching following:", followError);
      return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
    }

    const followingIds = (follows || []).map((f) => f.following_id);

    if (followingIds.length === 0) {
      return NextResponse.json({ courseFollowing: {} });
    }

    // Get all course subscriptions for users that the current user is following
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("course_subscription")
      .select("course_id, user_id")
      .in("user_id", followingIds);

    if (subscriptionError) {
      console.error("Error fetching subscriptions:", subscriptionError);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    // Build a map: course_id -> array of user_ids (following users subscribed to this course)
    const courseFollowing: Record<string, string[]> = {};

    (subscriptions || []).forEach((sub) => {
      if (!courseFollowing[sub.course_id]) {
        courseFollowing[sub.course_id] = [];
      }
      courseFollowing[sub.course_id].push(sub.user_id);
    });

    // Get profile data for the following users to include names
    const allFollowingUserIds = [...new Set(followingIds)];
    const { data: profiles, error: profileError } = await supabase
      .from("profile")
      .select("id, metadata, username")
      .in("id", allFollowingUserIds);

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      // Continue without profile data
    }

    const profileMap = new Map(
      (profiles || []).map((p) => {
        const metadata = p.metadata as { name?: string; email?: string; [key: string]: unknown };
        const displayName = p.username
          ? formatUsername(p.username)
          : metadata?.name || `User ${p.id.substring(0, 8)}`;
        return [
          p.id,
          {
            name: displayName,
            email: metadata?.email || null,
          },
        ];
      })
    );

    // Build response with user details
    const courseFollowingWithDetails: Record<
      string,
      Array<{ id: string; name: string; email: string | null }>
    > = {};

    Object.entries(courseFollowing).forEach(([courseId, userIds]) => {
      courseFollowingWithDetails[courseId] = userIds.map((userId) => {
        const profile = profileMap.get(userId);
        return {
          id: userId,
          name: profile?.name || `User ${userId.substring(0, 8)}`,
          email: profile?.email || null,
        };
      });
    });

    return NextResponse.json({ courseFollowing: courseFollowingWithDetails });
  } catch (error) {
    console.error("Error in following-subscriptions route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
