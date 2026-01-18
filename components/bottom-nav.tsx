"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, User, Users } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const isHome = pathname === "/protected";
  const isCourses = pathname.startsWith("/protected/courses");
  const isFriends = pathname.startsWith("/protected/friends");
  const isProfile = pathname.startsWith("/protected/profile");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-around py-3">
        <Link
          href="/protected"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors active:opacity-70"
          aria-label="Home"
        >
          <Home
            className={`h-6 w-6 ${isHome ? "text-black" : "text-zinc-400"}`}
          />
          <span
            className={`text-xs font-medium ${isHome ? "text-black" : "text-zinc-400"}`}
          >
            Home
          </span>
        </Link>
        <Link
          href="/protected/courses"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors active:opacity-70"
          aria-label="Courses"
        >
          <BookOpen
            className={`h-6 w-6 ${isCourses ? "text-black" : "text-zinc-400"}`}
          />
          <span
            className={`text-xs font-medium ${isCourses ? "text-black" : "text-zinc-400"}`}
          >
            Courses
          </span>
        </Link>
        <Link
          href="/protected/friends"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors active:opacity-70"
          aria-label="Friends"
        >
          <Users
            className={`h-6 w-6 ${isFriends ? "text-black" : "text-zinc-400"}`}
          />
          <span
            className={`text-xs font-medium ${isFriends ? "text-black" : "text-zinc-400"}`}
          >
            Friends
          </span>
        </Link>
        <Link
          href="/protected/profile"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors active:opacity-70"
          aria-label="Profile"
        >
          <User
            className={`h-6 w-6 ${isProfile ? "text-black" : "text-zinc-400"}`}
          />
          <span
            className={`text-xs font-medium ${isProfile ? "text-black" : "text-zinc-400"}`}
          >
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
}
