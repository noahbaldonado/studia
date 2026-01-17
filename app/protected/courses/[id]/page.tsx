import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { CoursePdfsSection } from "@/components/course-pdfs-section";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

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
    <div className="px-4 py-6 pb-24">
      <h1 className="text-2xl font-bold mb-2">{course.name}</h1>
      <p className="text-zinc-500 mb-6">{course.subject}</p>
      
      {course.course_link && (
        <a
          href={course.course_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-blue-600 hover:text-blue-700 underline mb-8"
        >
          View Course Link →
        </a>
      )}

      <CoursePdfsSection courseId={id} />
    </div>
  );
}
