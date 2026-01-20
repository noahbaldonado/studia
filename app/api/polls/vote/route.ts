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
    const { quizId, optionIndex } = body;

    if (quizId === undefined || optionIndex === undefined) {
      return NextResponse.json(
        { error: "quizId and optionIndex are required" },
        { status: 400 }
      );
    }

    // Verify the quiz exists and is a poll
    const { data: quiz, error: quizError } = await supabase
      .from("quiz")
      .select("data")
      .eq("id", quizId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "Poll not found" },
        { status: 404 }
      );
    }

    const quizData = quiz.data as { type?: string; content?: { options?: string[] } };
    if (quizData.type !== "poll") {
      return NextResponse.json(
        { error: "This is not a poll" },
        { status: 400 }
      );
    }

    const options = quizData.content?.options || [];
    if (optionIndex < 0 || optionIndex >= options.length) {
      return NextResponse.json(
        { error: "Invalid option index" },
        { status: 400 }
      );
    }

    // Check if user already voted
    const { data: existingVote, error: checkError } = await supabase
      .from("poll_vote")
      .select("id, option_index")
      .eq("quiz_id", quizId)
      .eq("user_id", user.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned, which is fine
      console.error("Error checking existing vote:", checkError);
      return NextResponse.json(
        { error: "Error checking vote" },
        { status: 500 }
      );
    }

    if (existingVote) {
      // Update existing vote
      const { error: updateError } = await supabase
        .from("poll_vote")
        .update({ option_index: optionIndex })
        .eq("id", existingVote.id);

      if (updateError) {
        console.error("Error updating vote:", updateError);
        return NextResponse.json(
          { error: "Failed to update vote" },
          { status: 500 }
        );
      }
    } else {
      // Create new vote
      const { error: insertError } = await supabase
        .from("poll_vote")
        .insert({
          quiz_id: quizId,
          user_id: user.id,
          option_index: optionIndex,
        });

      if (insertError) {
        console.error("Error inserting vote:", insertError);
        return NextResponse.json(
          { error: "Failed to save vote" },
          { status: 500 }
        );
      }
    }

    // Get updated vote counts
    const { data: votes, error: votesError } = await supabase
      .from("poll_vote")
      .select("option_index")
      .eq("quiz_id", quizId);

    if (votesError) {
      console.error("Error fetching votes:", votesError);
      // Still return success even if we can't get counts
      return NextResponse.json({ success: true, updated: true });
    }

    // Count votes per option
    const voteCounts = options.map((_, index) => 
      votes?.filter(v => v.option_index === index).length || 0
    );
    const totalVotes = votes?.length || 0;

    return NextResponse.json({
      success: true,
      updated: !!existingVote,
      voteCounts,
      totalVotes,
      userVote: optionIndex,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error("Error in poll vote route:", err.message || error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
