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
}

export function UserSubscribedCourses({ userId }: UserSubscribedCoursesProps) {
  const [courses, setCourses] = useState<Course[]>([]);
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

        setCourses(coursesData || []);
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

  return (
    <div className="space-y-3">
      {courses.map((course) => (
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
    </div>
  );
}
