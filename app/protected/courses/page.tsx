"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { CourseCard } from "@/components/course-card";
import { CourseSearch } from "@/components/course-search";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ITEMS_PER_PAGE = 20;

interface Course {
  id: string;
  name: string;
  subject: string;
  course_link?: string;
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCourses, setAllCourses] = useState<Course[]>([]);

  const supabase = createClient();

  // Fetch all courses for search autocomplete (in batches to handle Supabase 1000 row limit)
  useEffect(() => {
    async function fetchAllCourses() {
      try {
        setLoading(true);
        const allCoursesData: Course[] = [];
        const BATCH_SIZE = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error: fetchError } = await supabase
            .from("course")
            .select("id, name, subject, course_link")
            .order("name")
            .range(from, from + BATCH_SIZE - 1);

          if (fetchError) {
            setError(fetchError.message);
            console.error("Error fetching courses:", fetchError);
            break;
          }

          if (data && data.length > 0) {
            allCoursesData.push(...data);
            from += BATCH_SIZE;
            hasMore = data.length === BATCH_SIZE; // If we got less than BATCH_SIZE, we're done
          } else {
            hasMore = false;
          }
        }

        setAllCourses(allCoursesData);
        setCourses(allCoursesData);
      } catch (err) {
        setError("Failed to load courses");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchAllCourses();
  }, [supabase]);

  // Filter courses based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCourses(courses);
      setCurrentPage(1);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allCourses.filter(
      (course) =>
        course.name.toLowerCase().includes(query) ||
        course.subject.toLowerCase().includes(query)
    );
    setFilteredCourses(filtered);
    setCurrentPage(1);
  }, [searchQuery, allCourses, courses]);

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
        <h1 className="text-2xl font-bold mb-6">Courses</h1>
        <div className="text-center py-12 text-zinc-500">Loading courses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Courses</h1>
        <div className="text-center py-12">
          <p className="text-red-500 mb-2">Error loading courses</p>
          <p className="text-sm text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  const displayCourses = searchQuery ? filteredCourses : courses;
  const totalDisplayed = displayCourses.length;

  return (
    <div className="px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">Courses</h1>
      
      <div className="mb-6">
        <CourseSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          suggestions={suggestions}
        />
      </div>

      {searchQuery && (
        <p className="text-sm text-zinc-500 mb-4">
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
                className="flex items-center gap-1 px-4 py-2 rounded-lg border border-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Previous</span>
              </button>
              
              <span className="text-sm text-zinc-600">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-4 py-2 rounded-lg border border-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-zinc-500">
          <p>No courses found.</p>
        </div>
      )}
    </div>
  );
}
