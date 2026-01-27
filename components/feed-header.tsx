"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export function FeedHeader() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread message count
  useEffect(() => {
    async function fetchUnreadCount() {
      try {
        const response = await fetch("/api/messages/unread-count");
        if (response.ok) {
          const data = await response.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    }

    fetchUnreadCount();

    // Refetch when window gains focus (user navigates back)
    const handleFocus = () => {
      fetchUnreadCount();
    };

    window.addEventListener("focus", handleFocus);

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-40 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Home</h1>
        <Link
          href="/protected/messages"
          className="relative p-1.5 hover:bg-[hsl(var(--secondary))] transition-colors"
          aria-label="Messages"
        >
          <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold text-white bg-[hsl(0,100%,60%)] rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}
