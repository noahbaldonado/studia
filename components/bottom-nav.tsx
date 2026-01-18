"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, User, Users, Timer } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const isHome = pathname === "/protected";
  const isCourses = pathname.startsWith("/protected/courses");
  const isPuzzleRush = pathname.startsWith("/protected/puzzle-rush");
  const isFriends = pathname.startsWith("/protected/friends");
  const isProfile = pathname.startsWith("/protected/profile");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-200 bg-gradient-to-t from-white via-blue-50 to-white backdrop-blur-sm"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-around py-3">
        <Link
          href="/protected"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors active:opacity-70"
          aria-label="Home"
        >
          <Home
            className={`h-6 w-6 ${isHome ? "text-blue-600" : "text-blue-300"}`}
          />
          <span
            className={`text-xs font-medium ${isHome ? "text-blue-600" : "text-blue-300"}`}
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
            className={`h-6 w-6 ${isCourses ? "text-blue-600" : "text-blue-300"}`}
          />
          <span
            className={`text-xs font-medium ${isCourses ? "text-blue-600" : "text-blue-300"}`}
          >
            Courses
          </span>
        </Link>
        <Link
          href="/protected/puzzle-rush"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors active:opacity-70"
          aria-label="Puzzle Rush"
        >
          <Timer
            className={`h-6 w-6 ${isPuzzleRush ? "text-blue-600" : "text-blue-300"}`}
          />
          <span
            className={`text-xs font-medium ${isPuzzleRush ? "text-blue-600" : "text-blue-300"}`}
          >
            Puzzle Rush
          </span>
        </Link>
        <Link
          href="/protected/friends"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-3 transition-colors active:opacity-70"
          aria-label="Friends"
        >
          <Users
            className={`h-6 w-6 ${isFriends ? "text-blue-600" : "text-blue-300"}`}
          />
          <span
            className={`text-xs font-medium ${isFriends ? "text-blue-600" : "text-blue-300"}`}
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
            className={`h-6 w-6 ${isProfile ? "text-blue-600" : "text-blue-300"}`}
          />
          <span
            className={`text-xs font-medium ${isProfile ? "text-blue-600" : "text-blue-300"}`}
          >
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
}
