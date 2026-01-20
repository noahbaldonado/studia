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
    const { quizId } = body;

    if (!quizId) {
      return NextResponse.json(
        { error: "quizId is required" },
        { status: 400 }
      );
    }

    // Check if interaction already exists
    const { data: existingInteraction, error: checkError } = await supabase
      .from("quiz_interaction")
      .select("quiz_id, interaction_score")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .single();

    // If interaction already exists, no need to create a new one (view-time tracking will update score separately)
    if (existingInteraction) {
      return NextResponse.json({
        success: true,
        quizId,
        message: "Interaction already exists",
      });
    }

    // Create a view-time-only interaction (is_like is NULL, score starts at 0)
    const { error: insertError } = await supabase
      .from("quiz_interaction")
      .insert({
        quiz_id: quizId,
        user_id: user.id,
        is_like: null, // NULL for view-time-only interactions
        interaction_score: 0,  // Start at 0, will be incremented by view time
      });

    if (insertError) {
      // If it's a unique constraint error, that's fine - interaction already exists
      if (insertError.code === "23505") {
        return NextResponse.json({
          success: true,
          quizId,
          message: "Interaction already exists",
        });
      }
      
      console.error("Error creating interaction:", insertError);
      return NextResponse.json(
        { error: "Failed to create interaction" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quizId,
      message: "Interaction marked",
    });
  } catch (error) {
    console.error("Error in mark-interaction route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
