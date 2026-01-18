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
    const { quizId, ratingChange } = body;

    if (!quizId || ratingChange === undefined) {
      return NextResponse.json(
        { error: "quizId and ratingChange are required" },
        { status: 400 }
      );
    }

    // Verifica che ratingChange sia valido
    if (ratingChange !== 1 && ratingChange !== -1) {
      return NextResponse.json(
        { error: "ratingChange must be 1 or -1" },
        { status: 400 }
      );
    }

    // Ottieni il rating corrente
    const { data: currentQuiz, error: fetchError } = await supabase
      .from("quiz")
      .select("rating")
      .eq("id", quizId)
      .single();

    if (fetchError || !currentQuiz) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    // Calcola il nuovo rating
    const newRating = (currentQuiz.rating || 0) + ratingChange;

    // Aggiorna il rating nel database
    const { data, error: updateError } = await supabase
      .from("quiz")
      .update({ rating: newRating })
      .eq("id", quizId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating rating:", updateError);
      return NextResponse.json(
        { error: "Failed to update rating" },
        { status: 500 }
      );
    }

    // Update tag scores: ±0.2 for each tag associated with this quiz
    const tagScoreChange = ratingChange * 0.2;
    
    // Fetch all tag IDs associated with this quiz
    const { data: quizTags, error: quizTagsError } = await supabase
      .from("quiz_tag")
      .select("tag_id")
      .eq("quiz_id", quizId);

    if (quizTagsError) {
      console.error("Error fetching quiz tags:", quizTagsError);
      // Continue even if tag fetch fails - rating update was successful
    } else if (quizTags && quizTags.length > 0) {
      const tagIds = quizTags.map((qt) => qt.tag_id);
      
      // Update tag scores using RPC function for atomic updates
      const { error: tagUpdateError } = await supabase.rpc("increment_tag_scores", {
        tag_ids: tagIds,
        score_delta: tagScoreChange,
      });

      if (tagUpdateError) {
        console.error("Error updating tag scores:", tagUpdateError);
        // Continue even if tag score update fails - rating update was successful
      }
    }

    return NextResponse.json({
      success: true,
      quizId,
      newRating,
    });
  } catch (error) {
    console.error("Error in update-rating route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
