"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Trash2, Edit2, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedSortFilterControls, SortMode } from "@/components/feed-sort-filter-controls";

interface PostData {
  type: "quiz" | "flashcard" | "sticky_note" | "poll" | "open_question";
  title?: string;
  content: 
    | { question: string; options: string[]; correct_answer: number } // quiz
    | { question: string; answer: string } // flashcard or open_question
    | { question: string; options: string[] } // poll
    | string; // sticky_note
}

interface Post {
  id: string;
  data: PostData;
  rating: number;
  likes: number;
  dislikes: number;
  created_at: string;
  course_id: string;
}

interface MyPostsProps {
  userId: string;
}

export function MyPosts({ userId }: MyPostsProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<PostData | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' } | null>(null);
  const [sortMode, setSortMode] = useState<"chronological" | "likes">("chronological");
  const [courseFilter, setCourseFilter] = useState<string[] | null>(null);

  const supabase = createClient();

  const fetchPosts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("quiz")
        .select("id, data, rating, likes, dislikes, created_at, course_id")
        .eq("user_id", userId);

      // Apply course filter if specified
      if (courseFilter && courseFilter.length > 0) {
        query = query.in("course_id", courseFilter);
      }

      // Default order (we'll sort client-side for more flexibility)
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching posts:", error);
        return;
      }

      let sortedPosts = data || [];

      // Apply sorting
      if (sortMode === "likes") {
        sortedPosts = sortedPosts.sort((a, b) => {
          const likesA = a.likes || 0;
          const likesB = b.likes || 0;
          return likesB - likesA; // Highest likes first
        });
      } else if (sortMode === "net_likes") {
        sortedPosts = sortedPosts.sort((a, b) => {
          const netLikesA = (a.likes || 0) - (a.dislikes || 0);
          const netLikesB = (b.likes || 0) - (b.dislikes || 0);
          return netLikesB - netLikesA; // Highest net likes first
        });
      } else if (sortMode === "chronological") {
        sortedPosts = sortedPosts.sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return dateB - dateA; // Newest first
        });
      }

      setPosts(sortedPosts);
    } catch (err) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, sortMode, courseFilter]);

  const handleDeleteClick = (postId: string) => {
    setConfirmDeleteId(postId);
  };

  const handleConfirmDelete = async (postId: string) => {
    try {
      setDeletingId(postId);
      setConfirmDeleteId(null);

      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete post");
      }

      // Remove from local state
      setPosts(posts.filter((post) => post.id !== postId));
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Error deleting post:", err.message || error);
      setNotification({ message: err.message || "Failed to delete post", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  // Format relative time (e.g., "2 days ago", "3 weeks ago")
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
    if (diffWeeks < 4) return `${diffWeeks} ${diffWeeks === 1 ? "week" : "weeks"} ago`;
    if (diffMonths < 12) return `${diffMonths} ${diffMonths === 1 ? "month" : "months"} ago`;
    return `${diffYears} ${diffYears === 1 ? "year" : "years"} ago`;
  };

  const handleEdit = (post: Post) => {
    setEditingId(post.id);
    setEditData(post.data);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditData(null);
  };

  const handleSaveEdit = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ postData: editData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update post");
      }

      // Refresh posts
      await fetchPosts();
      setEditingId(null);
      setEditData(null);
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error("Error updating post:", err.message || error);
      setNotification({ message: err.message || "Failed to update post", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  if (loading) {
    return (
      <div className="text-sm text-zinc-500 py-4">Loading posts...</div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-4">
        No posts created yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FeedSortFilterControls
        sortMode={sortMode}
        onSortChange={(mode) => setSortMode(mode as "chronological" | "likes")}
        courseFilter={courseFilter}
        onCourseFilterChange={setCourseFilter}
        sortOptions={[
          { value: "chronological", label: "Recent" },
          { value: "likes", label: "Likes" },
        ]}
      />
      {posts.map((post) => {
        const postData = post.data;
        const type = postData.type || 'quiz'; // Default to quiz for backwards compatibility
        const isEditing = editingId === post.id;

        if (type === "quiz") {
          if (isEditing) {
            return (
              <div
                key={post.id}
                className="p-4 rounded-lg border-2 border-blue-300 bg-blue-50"
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      value={editData?.title || ""}
                      onChange={(e) => setEditData({ ...editData!, title: e.target.value })}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Question</label>
                    <textarea
                      value={(editData?.content as any)?.question || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData!,
                          content: { ...(editData!.content as any), question: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Options</label>
                    {((editData?.content as any)?.options || []).map((opt: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          checked={(editData?.content as any).correct_answer === idx}
                          onChange={() =>
                            setEditData({
                              ...editData!,
                              content: { ...(editData!.content as any), correct_answer: idx },
                            })
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer flex-shrink-0"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOptions = [...(editData!.content as any).options];
                            newOptions[idx] = e.target.value;
                            setEditData({
                              ...editData!,
                              content: { ...(editData!.content as any), options: newOptions },
                            });
                          }}
                          className={`flex-1 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 ${
                            (editData?.content as any).correct_answer === idx
                              ? "bg-green-50 border-2 border-green-300"
                              : "bg-white border border-blue-300"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSaveEdit(post.id)}
                      size="sm"
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={post.id}
              className="p-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">{postData.title || "Quiz"}</h3>
                    <span className="text-xs text-zinc-400">• {formatRelativeTime(post.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    {(() => {
                      const netLikes = (post.likes || 0) - (post.dislikes || 0);
                      const netLikesColor = netLikes > 0 ? "text-green-600" : netLikes < 0 ? "text-red-600" : "text-gray-500";
                      return (
                        <span className={`text-xs font-semibold ${netLikesColor}`}>
                          {netLikes > 0 ? "+" : ""}{netLikes} net likes
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-zinc-700 mb-2">{(postData.content as any)?.question || ""}</p>
                  {confirmDeleteId === post.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                      <p className="text-sm text-red-600">Are you sure you want to delete this post?</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmDelete(post.id);
                          }}
                          size="sm"
                          variant="destructive"
                        >
                          Delete
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelDelete();
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId !== post.id && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(post);
                        }}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(post.id);
                        }}
                        disabled={deletingId === post.id}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === post.id ? (
                          <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-red-600" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        } else if (type === "flashcard") {
          if (isEditing) {
            return (
              <div
                key={post.id}
                className="p-4 rounded-lg border-2 border-purple-300 bg-purple-50"
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Question</label>
                    <textarea
                      value={(editData?.content as any)?.question || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData!,
                          content: { ...(editData!.content as any), question: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Answer</label>
                    <textarea
                      value={(editData?.content as any)?.answer || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData!,
                          content: { ...(editData!.content as any), answer: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSaveEdit(post.id)}
                      size="sm"
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={post.id}
              className="p-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">Flashcard</h3>
                  </div>
                  <p className="text-sm text-zinc-700 mb-1">
                    <span className="font-medium">Q:</span> {(postData.content as any).question || ""}
                  </p>
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium">A:</span> {(postData.content as any).answer || ""}
                  </p>
                  {confirmDeleteId === post.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                      <p className="text-sm text-red-600">Are you sure you want to delete this post?</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmDelete(post.id);
                          }}
                          size="sm"
                          variant="destructive"
                        >
                          Delete
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelDelete();
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId !== post.id && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(post);
                        }}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(post.id);
                        }}
                        disabled={deletingId === post.id}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === post.id ? (
                          <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-red-600" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        } else if (type === "poll") {
          // Polls - display only (no edit/delete for now)
          return (
            <div
              key={post.id}
              className="p-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">Poll</h3>
                  </div>
                  <p className="text-sm text-zinc-700 mb-2">{(postData.content as any).question || ""}</p>
                  <div className="space-y-1">
                    {((postData.content as any).options || []).map((opt: string, idx: number) => (
                      <div key={idx} className="text-xs text-zinc-600">• {opt}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        } else if (type === "open_question") {
          // Open questions - display only (no edit/delete for now)
          return (
            <div
              key={post.id}
              className="p-4 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">Open Question</h3>
                  </div>
                  <p className="text-sm text-zinc-700 mb-1">
                    <span className="font-medium">Q:</span> {(postData.content as any).question || ""}
                  </p>
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium">A:</span> {(postData.content as any).answer || ""}
                  </p>
                </div>
              </div>
            </div>
          );
        } else if (type === "sticky_note") {
          if (isEditing) {
            return (
              <div
                key={post.id}
                className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50"
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      value={editData?.title || ""}
                      onChange={(e) => setEditData({ ...editData!, title: e.target.value })}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Content</label>
                    <textarea
                      value={typeof editData?.content === 'string' ? editData.content : ""}
                      onChange={(e) => setEditData({ ...editData!, content: e.target.value })}
                      className="w-full px-3 py-2 border border-blue-300 rounded-lg bg-white text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      rows={4}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSaveEdit(post.id)}
                      size="sm"
                      className="flex-1"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      onClick={handleCancelEdit}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={post.id}
              className="p-4 rounded-lg border border-zinc-200 bg-yellow-50 hover:bg-yellow-100 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">{postData.title || "Sticky Note"}</h3>
                    <span className="text-xs text-zinc-400">• {formatRelativeTime(post.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    {(() => {
                      const netLikes = (post.likes || 0) - (post.dislikes || 0);
                      const netLikesColor = netLikes > 0 ? "text-green-600" : netLikes < 0 ? "text-red-600" : "text-gray-500";
                      return (
                        <span className={`text-xs font-semibold ${netLikesColor}`}>
                          {netLikes > 0 ? "+" : ""}{netLikes} net likes
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-sm text-zinc-700">{typeof postData.content === 'string' ? postData.content : ""}</p>
                  {confirmDeleteId === post.id && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                      <p className="text-sm text-red-600">Are you sure you want to delete this post?</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmDelete(post.id);
                          }}
                          size="sm"
                          variant="destructive"
                        >
                          Delete
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelDelete();
                          }}
                          size="sm"
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  {confirmDeleteId !== post.id && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(post);
                        }}
                        className="p-2 hover:bg-blue-50 rounded-lg transition-colors"
                        aria-label="Edit"
                      >
                        <Edit2 className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(post.id);
                        }}
                        disabled={deletingId === post.id}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === post.id ? (
                          <Loader2 className="h-4 w-4 text-red-600 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-red-600" />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        }

        return null;
      })}
      {notification && (
        <div className="mt-4 px-4 py-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-300">
          {notification.message}
        </div>
      )}
    </div>
  );
}
