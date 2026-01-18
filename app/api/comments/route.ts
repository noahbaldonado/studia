import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET: Fetch comments for a quiz with nested structure
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const quizId = searchParams.get("quiz_id");

    if (!quizId) {
      return NextResponse.json(
        { error: "quiz_id is required" },
        { status: 400 }
      );
    }

    // Fetch all comments for this quiz
    const { data: comments, error: commentsError } = await supabase
      .from("comment")
      .select(`
        id,
        content,
        parent_comment_id,
        created_at,
        updated_at,
        user_id
      `)
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: true });

    if (commentsError) {
      console.error("Error fetching comments:", commentsError);
      return NextResponse.json(
        { error: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    // Fetch like/dislike counts for all comments
    const commentIds = comments?.map((c) => c.id) || [];
    let commentLikes: Record<string, { likes: number; dislikes: number; userLike: boolean | null }> = {};

    if (commentIds.length > 0) {
      const { data: likesData, error: likesError } = await supabase
        .from("comment_like")
        .select("comment_id, is_like, user_id")
        .in("comment_id", commentIds);

      if (!likesError && likesData) {
        // Calculate net likes for each comment
        commentIds.forEach((commentId) => {
          const likes = likesData.filter(
            (l) => l.comment_id === commentId && l.is_like === true
          ).length;
          const dislikes = likesData.filter(
            (l) => l.comment_id === commentId && l.is_like === false
          ).length;
          const userLike = likesData.find(
            (l) => l.comment_id === commentId && l.user_id === user.id
          )?.is_like ?? null;

          commentLikes[commentId] = {
            likes,
            dislikes,
            userLike,
          };
        });
      }
    }

    // Fetch user profiles for author names
    const userIds = [...new Set(comments?.map((c) => c.user_id) || [])];
    const { data: profiles } = await supabase
      .from("profile")
      .select("id, metadata")
      .in("id", userIds);

    const profileMap = new Map(
      profiles?.map((p) => [p.id, p]) || []
    );

    // Build nested structure (top-level comments with replies)
    const commentsMap = new Map(
      comments?.map((c) => {
        const profile = profileMap.get(c.user_id);
        const authorName =
          (profile?.metadata as any)?.name ||
          (profile?.metadata as any)?.email ||
          `User ${c.user_id.substring(0, 8)}`;

        return [
          c.id,
          {
            ...c,
            authorName,
            netLikes:
              (commentLikes[c.id]?.likes || 0) -
              (commentLikes[c.id]?.dislikes || 0),
            userLike: commentLikes[c.id]?.userLike ?? null,
            replies: [] as any[],
            userId: c.user_id, // Include user_id for ownership checks
          },
        ];
      }) || []
    );

    // Build nested structure
    const topLevelComments: any[] = [];
    commentsMap.forEach((comment) => {
      if (comment.parent_comment_id) {
        // This is a reply, add it to parent's replies
        const parent = commentsMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(comment);
        }
      } else {
        // Top-level comment
        topLevelComments.push(comment);
      }
    });

    return NextResponse.json({
      success: true,
      comments: topLevelComments,
    });
  } catch (error) {
    console.error("Error in GET /api/comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST: Create a new comment or reply
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
    const { quiz_id, content, parent_comment_id } = body;

    if (!quiz_id || !content || !content.trim()) {
      return NextResponse.json(
        { error: "quiz_id and content are required" },
        { status: 400 }
      );
    }

    // Verify quiz exists
    const { data: quiz, error: quizError } = await supabase
      .from("quiz")
      .select("id")
      .eq("id", quiz_id)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    // If parent_comment_id is provided, verify it exists and belongs to same quiz
    if (parent_comment_id) {
      const { data: parentComment, error: parentError } = await supabase
        .from("comment")
        .select("id, quiz_id")
        .eq("id", parent_comment_id)
        .single();

      if (parentError || !parentComment || parentComment.quiz_id !== quiz_id) {
        return NextResponse.json(
          { error: "Parent comment not found or invalid" },
          { status: 400 }
        );
      }
    }

    // Get user's profile for author name
    const { data: profile } = await supabase
      .from("profile")
      .select("metadata")
      .eq("id", user.id)
      .single();

    // Insert comment
    const { data: newComment, error: insertError } = await supabase
      .from("comment")
      .insert({
        quiz_id,
        user_id: user.id,
        content: content.trim(),
        parent_comment_id: parent_comment_id || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating comment:", insertError);
      return NextResponse.json(
        { error: "Failed to create comment" },
        { status: 500 }
      );
    }

    const authorName =
      (profile?.metadata as any)?.name ||
      (profile?.metadata as any)?.email ||
      user.email ||
      `User ${user.id.substring(0, 8)}`;

    return NextResponse.json({
      success: true,
      comment: {
        ...newComment,
        authorName,
        netLikes: 0,
        userLike: null,
        replies: [],
      },
    });
  } catch (error) {
    console.error("Error in POST /api/comments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
