import Link from "next/link";
import { BookOpen, Pin } from "lucide-react";
import { memo } from "react";

interface Course {
  id: string;
  name: string;
  subject: string;
  course_link?: string;
  isSubscribed?: boolean;
}

interface CourseCardProps {
  course: Course;
}

export const CourseCard = memo(function CourseCard({ course }: CourseCardProps) {
  return (
    <Link href={`/protected/courses/${course.id}`}>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:shadow-md active:scale-[0.98]">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-zinc-100 p-2.5">
            <BookOpen className="h-5 w-5 text-zinc-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h3 className="font-semibold text-zinc-900 line-clamp-2 mb-1 flex-1">
                {course.name}
              </h3>
              {course.isSubscribed && (
                <Pin className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              )}
            </div>
            <p className="text-sm text-zinc-500">{course.subject}</p>
          </div>
        </div>
      </div>
    </Link>
  );
});
