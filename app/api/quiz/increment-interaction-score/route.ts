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
    const { quizId, increment, markAsInteracted } = body;

    if (!quizId || increment === undefined) {
      return NextResponse.json(
        { error: "quizId and increment are required" },
        { status: 400 }
      );
    }

    // Increment interaction_score atomically
    const { data, error: updateError } = await supabase.rpc("increment_quiz_interaction_score", {
      p_quiz_id: quizId,
      p_increment: increment || 1,
    });

    if (updateError) {
      console.error("Error incrementing interaction score:", updateError);
      
      // Fallback to direct update if RPC doesn't exist
      const { data: currentQuiz, error: fetchError } = await supabase
        .from("quiz")
        .select("interaction_score")
        .eq("id", quizId)
        .single();

      if (fetchError || !currentQuiz) {
        return NextResponse.json(
          { error: "Quiz not found" },
          { status: 404 }
        );
      }

      const newScore = (currentQuiz.interaction_score || 0) + (increment || 1);
      const { error: directUpdateError } = await supabase
        .from("quiz")
        .update({ interaction_score: newScore })
        .eq("id", quizId);

      if (directUpdateError) {
        return NextResponse.json(
          { error: "Failed to update interaction score" },
          { status: 500 }
        );
      }
    }

    // Mark as interacted if requested (for actions like answering quiz, flipping flashcard, voting on poll)
    if (markAsInteracted) {
      // Check if interaction already exists
      const { data: existingInteraction } = await supabase
        .from("quiz_interaction")
        .select("quiz_id")
        .eq("quiz_id", quizId)
        .eq("user_id", user.id)
        .single();

      // Only create if it doesn't exist
      if (!existingInteraction) {
        await supabase
          .from("quiz_interaction")
          .insert({
            quiz_id: quizId,
            user_id: user.id,
            is_like: null, // NULL for non-like/dislike interactions
          });
      }
    }

    return NextResponse.json({
      success: true,
      quizId,
    });
  } catch (error) {
    console.error("Error in increment-interaction-score route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
