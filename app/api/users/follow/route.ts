import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { followingId } = body;

    if (!followingId || typeof followingId !== "string") {
      return NextResponse.json({ error: "Invalid followingId" }, { status: 400 });
    }

    if (followingId === user.id) {
      return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
    }

    // Check if already following
    const { data: existingFollow } = await supabase
      .from("follow")
      .select("follower_id, following_id")
      .eq("follower_id", user.id)
      .eq("following_id", followingId)
      .maybeSingle();

    if (existingFollow) {
      return NextResponse.json({ message: "Already following", following: true });
    }

    // Create follow relationship
    const { error: followError } = await supabase
      .from("follow")
      .insert({
        follower_id: user.id,
        following_id: followingId,
      });

    if (followError) {
      console.error("Error following user:", followError);
      return NextResponse.json({ error: "Failed to follow user" }, { status: 500 });
    }

    return NextResponse.json({ message: "Successfully followed", following: true });
  } catch (error) {
    console.error("Error in follow route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const followingId = searchParams.get("followingId");

    if (!followingId) {
      return NextResponse.json({ error: "followingId is required" }, { status: 400 });
    }

    // Delete follow relationship
    const { error: unfollowError } = await supabase
      .from("follow")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", followingId);

    if (unfollowError) {
      console.error("Error unfollowing user:", unfollowError);
      return NextResponse.json({ error: "Failed to unfollow user" }, { status: 500 });
    }

    return NextResponse.json({ message: "Successfully unfollowed", following: false });
  } catch (error) {
    console.error("Error in unfollow route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
