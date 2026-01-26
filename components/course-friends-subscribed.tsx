"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import Link from "next/link";

interface Friend {
  id: string;
  username: string | null;
  name: string | null;
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
  const firstFriendDisplay = firstFriend.username 
    ? `@${firstFriend.username}` 
    : firstFriend.name || `User ${firstFriend.id.substring(0, 8)}`;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="w-full text-center px-2 py-4 rounded-full border border-blue-200 bg-gradient-to-br from-white to-blue-50 hover:bg-blue-50 transition-colors mb-4"
      >
        <div className="flex items-center justify-center gap-2 text-sm text-blue-700">
          <Users className="h-4 w-4 text-blue-600" />
          <span>
            {friends.length === 1
              ? `${firstFriendDisplay} subscribes`
              : otherCount === 1
              ? `${firstFriendDisplay} and 1 other subscribe`
              : `${firstFriendDisplay} and ${otherCount} others subscribe`}
          </span>
        </div>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-blue-900/50 p-4">
          <div className="w-full max-w-md bg-gradient-to-br from-white to-blue-50 rounded-lg shadow-xl max-h-[80vh] flex flex-col border-2 border-blue-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-blue-200">
              <h2 className="text-xl font-bold flex items-center gap-2 text-blue-900">
                <Users className="h-5 w-5 text-blue-600" />
                Friends Subscribed
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-blue-500 hover:text-blue-700 text-xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Friends List */}
            <div className="flex-1 overflow-y-auto p-4">
              {friends.length === 0 ? (
                <div className="text-center py-8 text-blue-600">
                  No friends subscribed
                </div>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => {
                    const username = friend.username ? `@${friend.username}` : null;
                    const displayName = friend.name || `User ${friend.id.substring(0, 8)}`;

                    return (
                      <Link
                        key={friend.id}
                        href={`/protected/profile/${friend.id}`}
                        onClick={() => setShowModal(false)}
                        className="block"
                      >
                        <div className="flex items-center justify-between py-3 px-3 rounded-lg border border-blue-200 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer bg-white">
                          <div className="flex-1">
                            {username ? (
                              <>
                                <div className="font-medium text-blue-900">{username}</div>
                                {friend.name && (
                                  <div className="text-xs text-blue-600 mt-0.5">
                                    {friend.name}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="font-medium text-blue-900">{displayName}</div>
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
