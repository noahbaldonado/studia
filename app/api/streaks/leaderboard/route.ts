import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatUsername } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type") || "global"; // "global" or "friends"

    if (type === "friends") {
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
      
      // Always include the current user in the friends leaderboard
      const userIdsToFetch = [...new Set([...followingIds, user.id])];

      if (userIdsToFetch.length === 0) {
        return NextResponse.json({ leaderboard: [] });
      }

      // Get profiles of friends (including current user) with daily streaks
      const { data: profiles, error: profileError } = await supabase
        .from("profile")
        .select("id, metadata, username")
        .in("id", userIdsToFetch);

      if (profileError) {
        console.error("Error fetching profiles:", profileError);
        return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
      }

      // Build leaderboard from friends (including current user)
      const leaderboard = (profiles || [])
        .map((profile) => {
          const metadata = profile.metadata as { current_streak?: number | string; name?: string; [key: string]: unknown };
          // Handle both number and string types for streak
          const streak = typeof metadata?.current_streak === 'number' 
            ? metadata.current_streak 
            : typeof metadata?.current_streak === 'string'
            ? parseInt(metadata.current_streak) || 0
            : 0;
          const displayName = profile.username
            ? formatUsername(profile.username)
            : metadata?.name || `User ${profile.id.substring(0, 8)}`;
          return {
            id: profile.id,
            name: displayName,
            streak: streak,
          };
        })
        .filter((entry) => entry.streak > 0) // Only include users with streaks
        .sort((a, b) => b.streak - a.streak) // Sort by streak descending
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

      return NextResponse.json({ leaderboard });
    } else {
      // Global leaderboard - get all profiles with daily streaks
      const { data: profiles, error: profileError } = await supabase
        .from("profile")
        .select("id, metadata, username");

      if (profileError) {
        console.error("Error fetching profiles:", profileError);
        return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
      }

      // Build global leaderboard
      const leaderboard = (profiles || [])
        .map((profile) => {
          const metadata = profile.metadata as { current_streak?: number | string; name?: string; [key: string]: unknown };
          // Handle both number and string types for streak
          const streak = typeof metadata?.current_streak === 'number' 
            ? metadata.current_streak 
            : typeof metadata?.current_streak === 'string'
            ? parseInt(metadata.current_streak) || 0
            : 0;
          const displayName = profile.username
            ? formatUsername(profile.username)
            : metadata?.name || `User ${profile.id.substring(0, 8)}`;
          return {
            id: profile.id,
            name: displayName,
            streak: streak,
          };
        })
        .filter((entry) => entry.streak > 0) // Only include users with streaks
        .sort((a, b) => b.streak - a.streak) // Sort by streak descending
        .slice(0, 100) // Limit to top 100
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

      return NextResponse.json({ leaderboard });
    }
  } catch (error) {
    console.error("Error in streaks leaderboard route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
