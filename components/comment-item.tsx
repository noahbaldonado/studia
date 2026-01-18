"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThumbsUp, ThumbsDown, Reply, ChevronDown, ChevronRight } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  netLikes: number;
  userLike: boolean | null;
  created_at: string;
  replies: Comment[];
}

interface CommentItemProps {
  comment: Comment;
  quizId: string;
  onLikeChange: (commentId: string, netLikes: number, userLike: boolean | null) => void;
  onReply: (parentCommentId: string) => void;
  onReplyAdded?: () => void;
  depth?: number;
}

export function CommentItem({
  comment,
  quizId,
  onLikeChange,
  onReply,
  onReplyAdded,
  depth = 0,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isLiking, setIsLiking] = useState(false);

  const supabase = createClient();

  const handleLike = async (isLike: boolean) => {
    if (isLiking) return;

    setIsLiking(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_like: isLike }),
      });

      if (response.ok) {
        const data = await response.json();
        onLikeChange(comment.id, data.netLikes, data.userLike);
      }
    } catch (error) {
      console.error("Error liking comment:", error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quizId,
          content: replyContent.trim(),
          parent_comment_id: comment.id,
        }),
      });

      if (response.ok) {
        setReplyContent("");
        setIsReplying(false);
        // Notify parent to reload comments
        if (onReplyAdded) {
          onReplyAdded();
        }
      }
    } catch (error) {
      console.error("Error submitting reply:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const maxDepth = 3; // Limit display depth to avoid too much nesting
  const canShowReplies = depth < maxDepth && comment.replies.length > 0;

  return (
    <div className={`${depth > 0 ? "ml-6 mt-3 border-l-2 border-gray-200 pl-4" : ""}`}>
      <div className="bg-gray-50 rounded-lg p-3">
        {/* Author and timestamp */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold text-sm text-gray-900">
            {comment.authorName}
          </span>
          <span className="text-xs text-gray-500">
            {formatTimeAgo(comment.created_at)}
          </span>
        </div>

        {/* Comment content */}
        <p className="text-gray-800 mb-3 whitespace-pre-wrap">{comment.content}</p>

        {/* Like/Dislike and Reply buttons */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleLike(true)}
              disabled={isLiking}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                comment.userLike === true
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[2rem] text-center">
              {comment.netLikes}
            </span>
            <button
              onClick={() => handleLike(false)}
              disabled={isLiking}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                comment.userLike === false
                  ? "text-red-600 bg-red-50"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>

          {depth < maxDepth && (
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Reply className="w-4 h-4" />
              Reply
            </button>
          )}
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-3 space-y-2">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSubmitReply}
                disabled={!replyContent.trim() || isSubmitting}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isSubmitting ? "Posting..." : "Post Reply"}
              </button>
              <button
                onClick={() => {
                  setIsReplying(false);
                  setReplyContent("");
                }}
                className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {canShowReplies && (
        <div className="mt-2">
          {showReplies ? (
            <>
              <button
                onClick={() => setShowReplies(false)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 mb-2"
              >
                <ChevronDown className="w-4 h-4" />
                Hide {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
              </button>
              <div className="space-y-2">
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    quizId={quizId}
                    onLikeChange={onLikeChange}
                    onReply={onReply}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowReplies(true)}
              className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
            >
              <ChevronRight className="w-4 h-4" />
              Show {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
