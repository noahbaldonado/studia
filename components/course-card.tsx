import Link from "next/link";
import { BookOpen, Pin, Users } from "lucide-react";
import { memo } from "react";

interface FollowingUser {
  id: string;
  name: string;
  email: string | null;
}

interface Course {
  id: string;
  name: string;
  subject: string;
  course_link?: string;
  isSubscribed?: boolean;
  followingSubscribers?: FollowingUser[];
}

interface CourseCardProps {
  course: Course;
}

export const CourseCard = memo(function CourseCard({ course }: CourseCardProps) {
  const followingCount = course.followingSubscribers?.length || 0;

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
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {course.isSubscribed && (
                  <Pin className="h-4 w-4 text-blue-600 mt-0.5" />
                )}
                {followingCount > 0 && (
                  <div className="flex items-center gap-1 text-xs text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
                    <Users className="h-3 w-3" />
                    <span>{followingCount}</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm text-zinc-500">{course.subject}</p>
            {followingCount > 0 && (
              <p className="text-xs text-zinc-600 mt-1.5">
                {followingCount === 1
                  ? `${course.followingSubscribers![0].name} is subscribed`
                  : `${followingCount} friends subscribed`}
              </p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});
