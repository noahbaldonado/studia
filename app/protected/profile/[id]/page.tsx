import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { FollowButton } from "@/components/follow-button";
import { MessageButton } from "@/components/message-button";
import { formatUsername } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { User } from "lucide-react";

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
    .select("id, rating, metadata, username, profile_picture_url")
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
  const currentStreak = (typeof metadata?.current_streak === 'number' ? metadata.current_streak : 0);
  const quizRushBestScore = (typeof metadata?.quiz_rush_best_score === 'number' ? metadata.quiz_rush_best_score : 0);

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

  const { count: postsCount } = await supabase
    .from("quiz")
    .select("*", { count: "exact", head: true })
    .eq("user_id", id);

  return (
    <div className="px-4 py-6 pb-24">
      <header className="flex justify-between items-start gap-4 border-b border-[hsl(var(--border))] pb-5 mb-7">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-4 mb-4">
            {/* Profile Picture */}
            <div className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-[hsl(var(--muted))] flex items-center justify-center">
              {profile.profile_picture_url ? (
                <Image
                  src={profile.profile_picture_url}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <User className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-2 overflow-hidden">
              <h1 
                className={`font-bold text-foreground tracking-tight mb-2 truncate ${
                  displayName.length > 12 
                    ? "text-base" 
                    : displayName.length > 8 
                    ? "text-lg" 
                    : displayName.length > 5
                    ? "text-xl"
                    : "text-2xl"
                }`}
                title={displayName.length > 12 ? displayName : undefined}
              >
                {displayName.length > 12 ? `${displayName.substring(0, 12)}...` : displayName || "Profile"}
              </h1>
              <div className="text-sm text-[hsl(var(--muted-foreground))] truncate">
                {metadata?.name || (profile.username ? `@${profile.username}` : `User ${id.substring(0, 8)}`)}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <FollowButton targetUserId={id} />
          <MessageButton targetUserId={id} />
        </div>
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
              {quizRushBestScore}
            </p>
            <p className="text-sm font-medium text-[hsl(var(--muted-foreground))] mt-1">
              {quizRushBestScore === 1 ? "point" : "points"}
            </p>
          </div>
        </div>
      </section>

      {/* Following and Followers - Horizontal */}
      <section className="mb-5">
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={`/protected/profile/following/${id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 group-hover:text-foreground transition-colors">Following</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{followingCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/followers/${id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 group-hover:text-foreground transition-colors">Followers</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{followersCount || 0}</p>
          </Link>
        </div>
      </section>

      {/* Subscribed Courses and Posts - Horizontal */}
      <section className="mb-5">
        <div className="grid grid-cols-2 gap-4">
          <Link
            href={`/protected/profile/courses/${id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 min-h-[3rem] group-hover:text-foreground transition-colors">Subscribed Courses</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{coursesCount || 0}</p>
          </Link>
          <Link
            href={`/protected/profile/posts/${id}`}
            className="block p-6 border-2 border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-all duration-200 bg-[hsl(var(--card))] group"
          >
            <h2 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider mb-3 min-h-[3rem] group-hover:text-foreground transition-colors">Posts</h2>
            <p className="text-4xl font-bold text-foreground tracking-tight">{postsCount || 0}</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
