"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThumbsUp, ThumbsDown, Reply, ChevronDown, ChevronRight, Edit2, Trash2, X, Check, User } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorProfilePictureUrl?: string | null;
  netLikes: number;
  userLike: boolean | null;
  created_at: string;
  replies: Comment[];
  userId?: string; // Add userId for ownership checks
}

interface CommentItemProps {
  comment: Comment;
  quizId: string;
  onLikeChange: (commentId: string, netLikes: number, userLike: boolean | null) => void;
  onReply: (parentCommentId: string) => void;
  onReplyAdded?: () => void;
  onCommentDeleted?: (commentId: string) => void;
  onCommentUpdated?: (commentId: string, newContent: string) => void;
  depth?: number;
}

export function CommentItem({
  comment,
  quizId,
  onLikeChange,
  onReply,
  onReplyAdded,
  onCommentDeleted,
  onCommentUpdated,
  depth = 0,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const supabase = createClient();

  // Get current user ID
  useEffect(() => {
    async function getCurrentUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    }
    getCurrentUser();
  }, [supabase]);

  // Update editContent when comment content changes
  useEffect(() => {
    if (!isEditing) {
      setEditContent(comment.content);
    }
  }, [comment.content, isEditing]);

  const isOwner = currentUserId && comment.userId === currentUserId;

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

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setShowDeleteConfirm(false);
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setNotification({ message: "Comment deleted successfully", type: "success" });
        setTimeout(() => {
          if (onCommentDeleted) {
            onCommentDeleted(comment.id);
          }
        }, 500);
      } else {
        const error = await response.json();
        setNotification({ message: error.error || "Failed to delete comment", type: "error" });
      }
    } catch (error) {
      console.error("Error deleting comment:", error);
      setNotification({ message: "Failed to delete comment", type: "error" });
    } finally {
      setIsDeleting(false);
      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || isUpdating) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/comments/${comment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setIsEditing(false);
        setNotification({ message: "Comment updated successfully", type: "success" });
        if (onCommentUpdated) {
          onCommentUpdated(comment.id, data.comment.content);
        }
        setTimeout(() => setNotification(null), 3000);
      } else {
        const error = await response.json();
        setNotification({ message: error.error || "Failed to update comment", type: "error" });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (error) {
      console.error("Error updating comment:", error);
      setNotification({ message: "Failed to update comment", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setIsUpdating(false);
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
    <div className={`${depth > 0 ? "ml-6 mt-3 border-l-2 border-blue-200 pl-4" : ""}`}>
      {/* Notification */}
      {notification && (
        <div className={`mb-2 px-3 py-2 rounded-lg text-sm ${
          notification.type === 'success' 
            ? 'bg-blue-100 text-blue-800 border border-blue-300' 
            : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {notification.message}
        </div>
      )}
      <div className="bg-blue-50 rounded-lg p-3">
        {/* Author and timestamp */}
        <div className="flex items-center gap-2 mb-2">
          {/* Profile picture */}
          <div className="relative w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))]">
            {comment.authorProfilePictureUrl ? (
              <Image
                src={comment.authorProfilePictureUrl}
                alt={comment.authorName}
                fill
                className="object-cover"
                sizes="24px"
              />
            ) : (
              <User className="w-4 h-4 h-full w-full p-1 text-[hsl(var(--muted-foreground))]" />
            )}
          </div>
          {comment.userId ? (
            <Link
              href={`/protected/profile/${comment.userId}`}
              className="font-semibold text-sm text-blue-900 hover:text-blue-700 hover:underline"
            >
              {comment.authorName}
            </Link>
          ) : (
            <span className="font-semibold text-sm text-blue-900">
              {comment.authorName}
            </span>
          )}
          <span className="text-xs text-blue-500">
            {formatTimeAgo(comment.created_at)}
          </span>
        </div>

        {/* Comment content or edit form */}
        {isEditing ? (
          <div className="mb-3 space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-2 bg-white text-blue-900 border border-blue-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={!editContent.trim() || isUpdating}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Check className="w-4 h-4" />
                {isUpdating ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isUpdating}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 text-sm"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-blue-800 mb-3 whitespace-pre-wrap">{comment.content}</p>
        )}

        {/* Delete confirmation notification */}
        {showDeleteConfirm && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600 mb-2">Are you sure you want to delete this comment?</p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-3 py-1.5 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Like/Dislike and action buttons */}
        <div className="flex items-center justify-between">
          {/* Like/Dislike on the left */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleLike(true)}
              disabled={isLiking || isEditing || showDeleteConfirm}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                comment.userLike === true
                  ? "text-blue-600 bg-blue-100"
                  : "text-blue-500 hover:bg-blue-100"
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium min-w-[2rem] text-center text-blue-700">
              {comment.netLikes}
            </span>
            <button
              onClick={() => handleLike(false)}
              disabled={isLiking || isEditing || showDeleteConfirm}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                comment.userLike === false
                  ? "text-blue-400 bg-blue-100"
                  : "text-blue-500 hover:bg-blue-100"
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
            </button>
          </div>

          {/* Reply/Edit/Delete on the right */}
          <div className="flex items-center gap-2">
            {depth < maxDepth && !isEditing && !showDeleteConfirm && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                title="Reply"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}

            {/* Edit/Delete buttons for own comments */}
            {isOwner && !isEditing && !showDeleteConfirm && (
              <>
                <button
                  onClick={handleEdit}
                  disabled={isDeleting}
                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                  title="Edit comment"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteClick}
                  disabled={isDeleting}
                  className="p-1.5 text-blue-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Delete comment"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Reply form */}
        {isReplying && (
          <div className="mt-3 space-y-2">
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="w-full p-2 bg-white text-blue-900 border border-blue-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-blue-400"
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
                className="px-4 py-1.5 bg-blue-200 text-blue-700 rounded-lg hover:bg-blue-300 text-sm"
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
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-2"
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
                    onCommentDeleted={onCommentDeleted}
                    onCommentUpdated={onCommentUpdated}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </>
          ) : (
            <button
              onClick={() => setShowReplies(true)}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
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
