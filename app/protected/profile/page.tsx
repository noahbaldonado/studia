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
      <header className="flex justify-between items-center border-b border-blue-200 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-blue-900">{displayName || "Profile"}</h1>
        <LogoutButton />
      </header>

      {/* User Rating Section */}
      <section className="mb-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-blue-900">
            {userRating.toFixed(1)}
            <span className="text-xl font-normal text-blue-500">/10</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < Math.round(userRating)
                      ? "bg-blue-600"
                      : "bg-blue-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-blue-600 mt-1">User Rating</p>
          </div>
        </div>
      </section>

      {/* Daily Streak Section */}
      <section className="mb-6">
        <div className="p-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <h3 className="text-sm font-semibold text-blue-600 mb-1">Daily Streak</h3>
          <p className="text-3xl font-bold text-blue-600">
            🔥 {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </section>

      {/* Puzzle Rush Best Score Section */}
      <section className="mb-6">
        <div className="p-4 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <h3 className="text-sm font-semibold text-blue-600 mb-1">Puzzle Rush Best Score</h3>
          <p className="text-3xl font-bold text-blue-600">
            {puzzleRushBestScore} {puzzleRushBestScore === 1 ? "point" : "points"}
          </p>
        </div>
      </section>

      {/* Subscribed Courses Section */}
      <section className="mb-8">
        <Link
          href={`/protected/profile/courses/${user.id}`}
          className="block p-4 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors bg-gradient-to-br from-white to-blue-50"
        >
          <h2 className="text-xl font-bold mb-1 text-blue-900">Subscribed Courses</h2>
          <p className="text-2xl font-semibold text-blue-600">{coursesCount || 0}</p>
        </Link>
      </section>

      {/* Following and Followers Section */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={`/protected/profile/following/${user.id}`}
            className="block p-4 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors bg-gradient-to-br from-white to-blue-50"
          >
            <h2 className="text-lg font-bold mb-1 text-blue-900">Following</h2>
            <p className="text-2xl font-semibold text-blue-600">{followingCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/followers/${user.id}`}
            className="block p-4 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors bg-gradient-to-br from-white to-blue-50"
          >
            <h2 className="text-lg font-bold mb-1 text-blue-900">Followers</h2>
            <p className="text-2xl font-semibold text-blue-600">{followersCount || 0}</p>
          </Link>
        </div>
      </section>

      {/* My Posts Section */}
      <section className="mb-8">
        <Link
          href={`/protected/profile/posts/${user.id}`}
          className="block p-4 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors bg-gradient-to-br from-white to-blue-50"
        >
          <h2 className="text-xl font-bold mb-1 text-blue-900">My Posts</h2>
          <p className="text-2xl font-semibold text-blue-600">{postsCount || 0}</p>
        </Link>
      </section>

    </div>
  );
}
