import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeUsername, validateUsername } from "@/lib/utils";

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { username: rawUsername } = body;

    if (!rawUsername || typeof rawUsername !== "string") {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 }
      );
    }

    // Normalize username (remove @ if present, preserve case)
    const username = normalizeUsername(rawUsername.trim());

    // Validate username format
    const validation = validateUsername(username);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Check if username is already taken (by another user) - case-insensitive
    // The unique index on LOWER(username) enforces case-insensitive uniqueness
    // We check using ilike for case-insensitive matching
    const { data: existingProfiles, error: checkError } = await supabase
      .from("profile")
      .select("id, username")
      .ilike("username", username)
      .limit(1);
    
    if (checkError) {
      console.error("Error checking username:", checkError);
      return NextResponse.json(
        { error: "Failed to check username availability" },
        { status: 500 }
      );
    }

    const existingProfile = existingProfiles?.[0];

    if (existingProfile && existingProfile.id !== user.id) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 409 }
      );
    }

    // Update username
    const { error: updateError } = await supabase
      .from("profile")
      .update({ username })
      .eq("id", user.id);

    if (updateError) {
      // Handle unique constraint violation
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "Username is already taken" },
          { status: 409 }
        );
      }
      
      console.error("Error updating username:", updateError);
      return NextResponse.json(
        { error: "Failed to update username" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, username });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Error in update-username route:", err.message || error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
