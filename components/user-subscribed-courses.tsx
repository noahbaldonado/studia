"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { BookOpen } from "lucide-react";

interface Course {
  id: string;
  name: string;
  subject: string;
  course_link?: string;
}

interface UserSubscribedCoursesProps {
  userId: string;
  limit?: number;
  showCount?: boolean;
}

export function UserSubscribedCourses({ userId, limit = 5, showCount = false }: UserSubscribedCoursesProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function fetchSubscribedCourses() {
      try {
        setLoading(true);
        
        // Get course IDs the user is subscribed to
        const { data: subscriptions, error: subError } = await supabase
          .from("course_subscription")
          .select("course_id")
          .eq("user_id", userId);

        if (subError) {
          throw new Error("Failed to fetch subscriptions");
        }

        if (!subscriptions || subscriptions.length === 0) {
          setCourses([]);
          setLoading(false);
          return;
        }

        const courseIds = subscriptions.map((sub) => sub.course_id);

        // Get course details
        const { data: coursesData, error: coursesError } = await supabase
          .from("course")
          .select("id, name, subject, course_link")
          .in("id", courseIds)
          .order("name");

        if (coursesError) {
          throw new Error("Failed to fetch courses");
        }

        const allCourses = coursesData || [];
        setTotalCount(allCourses.length);
        setCourses(limit ? allCourses.slice(0, limit) : allCourses);
      } catch (err) {
        console.error("Error fetching subscribed courses:", err);
        setError("Failed to load courses");
      } finally {
        setLoading(false);
      }
    }

    fetchSubscribedCourses();
  }, [userId, supabase]);

  if (loading) {
    return (
      <div className="text-sm text-zinc-500 py-4">Loading courses...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 py-4">Error: {error}</div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-sm text-zinc-500 py-4">
        No subscribed courses yet
      </div>
    );
  }

  const displayedCourses = courses;
  const hasMore = totalCount !== null && totalCount > displayedCourses.length;

  return (
    <div className="space-y-3">
      {showCount && totalCount !== null && (
        <div className="text-sm text-zinc-500 mb-2">
          {totalCount} {totalCount === 1 ? "course" : "courses"}
        </div>
      )}
      {displayedCourses.map((course) => (
        <Link
          key={course.id}
          href={`/protected/courses/${course.id}`}
          className="block"
        >
          <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-zinc-300">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-zinc-100 p-2">
                <BookOpen className="h-4 w-4 text-zinc-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-zinc-900 line-clamp-2 mb-1">
                  {course.name}
                </h3>
                <p className="text-sm text-zinc-500">{course.subject}</p>
              </div>
            </div>
          </div>
        </Link>
      ))}
      {hasMore && (
        <Link
          href={`/protected/profile/courses/${userId}`}
          className="block py-2 px-3 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-center text-sm text-blue-600 hover:underline"
        >
          View all {totalCount} courses
        </Link>
      )}
    </div>
  );
}
