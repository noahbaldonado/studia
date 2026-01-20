import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { FollowButton } from "@/components/follow-button";
import { formatUsername } from "@/lib/utils";
import Link from "next/link";

export default async function OtherUserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  // Get current user
  const { data: { user: currentUser }, error: currentUserError } = await supabase.auth.getUser();
  if (currentUserError || !currentUser) {
    return redirect("/");
  }

  // If viewing own profile, redirect to main profile page
  if (id === currentUser.id) {
    return redirect("/protected/profile");
  }

  // Get profile data for the user
  const { data: profile, error: profileError } = await supabase
    .from("profile")
    .select("id, rating, metadata, username")
    .eq("id", id)
    .single();

  if (profileError || !profile) {
    return notFound();
  }

  const metadata = profile.metadata as { name?: string; email?: string; [key: string]: unknown };
  const displayName = profile.username 
    ? formatUsername(profile.username)
    : metadata?.name || `User ${id.substring(0, 8)}`;
  const userRating = Math.min(10, profile.rating || 7.5);
  const currentStreak = metadata?.current_streak || 0;
  const puzzleRushBestScore = metadata?.puzzle_rush_best_score || 0;

  // Get counts
  const { count: coursesCount } = await supabase
    .from("course_subscription")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id);

  const { count: followingCount } = await supabase
    .from("follow")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", id);

  const { count: followersCount } = await supabase
    .from("follow")
    .select("*", { count: "exact", head: true })
    .eq("following_id", id);

  return (
    <div className="px-4 py-6 pb-24">
      <header className="flex justify-between items-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">{displayName}</h1>
      </header>

      {/* User Rating Section */}
      <section className="mb-6">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-zinc-900">
            {userRating.toFixed(1)}
            <span className="text-xl font-normal text-zinc-500">/10</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-1">
              {[...Array(10)].map((_, i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-full ${
                    i < Math.round(userRating)
                      ? "bg-blue-600"
                      : "bg-zinc-200"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-zinc-500 mt-1">User Rating</p>
          </div>
        </div>
      </section>

      {/* Daily Streak Section */}
      <section className="mb-6">
        <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
          <h3 className="text-sm font-semibold text-zinc-600 mb-1">Daily Streak</h3>
          <p className="text-3xl font-bold text-orange-600">
            🔥 {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </p>
        </div>
      </section>

      {/* Quiz Rush Best Score Section */}
      <section className="mb-6">
        <div className="p-4 rounded-lg border border-zinc-200 bg-zinc-50">
          <h3 className="text-sm font-semibold text-zinc-600 mb-1">Quiz Rush Best Score</h3>
          <p className="text-3xl font-bold text-purple-600">
            {puzzleRushBestScore} {puzzleRushBestScore === 1 ? "point" : "points"}
          </p>
        </div>
      </section>

      {/* Subscribed Courses Section */}
      <section className="mb-8">
        <Link
          href={`/protected/profile/courses/${id}`}
          className="block p-4 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
        >
          <h2 className="text-xl font-bold mb-1">Subscribed Courses</h2>
          <p className="text-2xl font-semibold text-blue-600">{coursesCount || 0}</p>
        </Link>
      </section>

      {/* Following and Followers Section */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={`/protected/profile/following/${id}`}
            className="block p-4 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <h2 className="text-lg font-bold mb-1">Following</h2>
            <p className="text-2xl font-semibold text-blue-600">{followingCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/followers/${id}`}
            className="block p-4 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            <h2 className="text-lg font-bold mb-1">Followers</h2>
            <p className="text-2xl font-semibold text-blue-600">{followersCount || 0}</p>
          </Link>
        </div>
      </section>

      {/* Follow Button Section */}
      <section className="mt-8">
        <FollowButton targetUserId={id} />
      </section>
    </div>
  );
}
