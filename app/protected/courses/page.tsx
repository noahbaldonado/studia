"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CourseCard } from "@/components/course-card";
import { CourseSearch } from "@/components/course-search";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS_PER_PAGE = 20;

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

export default function CoursesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [subscribedCourseIds, setSubscribedCourseIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [courseFollowingMap, setCourseFollowingMap] = useState<Record<string, FollowingUser[]>>({});

  const supabase = createClient();

  // Fetch which following users are subscribed to courses
  const fetchFollowingSubscriptions = async () => {
    try {
      const response = await fetch("/api/courses/following-subscriptions");
      if (response.ok) {
        const data = await response.json();
        setCourseFollowingMap(data.courseFollowing || {});
      }
    } catch (err) {
      console.error("Error fetching following subscriptions:", err);
    }
  };

  // Get user ID and fetch subscriptions in parallel
  useEffect(() => {
    async function getUserAndSubscriptions() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        
        // Fetch subscriptions immediately after getting user
        try {
          const { data, error } = await supabase
            .from("course_subscription")
            .select("course_id")
            .eq("user_id", user.id);

          if (error) {
            console.error("Error fetching subscriptions:", error);
            setSubscribedCourseIds(new Set());
          } else if (data) {
            const subscribedIds = new Set(data.map((sub) => sub.course_id));
            setSubscribedCourseIds(subscribedIds);
          } else {
            setSubscribedCourseIds(new Set());
          }
        } catch (err) {
          console.error("Error fetching subscriptions:", err);
          setSubscribedCourseIds(new Set());
        }
      } else {
        setSubscribedCourseIds(new Set());
      }
    }

    getUserAndSubscriptions();
    fetchFollowingSubscriptions();

    // Refetch subscriptions when window gains focus (user navigates back)
    const handleFocus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        try {
          const { data, error } = await supabase
            .from("course_subscription")
            .select("course_id")
            .eq("user_id", user.id);

          if (!error && data) {
            const subscribedIds = new Set(data.map((sub) => sub.course_id));
            setSubscribedCourseIds(subscribedIds);
          }

          // Also refetch following subscriptions
          fetchFollowingSubscriptions();
        } catch (err) {
          console.error("Error refetching subscriptions:", err);
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [supabase]);

  // Fetch courses progressively - load first batch quickly, then load rest in background
  useEffect(() => {
    async function fetchAllCourses() {
      try {
        setLoading(true);
        const allCoursesData: Course[] = [];
        const BATCH_SIZE = 1000;
        const INITIAL_BATCH_SIZE = 100; // Load first 100 immediately for fast initial render
        let from = 0;
        let hasMore = true;

        // Load first batch quickly to show initial results
        const { data: firstBatch, error: firstError } = await supabase
          .from("course")
          .select("id, name, subject, course_link")
          .order("name")
          .limit(INITIAL_BATCH_SIZE);

        if (firstError) {
          setError(firstError.message);
          console.error("Error fetching courses:", firstError);
          setLoading(false);
          return;
        }

        if (firstBatch && firstBatch.length > 0) {
          allCoursesData.push(...firstBatch);
          setAllCourses([...allCoursesData]); // Show first batch immediately
          setLoading(false); // Allow rendering to start

          // Continue loading rest in background if there might be more
          if (firstBatch.length === INITIAL_BATCH_SIZE) {
            from = INITIAL_BATCH_SIZE;

            // Load remaining batches in background
            while (hasMore) {
              const { data, error: fetchError } = await supabase
                .from("course")
                .select("id, name, subject, course_link")
                .order("name")
                .range(from, from + BATCH_SIZE - 1);

              if (fetchError) {
                console.error("Error fetching remaining courses:", fetchError);
                break;
              }

              if (data && data.length > 0) {
                allCoursesData.push(...data);
                setAllCourses([...allCoursesData]); // Update as we load more
                from += BATCH_SIZE;
                hasMore = data.length === BATCH_SIZE;
              } else {
                hasMore = false;
              }
            }
          }
        } else {
          setAllCourses([]);
        }
      } catch (err) {
        setError("Failed to load courses");
        console.error(err);
        setLoading(false);
      }
    }

    fetchAllCourses();
  }, [supabase]);

  // Compute sorted courses with subscription status (memoized for performance)
  const courses = useMemo(() => {
    if (allCourses.length === 0) return [];

    const coursesWithSubscription = allCourses.map((course) => ({
      ...course,
      isSubscribed: subscribedCourseIds.has(course.id),
      followingSubscribers: courseFollowingMap[course.id] || [],
    }));

    // Sort: subscribed first, then alphabetically
    coursesWithSubscription.sort((a, b) => {
      if (a.isSubscribed && !b.isSubscribed) return -1;
      if (!a.isSubscribed && b.isSubscribed) return 1;
      return a.name.localeCompare(b.name);
    });

    return coursesWithSubscription;
  }, [allCourses, subscribedCourseIds, courseFollowingMap]);

  // Filter courses based on search query (memoized for performance)
  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) {
      // Return sorted courses (same as `courses` but computed directly to avoid dependency)
      return courses;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allCourses
      .map((course) => ({
        ...course,
        isSubscribed: subscribedCourseIds.has(course.id),
        followingSubscribers: courseFollowingMap[course.id] || [],
      }))
      .filter(
        (course) =>
          course.name.toLowerCase().includes(query) ||
          course.subject.toLowerCase().includes(query)
      )
      // Maintain sort: subscribed first, then alphabetically
      .sort((a, b) => {
        if (a.isSubscribed && !b.isSubscribed) return -1;
        if (!a.isSubscribed && b.isSubscribed) return 1;
        return a.name.localeCompare(b.name);
      });
    
    return filtered;
  }, [searchQuery, courses, allCourses, subscribedCourseIds, courseFollowingMap]);

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Get autocomplete suggestions (top 5 matches)
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    return allCourses
      .filter(
        (course) =>
          course.name.toLowerCase().includes(query) ||
          course.subject.toLowerCase().includes(query)
      )
      .slice(0, 5);
  }, [searchQuery, allCourses]);

  // Pagination
  const totalPages = Math.ceil(
    (searchQuery ? filteredCourses : courses).length / ITEMS_PER_PAGE
  );
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedCourses = (searchQuery ? filteredCourses : courses).slice(
    startIndex,
    endIndex
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Courses</h1>
        <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">Loading courses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6 text-foreground">Courses</h1>
        <div className="text-center py-12">
          <p className="text-[hsl(var(--muted-foreground))] mb-2">Error loading courses</p>
          <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
        </div>
      </div>
    );
  }

  const displayCourses = searchQuery ? filteredCourses : courses;
  const totalDisplayed = displayCourses.length;

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Courses</h1>
      
      <div className="mb-6">
        <CourseSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          suggestions={suggestions}
        />
      </div>

      {searchQuery && (
        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-4">
          Found {totalDisplayed} course{totalDisplayed !== 1 ? "s" : ""}
        </p>
      )}

      {paginatedCourses.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 mb-6">
            {paginatedCourses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-4 py-2 border border-[hsl(var(--border))] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--secondary))] transition-colors text-foreground bg-[hsl(var(--card))] text-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>
              
              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 border border-[hsl(var(--border))] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[hsl(var(--secondary))] transition-colors text-foreground bg-[hsl(var(--card))] text-xs"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
          <p>No courses found.</p>
        </div>
      )}
    </div>
  );
}
