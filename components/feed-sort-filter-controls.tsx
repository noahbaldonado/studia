"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

export type SortMode = "algorithm" | "chronological" | "net_likes" | "likes";

interface FeedSortFilterControlsProps {
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  courseFilter: string[] | null;
  onCourseFilterChange: (courseIds: string[] | null) => void;
  sortOptions: Array<{ value: SortMode; label: string }>;
  showCourseFilter?: boolean;
}

export function FeedSortFilterControls({
  sortMode,
  onSortChange,
  courseFilter,
  onCourseFilterChange,
  sortOptions,
  showCourseFilter = true,
}: FeedSortFilterControlsProps) {
  const [courses, setCourses] = useState<Array<{ id: string; name: string; professor: string | null; quarter: string | null }>>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showCourseFilter) {
      loadCourses();
    }
  }, [showCourseFilter]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadCourses = async () => {
    try {
      setLoadingCourses(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Get user's subscribed courses
      const { data: subscriptions } = await supabase
        .from("course_subscription")
        .select("course_id")
        .eq("user_id", user.id);

      if (!subscriptions || subscriptions.length === 0) {
        setCourses([]);
        return;
      }

      const courseIds = subscriptions.map((s) => s.course_id);
      const { data: courseData } = await supabase
        .from("course")
        .select("id, name, professor, quarter")
        .in("id", courseIds)
        .order("name");

      setCourses(courseData || []);
    } catch (error) {
      console.error("Error loading courses:", error);
    } finally {
      setLoadingCourses(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    const currentFilter = courseFilter || [];
    const newFilter = currentFilter.includes(courseId)
      ? currentFilter.filter((id) => id !== courseId)
      : [...currentFilter, courseId];
    
    onCourseFilterChange(newFilter.length === 0 ? null : newFilter);
  };

  const clearFilter = () => {
    onCourseFilterChange(null);
    setIsDropdownOpen(false);
  };

  const getCourseDisplayName = (course: { name: string; professor: string | null; quarter: string | null }): string => {
    const parts: string[] = [course.name];
    if (course.quarter || course.professor) {
      const details: string[] = [];
      if (course.quarter) details.push(course.quarter);
      if (course.professor) details.push(course.professor);
      parts.push(`(${details.join(", ")})`);
    }
    return parts.join(" ");
  };

  const selectedCourseNames = courseFilter
    ? courses.filter((c) => courseFilter.includes(c.id)).map((c) => getCourseDisplayName(c))
    : [];

  return (
    <div className="mb-3 flex items-center gap-2 flex-wrap">
      {/* Sort Dropdown */}
      <select
        value={sortMode}
        onChange={(e) => onSortChange(e.target.value as SortMode)}
        className="px-2.5 py-1 text-xs border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Course Filter */}
      {showCourseFilter && (
        <>
          <span className="text-xs text-[hsl(var(--muted-foreground))] mx-0.5">•</span>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-2.5 py-1 text-xs border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))] min-w-[120px] text-left flex items-center justify-between gap-1"
              disabled={loadingCourses}
            >
              <span className="truncate">
                {selectedCourseNames.length === 0
                  ? "All courses"
                  : selectedCourseNames.length === 1
                  ? selectedCourseNames[0]
                  : `${selectedCourseNames.length} courses`}
              </span>
              {selectedCourseNames.length > 0 && (
                <X
                  className="h-3 w-3 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearFilter();
                  }}
                />
              )}
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg max-h-60 overflow-y-auto min-w-[180px]">
                <div className="p-1">
                  {courses.map((course) => {
                    const isSelected = courseFilter?.includes(course.id) || false;
                    return (
                      <label
                        key={course.id}
                        className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-[hsl(var(--secondary))] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleCourse(course.id)}
                          className="w-3.5 h-3.5 border-[hsl(var(--border))] bg-[hsl(var(--input))] text-[hsl(var(--primary))] focus:ring-[hsl(var(--primary))]"
                        />
                        <span className="flex-1 truncate">{getCourseDisplayName(course)}</span>
                      </label>
                    );
                  })}
                  {courses.length === 0 && !loadingCourses && (
                    <div className="px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                      No courses available
                    </div>
                  )}
                  {loadingCourses && (
                    <div className="px-2 py-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                      Loading...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}
