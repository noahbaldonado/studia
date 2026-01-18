import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    const { score } = body;

    if (score === undefined || score < 0) {
      return NextResponse.json(
        { error: "score is required and must be non-negative" },
        { status: 400 }
      );
    }

    // Get current profile metadata
    const { data: profileData, error: profileFetchError } = await supabase
      .from("profile")
      .select("metadata")
      .eq("id", user.id)
      .single();

    if (profileFetchError) {
      console.error("Error fetching profile:", profileFetchError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    const metadata = (profileData?.metadata as any) || {};
    const currentBestScore = metadata.puzzle_rush_best_score || 0;

    // Update best score if this is higher
    const updatedMetadata = {
      ...metadata,
      puzzle_rush_best_score: Math.max(currentBestScore, score),
    };

    // Update profile metadata
    const { error: updateError } = await supabase
      .from("profile")
      .update({ metadata: updatedMetadata })
      .eq("id", user.id);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      score,
      bestScore: updatedMetadata.puzzle_rush_best_score,
    });
  } catch (error) {
    console.error("Error in save-score route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
