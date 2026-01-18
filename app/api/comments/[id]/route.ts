import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE: Delete a comment
export async function DELETE(
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

    // Verify comment exists and belongs to user
    const { data: comment, error: commentError } = await supabase
      .from("comment")
      .select("id, user_id")
      .eq("id", commentId)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if user owns the comment
    if (comment.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    // Delete all likes/dislikes for this comment first
    await supabase
      .from("comment_like")
      .delete()
      .eq("comment_id", commentId);

    // Delete all child comments (replies) recursively
    const deleteReplies = async (parentId: string) => {
      const { data: replies } = await supabase
        .from("comment")
        .select("id")
        .eq("parent_comment_id", parentId);

      if (replies && replies.length > 0) {
        for (const reply of replies) {
          // Delete likes for reply
          await supabase
            .from("comment_like")
            .delete()
            .eq("comment_id", reply.id);
          // Recursively delete nested replies
          await deleteReplies(reply.id);
        }
      }
    };

    await deleteReplies(commentId);

    // Delete the comment itself
    const { error: deleteError } = await supabase
      .from("comment")
      .delete()
      .eq("id", commentId);

    if (deleteError) {
      console.error("Error deleting comment:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/comments/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT: Update a comment
export async function PUT(
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
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    // Verify comment exists and belongs to user
    const { data: comment, error: commentError } = await supabase
      .from("comment")
      .select("id, user_id")
      .eq("id", commentId)
      .single();

    if (commentError || !comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    // Check if user owns the comment
    if (comment.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only edit your own comments" },
        { status: 403 }
      );
    }

    // Update the comment
    const { data: updatedComment, error: updateError } = await supabase
      .from("comment")
      .update({
        content: content.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating comment:", updateError);
      return NextResponse.json(
        { error: "Failed to update comment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: updatedComment,
    });
  } catch (error) {
    console.error("Error in PUT /api/comments/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
