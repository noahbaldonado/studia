import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { requireUsername } from "@/lib/auth-utils";
import { CourseDetailClient } from "@/components/course-detail-client";

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
    .select("id, name, subject, course_link, professor, quarter")
    .eq("id", id)
    .single();

  if (error || !course) {
    return notFound();
  }

  return <CourseDetailClient course={course} userId={user.id} />;
}
