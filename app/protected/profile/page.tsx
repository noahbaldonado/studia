import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import Link from "next/link";

export default async function UserProfilePage() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return redirect("/");
  }

  // Get profile data to fetch actual rating
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("rating, metadata")
    .eq("id", user.id)
    .single();

  const metadata = profile?.metadata as any;
  const displayName = metadata?.name || user.user_metadata?.full_name || "Profile";
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
      <header className="flex justify-between items-center border-b border-blue-200/60 pb-5 mb-7">
        <h1 className="text-3xl font-bold text-blue-900 tracking-tight">{displayName || "Profile"}</h1>
        <LogoutButton />
      </header>

      {/* User Rating Section - Top */}
      <section className="mb-5">
        <div className="p-7 rounded-2xl border border-blue-200/50 bg-gradient-to-br from-white via-blue-50/30 to-white shadow-sm hover:shadow-md transition-shadow duration-200">
          <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-5">User Rating</h3>
          <div className="flex items-center gap-5">
            <div className="text-4xl font-bold text-blue-900 tracking-tight">
              {userRating.toFixed(1)}
              <span className="text-2xl font-medium text-blue-400/70">/10</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className={`h-2.5 flex-1 rounded-full transition-all duration-300 ${
                      i < Math.round(userRating)
                        ? "bg-gradient-to-r from-blue-500 to-blue-600 shadow-sm"
                        : "bg-blue-100/60"
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
          <div className="p-7 rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 shadow-sm hover:shadow-md transition-all duration-200">
            <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3">Daily Streak</h3>
            <p className="text-4xl font-bold text-blue-700 tracking-tight">
              <span className="text-3xl">🔥</span> {currentStreak}
            </p>
            <p className="text-sm font-medium text-blue-400/80 mt-1">
              {currentStreak === 1 ? "day" : "days"}
            </p>
          </div>
          <div className="p-7 rounded-2xl border border-blue-200/50 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/40 shadow-sm hover:shadow-md transition-all duration-200">
            <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider mb-3">Quiz Rush Best</h3>
            <p className="text-4xl font-bold text-blue-700 tracking-tight">
              {puzzleRushBestScore}
            </p>
            <p className="text-sm font-medium text-blue-400/80 mt-1">
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
            className="block p-7 rounded-2xl border border-blue-200/50 hover:border-blue-300/60 hover:shadow-md transition-all duration-200 bg-gradient-to-br from-white via-blue-50/20 to-white group"
          >
            <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 group-hover:text-blue-700 transition-colors">Following</h2>
            <p className="text-4xl font-bold text-blue-800 tracking-tight group-hover:text-blue-900 transition-colors">{followingCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/followers/${user.id}`}
            className="block p-7 rounded-2xl border border-blue-200/50 hover:border-blue-300/60 hover:shadow-md transition-all duration-200 bg-gradient-to-br from-white via-blue-50/20 to-white group"
          >
            <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 group-hover:text-blue-700 transition-colors">Followers</h2>
            <p className="text-4xl font-bold text-blue-800 tracking-tight group-hover:text-blue-900 transition-colors">{followersCount || 0}</p>
          </Link>
        </div>
      </section>

      {/* Subscribed Courses and My Posts - Horizontal */}
      <section className="mb-5">
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={`/protected/profile/courses/${user.id}`}
            className="block p-7 rounded-2xl border border-blue-200/50 hover:border-blue-300/60 hover:shadow-md transition-all duration-200 bg-gradient-to-br from-white via-blue-50/20 to-white group"
          >
            <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 min-h-[3rem] group-hover:text-blue-700 transition-colors">Subscribed Courses</h2>
            <p className="text-4xl font-bold text-blue-800 tracking-tight group-hover:text-blue-900 transition-colors">{coursesCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/posts/${user.id}`}
            className="block p-7 rounded-2xl border border-blue-200/50 hover:border-blue-300/60 hover:shadow-md transition-all duration-200 bg-gradient-to-br from-white via-blue-50/20 to-white group"
          >
            <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-3 min-h-[3rem] group-hover:text-blue-700 transition-colors">My Posts</h2>
            <p className="text-4xl font-bold text-blue-800 tracking-tight group-hover:text-blue-900 transition-colors">{postsCount || 0}</p>
          </Link>
        </div>
      </section>

    </div>
  );
}
