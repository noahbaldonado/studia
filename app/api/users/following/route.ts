import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || user.id;
    const type = searchParams.get("type") || "following"; // "following" or "followers"

    if (type === "following") {
      // Get users that this user is following
      const { data: follows, error: followError } = await supabase
        .from("follow")
        .select("following_id")
        .eq("follower_id", userId);

      if (followError) {
        console.error("Error fetching following:", followError);
        return NextResponse.json({ error: "Failed to fetch following" }, { status: 500 });
      }

      const followingIds = (follows || []).map((f) => f.following_id);

      if (followingIds.length === 0) {
        return NextResponse.json({ users: [] });
      }

      // Get profile data for following users
      const { data: profiles, error: profileError } = await supabase
        .from("profile")
        .select("id, metadata")
        .in("id", followingIds);

      if (profileError) {
        console.error("Error fetching profiles:", profileError);
        return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
      }

      const users = (profiles || []).map((profile) => {
        const metadata = profile.metadata as any;
        return {
          id: profile.id,
          name: metadata?.name || `User ${profile.id.substring(0, 8)}`,
          email: metadata?.email || null,
        };
      });

      return NextResponse.json({ users });
    } else {
      // Get users that follow this user (followers)
      const { data: follows, error: followError } = await supabase
        .from("follow")
        .select("follower_id")
        .eq("following_id", userId);

      if (followError) {
        console.error("Error fetching followers:", followError);
        return NextResponse.json({ error: "Failed to fetch followers" }, { status: 500 });
      }

      const followerIds = (follows || []).map((f) => f.follower_id);

      if (followerIds.length === 0) {
        return NextResponse.json({ users: [] });
      }

      // Get profile data for followers
      const { data: profiles, error: profileError } = await supabase
        .from("profile")
        .select("id, metadata")
        .in("id", followerIds);

      if (profileError) {
        console.error("Error fetching profiles:", profileError);
        return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
      }

      const users = (profiles || []).map((profile) => {
        const metadata = profile.metadata as any;
        return {
          id: profile.id,
          name: metadata?.name || `User ${profile.id.substring(0, 8)}`,
          email: metadata?.email || null,
        };
      });

      return NextResponse.json({ users });
    }
  } catch (error) {
    console.error("Error in following route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
