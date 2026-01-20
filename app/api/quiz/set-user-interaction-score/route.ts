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
    const { quizId, score } = body;

    if (!quizId || score === undefined) {
      return NextResponse.json(
        { error: "quizId and score are required" },
        { status: 400 }
      );
    }

    // Ensure score is capped at 10
    const cappedScore = Math.min(10, Math.max(0, score));

    // Upsert interaction with the specified score
    const { error: upsertError } = await supabase
      .from("quiz_interaction")
      .upsert({
        quiz_id: quizId,
        user_id: user.id,
        interaction_score: cappedScore,
        is_like: null, // Will be set separately for like/dislike
      }, {
        onConflict: "quiz_id,user_id",
      });

    if (upsertError) {
      console.error("Error setting user interaction score:", upsertError);
      return NextResponse.json(
        { error: "Failed to update interaction score" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quizId,
      score: cappedScore,
    });
  } catch (error) {
    console.error("Error in set-user-interaction-score route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
