import { createClient } from "@/lib/supabase/server";
import { requireUsername } from "@/lib/auth-utils";
import { LogoutButton } from "@/components/logout-button";
import { UsernameSection } from "@/components/username-section";
import { DeleteUserButton } from "@/components/delete-user-button";
import { formatUsername } from "@/lib/utils";
import Link from "next/link";

export default async function UserProfilePage() {
  const userId = await requireUsername();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get profile data to fetch actual rating
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("rating, metadata, username")
    .eq("id", user.id)
    .single();

  const metadata = profile?.metadata as { name?: string; email?: string; [key: string]: unknown };
  const displayName = profile?.username 
    ? formatUsername(profile.username)
    : metadata?.name || user.user_metadata?.full_name || "Profile";
  const userRating = Math.min(10, profile?.rating || 7.5);
  const currentStreak = metadata?.current_streak || 0;
  const puzzleRushBestScore = metadata?.puzzle_rush_best_score || 0;

  // Get counts
  const { count: coursesCount } = await supabase
    .from("course_subscription")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: followingCount } = await supabase
    .from("follow")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", user.id);

  const { count: followersCount } = await supabase
    .from("follow")
    .select("*", { count: "exact", head: true })
    .eq("following_id", user.id);

  const { count: postsCount } = await supabase
    .from("quiz")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="px-4 py-6 pb-24">
      <header className="flex justify-between items-center border-b border-[hsl(var(--border))] pb-5 mb-7">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight mb-2">{displayName || "Profile"}</h1>
          <div className="text-sm text-[hsl(var(--muted-foreground))]">
            <UsernameSection currentUsername={profile?.username || null} />
          </div>
        </div>
        <LogoutButton />
      </header>

      {/* User Rating Section - Top */}
      <section className="mb-5">
        <div className="p-6 border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))]">
          <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-4">User Rating</h3>
          <div className="flex items-center gap-5">
            <div className="text-4xl font-bold text-foreground tracking-tight">
              {userRating.toFixed(1)}
              <span className="text-2xl font-medium text-[hsl(var(--muted-foreground))]">/10</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 transition-all duration-300 ${
                      i < Math.round(userRating)
                        ? "bg-[hsl(var(--primary))]"
                        : "bg-[hsl(var(--muted))]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Streak and Quiz Rush - Horizontal */}
      <section className="mb-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Daily Streak</h3>
            <p className="text-4xl font-bold text-foreground tracking-tight">
              <span className="text-3xl">🔥</span> {currentStreak}
            </p>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] mt-1">
              {currentStreak === 1 ? "day" : "days"}
            </p>
          </div>
          <div className="p-6 border-2 border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            <h3 className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3">Quiz Rush Best</h3>
            <p className="text-4xl font-bold text-foreground tracking-tight">
              {puzzleRushBestScore}
            </p>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] mt-1">
              {puzzleRushBestScore === 1 ? "point" : "points"}
            </p>
          </div>
        </div>
      </section>

      {/* Following and Followers - Horizontal */}
      <section className="mb-5">
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={`/protected/profile/following/${user.id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 group-hover:text-foreground transition-colors">Following</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{followingCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/followers/${user.id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 group-hover:text-foreground transition-colors">Followers</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{followersCount || 0}</p>
          </Link>
        </div>
      </section>

      {/* Subscribed Courses and My Posts - Horizontal */}
      <section className="mb-5">
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={`/protected/profile/courses/${user.id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 min-h-[3rem] group-hover:text-foreground transition-colors">Subscribed Courses</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{coursesCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/posts/${user.id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 min-h-[3rem] group-hover:text-foreground transition-colors">My Posts</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{postsCount || 0}</p>
          </Link>
        </div>
      </section>

      {/* Delete Account Section */}
      <section className="mt-8 pt-6 border-t border-[hsl(var(--border))]">
        <DeleteUserButton />
      </section>

    </div>
  );
}
