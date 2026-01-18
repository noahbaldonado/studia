import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's course subscriptions
    const { data: mySubscriptions, error: mySubsError } = await supabase
      .from("course_subscription")
      .select("course_id")
      .eq("user_id", user.id);

    if (mySubsError) {
      console.error("Error fetching user subscriptions:", mySubsError);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    // If user has no subscriptions, return empty list
    if (!mySubscriptions || mySubscriptions.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const myCourseIds = mySubscriptions.map((s) => s.course_id);

    // Get all users subscribed to the same courses (excluding current user)
    const { data: allSubscriptions, error: allSubsError } = await supabase
      .from("course_subscription")
      .select("user_id, course_id")
      .in("course_id", myCourseIds)
      .neq("user_id", user.id);

    if (allSubsError) {
      console.error("Error fetching all subscriptions:", allSubsError);
      return NextResponse.json({ error: "Failed to fetch subscriptions" }, { status: 500 });
    }

    // Get users already being followed (to exclude them)
    const { data: follows, error: followError } = await supabase
      .from("follow")
      .select("following_id")
      .eq("follower_id", user.id);

    if (followError) {
      console.error("Error fetching following:", followError);
      return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
    }

    const followingIds = new Set((follows || []).map((f) => f.following_id));

    // Count mutual courses for each user
    const mutualCounts = new Map<string, number>();

    (allSubscriptions || []).forEach((sub) => {
      // Only count users not already followed
      if (!followingIds.has(sub.user_id)) {
        const current = mutualCounts.get(sub.user_id) || 0;
        mutualCounts.set(sub.user_id, current + 1);
      }
    });

    // If no users with mutual courses, return empty list
    if (mutualCounts.size === 0) {
      return NextResponse.json({ users: [] });
    }

    // Sort by mutual count (descending) and get user IDs
    const sortedUsers = Array.from(mutualCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([userId, count]) => ({ userId, mutualCount: count }));

    const userIds = sortedUsers.map((u) => u.userId);

    // Get profile info for these users
    const { data: profiles, error: profileError } = await supabase
      .from("profile")
      .select("id, metadata")
      .in("id", userIds);

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
    }

    // Create a map for quick lookup
    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p])
    );

    // Combine and return results
    const results = sortedUsers
      .map(({ userId, mutualCount }) => {
        const profile = profileMap.get(userId);
        const metadata = profile?.metadata as any;
        return {
          id: userId,
          name: metadata?.name || `User ${userId.substring(0, 8)}`,
          email: metadata?.email || null,
          mutualCourses: mutualCount,
        };
      })
      .filter((u) => u.name); // Filter out any invalid entries

    return NextResponse.json({ users: results });
  } catch (error) {
    console.error("Error in suggested-friends route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
