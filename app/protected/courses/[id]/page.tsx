import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { requireUsername } from "@/lib/auth-utils";
import { SubscribeButton } from "@/components/subscribe-button";
import { CourseFriendsSubscribed } from "@/components/course-friends-subscribed";
import { CourseActions } from "@/components/course-actions";
import { CardFeed } from "@/components/card-feed";
import { FeedSortFilterControls, SortMode } from "@/components/feed-sort-filter-controls";
import { CourseFeedClient } from "@/components/course-feed-client";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUsername();
  const supabase = await createClient();
  const { id } = await params;

  // Get user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Fetch the specific course
  const { data: course, error } = await supabase
    .from("course")
    .select("id, name, subject, course_link")
    .eq("id", id)
    .single();

  if (error || !course) {
    return notFound();
  }

  return (
    <div className="px-4 pt-12 pb-24" style={{ maxWidth: '390px', margin: '0 auto' }}>
      {/* Course Name */}
      <h1 className="text-3xl font-bold text-foreground mb-8">{course.name}</h1>
      
      {/* Friends Subscribed */}
      <div className="mb-6">
        <CourseFriendsSubscribed courseId={id} />
      </div>
      
      {/* Subscribe Button */}
      <div className="mb-8">
        <SubscribeButton courseId={id} userId={user.id} />
      </div>
      
      {/* Action Icons */}
      <CourseActions courseId={id} courseLink={course.course_link} />

      {/* Course Feed */}
      <div className="mt-12 border-t border-[hsl(var(--border))] pt-8">
        <h2 className="text-xl font-bold text-foreground mb-4">Course Feed</h2>
        <CourseFeedClient courseId={id} />
      </div>
    </div>
  );
}
