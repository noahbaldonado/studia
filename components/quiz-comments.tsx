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
    <div className="mt-4 border-t border-gray-200 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 w-full text-left"
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
        <div className="mt-4 space-y-4">
          {/* Comment form */}
          <div className="space-y-2">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Write a comment..."
              className="w-full p-3 bg-white text-gray-900 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
              rows={3}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentContent.trim() || isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? "Posting..." : "Post Comment"}
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-red-600 text-sm">{error}</div>
          )}

          {/* Comments list */}
          {isLoading ? (
            <div className="text-center py-4 text-gray-500">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No comments yet. Be the first to comment!</div>
          ) : (
            <div className="space-y-3">
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    quizId={quizId}
                    onLikeChange={handleLikeChange}
                    onReply={() => {}} // Handled within CommentItem
                    onReplyAdded={loadComments}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
