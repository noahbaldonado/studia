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
    const { quizId, increment } = body;

    if (!quizId || increment === undefined) {
      return NextResponse.json(
        { error: "quizId and increment are required" },
        { status: 400 }
      );
    }

    // Increment user's interaction score atomically with capping at 10
    const { data, error: rpcError } = await supabase.rpc("increment_user_interaction_score", {
      p_quiz_id: quizId,
      p_user_id: user.id,
      p_increment: increment,
    });

    if (rpcError) {
      console.error("Error incrementing user interaction score:", rpcError);
      return NextResponse.json(
        { error: "Failed to update interaction score" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quizId,
      newScore: data,
    });
  } catch (error) {
    console.error("Error in update-user-interaction-score route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
