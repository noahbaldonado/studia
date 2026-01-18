import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: commentId } = await params;
    const body = await request.json();
    const { is_like } = body;

    if (is_like === undefined || typeof is_like !== "boolean") {
      return NextResponse.json(
        { error: "is_like (boolean) is required" },
        { status: 400 }
      );
    }

    // Verify comment exists
    const { data: comment, error: commentError } = await supabase
      .from("comment")
      .select("id")
      .eq("id", commentId)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if user already liked/disliked this comment
    const { data: existingLike, error: likeCheckError } = await supabase
      .from("comment_like")
      .select("is_like")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .single();

    if (likeCheckError && likeCheckError.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is fine
      console.error("Error checking existing like:", likeCheckError);
      return NextResponse.json(
        { error: "Failed to check existing like" },
        { status: 500 }
      );
    }

    let netLikes: number;

    if (existingLike) {
      // User already liked/disliked
      if (existingLike.is_like === is_like) {
        // Same action - remove the like/dislike
        const { error: deleteError } = await supabase
          .from("comment_like")
          .delete()
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        if (deleteError) {
          console.error("Error removing like:", deleteError);
          return NextResponse.json(
            { error: "Failed to remove like" },
            { status: 500 }
          );
        }

        // Recalculate net likes
        const { data: allLikes } = await supabase
          .from("comment_like")
          .select("is_like")
          .eq("comment_id", commentId);

        const likes = allLikes?.filter((l) => l.is_like === true).length || 0;
        const dislikes =
          allLikes?.filter((l) => l.is_like === false).length || 0;
        netLikes = likes - dislikes;
      } else {
        // Different action - update the like/dislike
        const { error: updateError } = await supabase
          .from("comment_like")
          .update({ is_like })
          .eq("comment_id", commentId)
          .eq("user_id", user.id);

        if (updateError) {
          console.error("Error updating like:", updateError);
          return NextResponse.json(
            { error: "Failed to update like" },
            { status: 500 }
          );
        }

        // Recalculate net likes
        const { data: allLikes } = await supabase
          .from("comment_like")
          .select("is_like")
          .eq("comment_id", commentId);

        const likes = allLikes?.filter((l) => l.is_like === true).length || 0;
        const dislikes =
          allLikes?.filter((l) => l.is_like === false).length || 0;
        netLikes = likes - dislikes;
      }
    } else {
      // No existing like - create new one
      const { error: insertError } = await supabase
        .from("comment_like")
        .insert({
          comment_id: commentId,
          user_id: user.id,
          is_like,
        });

      if (insertError) {
        console.error("Error creating like:", insertError);
        return NextResponse.json(
          { error: "Failed to create like" },
          { status: 500 }
        );
      }

      // Recalculate net likes
      const { data: allLikes } = await supabase
        .from("comment_like")
        .select("is_like")
        .eq("comment_id", commentId);

      const likes = allLikes?.filter((l) => l.is_like === true).length || 0;
      const dislikes =
        allLikes?.filter((l) => l.is_like === false).length || 0;
      netLikes = likes - dislikes;
    }

    return NextResponse.json({
      success: true,
      commentId,
      netLikes,
      userLike: existingLike?.is_like === is_like ? null : is_like,
    });
  } catch (error) {
    console.error("Error in POST /api/comments/[id]/like:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
