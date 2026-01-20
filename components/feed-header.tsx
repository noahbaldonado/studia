"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";

export function FeedHeader() {
  return (
    <div className="sticky top-0 bg-[hsl(var(--card))] border-b border-[hsl(var(--border))] z-40 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Home</h1>
        <Link
          href="/protected/messages"
          className="p-1.5 hover:bg-[hsl(var(--secondary))] transition-colors"
          aria-label="Messages"
        >
          <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
        </Link>
      </div>
    </div>
  );
}
