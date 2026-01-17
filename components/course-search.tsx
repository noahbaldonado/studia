"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";

interface Course {
  id: string;
  name: string;
  subject: string;
  course_link?: string;
}

interface CourseSearchProps {
  onSearchChange: (query: string) => void;
  searchQuery: string;
  suggestions?: Course[];
  onSuggestionSelect?: (course: Course) => void;
}

export function CourseSearch({
  onSearchChange,
  searchQuery,
  suggestions = [],
  onSuggestionSelect,
}: CourseSearchProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (course: Course) => {
    onSearchChange(course.name);
    setShowSuggestions(false);
    if (onSuggestionSelect) {
      onSuggestionSelect(course);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="Search courses..."
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => searchQuery && suggestions.length > 0 && setShowSuggestions(true)}
          className="w-full rounded-lg border border-zinc-200 bg-white px-10 py-2.5 text-sm focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
        />
        {searchQuery && (
          <button
            onClick={() => {
              onSearchChange("");
              setShowSuggestions(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-auto">
            {suggestions.map((course) => (
              <button
                key={course.id}
                onClick={() => handleSelect(course)}
                className="w-full px-4 py-3 text-left hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none transition-colors"
              >
                <div className="font-medium text-zinc-900">{course.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{course.subject}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
