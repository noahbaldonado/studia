"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { CommentItem } from "./comment-item";
import { MessageSquare, Send } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  netLikes: number;
  userLike: boolean | null;
  created_at: string;
  replies: Comment[];
  userId?: string; // Add userId for ownership checks
}

interface QuizCommentsProps {
  quizId: string;
}

export function QuizComments({ quizId }: QuizCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentCount, setCommentCount] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  // Reset state when quizId changes (user swiped to a different card)
  useEffect(() => {
    setIsExpanded(false);
    setComments([]);
    setCommentContent("");
    setError(null);
    setCommentCount(0);
  }, [quizId]);

  // Fetch comment count when quizId changes (even when collapsed)
  useEffect(() => {
    const fetchCommentCount = async () => {
      setIsLoadingCount(true);
      try {
        const response = await fetch(`/api/comments?quiz_id=${quizId}`);
        if (response.ok) {
          const data = await response.json();
          const total = (data.comments || []).reduce(
            (count: number, comment: Comment) => count + 1 + comment.replies.length,
            0
          );
          setCommentCount(total);
        }
      } catch (err) {
        console.error("Error loading comment count:", err);
      } finally {
        setIsLoadingCount(false);
      }
    };

    fetchCommentCount();
  }, [quizId]);

  const loadComments = useCallback(async () => {
    if (!isExpanded) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/comments?quiz_id=${quizId}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        // Update count from loaded comments
        const total = (data.comments || []).reduce(
          (count: number, comment: Comment) => count + 1 + comment.replies.length,
          0
        );
        setCommentCount(total);
      } else {
        setError("Failed to load comments");
      }
    } catch (err) {
      console.error("Error loading comments:", err);
      setError("Failed to load comments");
    } finally {
      setIsLoading(false);
    }
  }, [quizId, isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      loadComments();
    }
  }, [isExpanded, loadComments]);

  const handleLikeChange = useCallback(
    (commentId: string, netLikes: number, userLike: boolean | null) => {
      const updateComment = (commentList: Comment[]): Comment[] => {
        return commentList.map((comment) => {
          if (comment.id === commentId) {
            return { ...comment, netLikes, userLike };
          }
          if (comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateComment(comment.replies),
            };
          }
          return comment;
        });
      };
      setComments(updateComment(comments));
    },
    [comments]
  );

  const handleCommentDeleted = useCallback(
    (commentId: string) => {
      const removeComment = (commentList: Comment[]): Comment[] => {
        return commentList
          .filter((comment) => comment.id !== commentId)
          .map((comment) => ({
            ...comment,
            replies: removeComment(comment.replies),
          }));
      };
      setComments(removeComment(comments));
      // Reload to update count
      loadComments();
    },
    [comments, loadComments]
  );

  const handleCommentUpdated = useCallback(
    (commentId: string, newContent: string) => {
      const updateComment = (commentList: Comment[]): Comment[] => {
        return commentList.map((comment) => {
          if (comment.id === commentId) {
            return { ...comment, content: newContent };
          }
          if (comment.replies.length > 0) {
            return {
              ...comment,
              replies: updateComment(comment.replies),
            };
          }
          return comment;
        });
      };
      setComments(updateComment(comments));
    },
    [comments]
  );

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quizId,
          content: commentContent.trim(),
        }),
      });

      if (response.ok) {
        setCommentContent("");
        // Reload comments (which will update the count)
        await loadComments();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to post comment");
      }
    } catch (err) {
      console.error("Error submitting comment:", err);
      setError("Failed to post comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-xs font-medium text-[hsl(var(--primary))] hover:text-[hsl(var(--accent))] w-full text-left"
      >
        <MessageSquare className="w-4 h-4" />
        <span>
          {isLoadingCount ? (
            "..."
          ) : (
            <>
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </>
          )}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Comment form */}
          <div className="space-y-2">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-2.5 bg-[hsl(var(--secondary))] text-foreground border border-[hsl(var(--border))] resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] placeholder:text-[hsl(var(--muted-foreground))] text-xs"
              rows={3}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentContent.trim() || isSubmitting}
              className="flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--primary))] text-[hsl(var(--background))] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? "Posting..." : "Post Comment"}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-[hsl(var(--destructive))] text-xs">{error}</div>
          )}

          {/* Comments list */}
          {isLoading ? (
            <div className="text-center py-3 text-[hsl(var(--muted-foreground))] text-xs">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-3 text-[hsl(var(--muted-foreground))] text-xs">No comments yet. Be the first to comment!</div>
          ) : (
            <div className="space-y-2.5">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    quizId={quizId}
                    onLikeChange={handleLikeChange}
                    onReply={() => {}} // Handled within CommentItem
                    onReplyAdded={loadComments}
                    onCommentDeleted={handleCommentDeleted}
                    onCommentUpdated={handleCommentUpdated}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
