"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, User, Users, Timer } from "lucide-react";

export function BottomNav() {
  const pathname = usePathname();
  const isHome = pathname === "/protected";
  const isCourses = pathname.startsWith("/protected/courses");
  const isMinigames = pathname.startsWith("/protected/minigames");
  const isFriends = pathname.startsWith("/protected/friends");
  const isProfile = pathname.startsWith("/protected/profile");

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-around py-2">
        <Link
          href="/protected"
          className="flex min-h-[40px] min-w-[40px] flex-col items-center justify-center gap-0.5 px-2.5 transition-colors active:opacity-70"
          aria-label="Home"
        >
          <Home
            className={`h-5 w-5 ${isHome ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          />
          <span
            className={`text-xs font-medium ${isHome ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          >
            Home
          </span>
        </Link>
        <Link
          href="/protected/courses"
          className="flex min-h-[40px] min-w-[40px] flex-col items-center justify-center gap-0.5 px-2.5 transition-colors active:opacity-70"
          aria-label="Courses"
        >
          <BookOpen
            className={`h-5 w-5 ${isCourses ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          />
          <span
            className={`text-xs font-medium ${isCourses ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          >
            Courses
          </span>
        </Link>
        <Link
          href="/protected/minigames"
          className="flex min-h-[40px] min-w-[40px] flex-col items-center justify-center gap-0.5 px-2.5 transition-colors active:opacity-70"
          aria-label="Minigames"
        >
          <Timer
            className={`h-5 w-5 ${isMinigames ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          />
          <span
            className={`text-xs font-medium ${isMinigames ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          >
            Minigames
          </span>
        </Link>
        <Link
          href="/protected/friends"
          className="flex min-h-[40px] min-w-[44px] flex-col items-center justify-center gap-0.5 px-2.5 transition-colors active:opacity-70"
          aria-label="Friends"
        >
          <Users
            className={`h-5 w-5 ${isFriends ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          />
          <span
            className={`text-xs font-medium ${isFriends ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          >
            Friends
          </span>
        </Link>
        <Link
          href="/protected/profile"
          className="flex min-h-[40px] min-w-[40px] flex-col items-center justify-center gap-0.5 px-2.5 transition-colors active:opacity-70"
          aria-label="Profile"
        >
          <User
            className={`h-5 w-5 ${isProfile ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          />
          <span
            className={`text-xs font-medium ${isProfile ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}
          >
            Profile
          </span>
        </Link>
      </div>
    </nav>
  );
}
