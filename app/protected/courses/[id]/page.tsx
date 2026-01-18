import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { SubscribeButton } from "@/components/subscribe-button";
import { CourseFriendsSubscribed } from "@/components/course-friends-subscribed";
import { CourseActions } from "@/components/course-actions";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  // Get user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return redirect("/");
  }

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
      <h1 className="text-3xl font-bold text-blue-900 mb-8">{course.name}</h1>
      
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
    </div>
  );
}
