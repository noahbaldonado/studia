import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { FollowList } from "@/components/follow-list";
import { UserSubscribedCourses } from "@/components/user-subscribed-courses";

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
    .select("id, rating, metadata")
    .eq("id", id)
    .single();

  if (profileError || !profile) {
    return notFound();
  }

  const metadata = profile.metadata as any;
  const displayName = metadata?.name || `User ${id.substring(0, 8)}`;
  const userRating = profile.rating || 7.5;

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

      {/* Subscribed Courses Section */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Subscribed Courses</h2>
        <UserSubscribedCourses userId={id} />
      </section>

      {/* Following and Followers Section */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h2 className="text-lg font-bold mb-3">Following</h2>
            <FollowList userId={id} type="following" />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-3">Followers</h2>
            <FollowList userId={id} type="followers" />
          </div>
        </div>
      </section>
    </div>
  );
}
