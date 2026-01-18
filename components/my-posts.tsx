"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { FileText, BookOpen, StickyNote, Trash2, Edit2, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostData {
  quiz?: {
    type: "quiz";
    title: string;
    content: {
      question: string;
      options: string[];
      correct_answer: number;
    };
  };
  flashcard?: {
    type: "flashcard";
    content: {
      question: string;
      answer: string;
    };
  };
  sticky_note?: {
    type: "sticky_note";
    title: string;
    content: string;
  };
}

interface Post {
  id: string;
  data: PostData;
  rating: number;
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
  const [editData, setEditData] = useState<any>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'error' } | null>(null);

  const supabase = createClient();

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("quiz")
        .select("id, data, rating, course_id")
        .eq("user_id", userId)
        .order("rating", { ascending: false });

      if (error) {
        console.error("Error fetching posts:", error);
        return;
      }

      setPosts(data || []);
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
  }, [userId]);

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
    } catch (error: any) {
      console.error("Error deleting post:", error);
      setNotification({ message: error.message || "Failed to delete post", type: "error" });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const handleEdit = (post: Post) => {
    setEditingId(post.id);
    const postData = post.data as any;
    setEditData({ ...postData });
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
    } catch (error: any) {
      console.error("Error updating post:", error);
      setNotification({ message: error.message || "Failed to update post", type: "error" });
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
      {posts.map((post) => {
        const postData = post.data as any;
        const type = postData.type;
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
                      value={editData.title || ""}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Question</label>
                    <textarea
                      value={editData.content?.question || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          content: { ...editData.content, question: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Options</label>
                    {editData.content?.options?.map((opt: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 mb-2">
                        <input
                          type="radio"
                          checked={editData.content.correct_answer === idx}
                          onChange={() =>
                            setEditData({
                              ...editData,
                              content: { ...editData.content, correct_answer: idx },
                            })
                          }
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOptions = [...editData.content.options];
                            newOptions[idx] = e.target.value;
                            setEditData({
                              ...editData,
                              content: { ...editData.content, options: newOptions },
                            });
                          }}
                          className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg"
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
                <div className="rounded-lg bg-blue-100 p-2 flex-shrink-0">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">{postData.title}</h3>
                    <span className="text-xs text-zinc-500">Quiz</span>
                  </div>
                  <p className="text-sm text-zinc-700 mb-2">{postData.content.question}</p>
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
                      value={editData.content?.question || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          content: { ...editData.content, question: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Answer</label>
                    <textarea
                      value={editData.content?.answer || ""}
                      onChange={(e) =>
                        setEditData({
                          ...editData,
                          content: { ...editData.content, answer: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
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
                <div className="rounded-lg bg-purple-100 p-2 flex-shrink-0">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">Flashcard</h3>
                  </div>
                  <p className="text-sm text-zinc-700 mb-1">
                    <span className="font-medium">Q:</span> {postData.content.question}
                  </p>
                  <p className="text-sm text-zinc-600">
                    <span className="font-medium">A:</span> {postData.content.answer}
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
                      value={editData.title || ""}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Content</label>
                    <textarea
                      value={editData.content || ""}
                      onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg"
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
                <div className="rounded-lg bg-yellow-200 p-2 flex-shrink-0">
                  <StickyNote className="h-4 w-4 text-yellow-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-zinc-900">{postData.title}</h3>
                    <span className="text-xs text-zinc-500">Note</span>
                  </div>
                  <p className="text-sm text-zinc-700">{postData.content}</p>
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
