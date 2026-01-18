"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import Link from "next/link";

interface Friend {
  id: string;
  name: string;
  email: string | null;
}

interface CourseFriendsSubscribedProps {
  courseId: string;
}

export function CourseFriendsSubscribed({ courseId }: CourseFriendsSubscribedProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    async function fetchFriendsSubscribed() {
      try {
        setLoading(true);
        const response = await fetch("/api/courses/following-subscriptions");
        
        if (!response.ok) {
          console.error("Error fetching friends subscriptions");
          return;
        }

        const data = await response.json();
        const courseFollowing = data.courseFollowing || {};
        const courseFriends = courseFollowing[courseId] || [];
        
        setFriends(courseFriends);
      } catch (error) {
        console.error("Error fetching friends subscribed:", error);
      } finally {
        setLoading(false);
      }
    }

    if (courseId) {
      fetchFriendsSubscribed();
    }
  }, [courseId]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (friends.length === 0) {
    return null; // Don't show if no friends are subscribed
  }

  const firstFriend = friends[0];
  const otherCount = friends.length - 1;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full text-left p-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors mb-4"
      >
        <div className="flex items-center gap-2 text-sm text-zinc-700">
          <Users className="h-4 w-4 text-zinc-500" />
          <span>
            {friends.length === 1
              ? `${firstFriend.name} subscribes`
              : otherCount === 1
              ? `${firstFriend.name} and 1 other subscribe`
              : `${firstFriend.name} and ${otherCount} others subscribe`}
          </span>
        </div>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-zinc-500" />
                Friends Subscribed
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-900 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto p-4">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  No friends subscribed
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => {
                    const emailDisplay = friend.email
                      ? friend.email.replace("@ucsc.edu", "")
                      : "";

                    return (
                      <Link
                        key={friend.id}
                        href={`/protected/profile/${friend.id}`}
                        onClick={() => setShowModal(false)}
                        className="block"
                      >
                        <div className="flex items-center justify-between py-3 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 transition-colors cursor-pointer">
                          <div className="flex-1">
                            <div className="font-medium text-zinc-900">{friend.name}</div>
                            {emailDisplay && (
                              <div className="text-xs text-zinc-500 mt-0.5">
                                {emailDisplay}@ucsc.edu
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
