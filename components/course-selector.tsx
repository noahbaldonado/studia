"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown } from "lucide-react";

interface CourseOffering {
  id: string;
  professor: string | null;
  quarter: string | null;
}

interface CourseSelectorProps {
  courseName: string;
  initialCourseId: string;
  userId: string;
  onCourseChange: (courseId: string) => void;
}

export function CourseSelector({
  courseName,
  initialCourseId,
  userId,
  onCourseChange,
}: CourseSelectorProps) {
  const [courseOfferings, setCourseOfferings] = useState<CourseOffering[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId);
  const [selectedProfessor, setSelectedProfessor] = useState<string | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);

  // Update selected course when initialCourseId changes
  useEffect(() => {
    setSelectedCourseId(initialCourseId);
  }, [initialCourseId]);
  const [showProfessorDropdown, setShowProfessorDropdown] = useState(false);
  const [showQuarterDropdown, setShowQuarterDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch all course offerings with the same name
  useEffect(() => {
    async function fetchCourseOfferings() {
      try {
        setLoading(true);
        
        // Get all courses with the same name
        const { data: offerings, error } = await supabase
          .from("course")
          .select("id, professor, quarter")
          .eq("name", courseName)
          .order("quarter", { ascending: false })
          .order("professor", { ascending: true });

        if (error) {
          console.error("Error fetching course offerings:", error);
          return;
        }

        setCourseOfferings(offerings || []);

        // Find the initial course to set default professor/quarter
        const initialCourse = offerings?.find(o => o.id === initialCourseId);
        if (initialCourse) {
          setSelectedProfessor(initialCourse.professor);
          setSelectedQuarter(initialCourse.quarter);
          // Don't call onCourseChange here - parent already knows about initialCourseId
        } else {
          // If initial course not found, check if user is subscribed to any
          const { data: subscriptions } = await supabase
            .from("course_subscription")
            .select("course_id")
            .eq("user_id", userId);

          if (subscriptions && subscriptions.length > 0) {
            const subscribedCourseIds = subscriptions.map(s => s.course_id);
            const subscribedOffering = offerings?.find(o => subscribedCourseIds.includes(o.id));
            if (subscribedOffering) {
              setSelectedCourseId(subscribedOffering.id);
              setSelectedProfessor(subscribedOffering.professor);
              setSelectedQuarter(subscribedOffering.quarter);
              onCourseChange(subscribedOffering.id);
            } else if (offerings && offerings.length > 0) {
              // Default to first offering
              const first = offerings[0];
              setSelectedCourseId(first.id);
              setSelectedProfessor(first.professor);
              setSelectedQuarter(first.quarter);
              onCourseChange(first.id);
            }
          } else if (offerings && offerings.length > 0) {
            // Default to first offering
            const first = offerings[0];
            setSelectedCourseId(first.id);
            setSelectedProfessor(first.professor);
            setSelectedQuarter(first.quarter);
            onCourseChange(first.id);
          }
        }
      } catch (err) {
        console.error("Error fetching course offerings:", err);
      } finally {
        setLoading(false);
      }
    }

    if (courseName) {
      fetchCourseOfferings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseName, initialCourseId, userId]);

  // Handle professor change
  const handleProfessorChange = (professor: string) => {
    setSelectedProfessor(professor);
    setShowProfessorDropdown(false);

    // Find course offering with this professor and current quarter
    const offering = courseOfferings.find(
      o => o.professor === professor && o.quarter === selectedQuarter
    );

    if (offering) {
      setSelectedCourseId(offering.id);
      onCourseChange(offering.id);
    }
  };

  // Handle quarter change
  const handleQuarterChange = (quarter: string) => {
    setSelectedQuarter(quarter);
    setShowQuarterDropdown(false);

    // Find course offering with current professor and this quarter
    const offering = courseOfferings.find(
      o => o.professor === selectedProfessor && o.quarter === quarter
    );

    if (offering) {
      setSelectedCourseId(offering.id);
      onCourseChange(offering.id);
    }
  };

  // Get unique professors and quarters
  const uniqueProfessors = [...new Set(
    courseOfferings.map(o => o.professor).filter((p): p is string => !!p)
  )].sort();

  const uniqueQuarters = [...new Set(
    courseOfferings.map(o => o.quarter).filter((q): q is string => !!q)
  )].sort((a, b) => {
    // Sort quarters: most recent first
    return b.localeCompare(a);
  });

  if (loading) {
    return (
      <div className="mb-8 text-sm text-[hsl(var(--muted-foreground))]">
        Loading course options...
      </div>
    );
  }

  // Don't show selector if only one offering
  if (courseOfferings.length <= 1) {
    return null;
  }

  return (
    <div className="mb-8 space-y-3">
      {/* Professor Selection */}
      {uniqueProfessors.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfessorDropdown(!showProfessorDropdown);
              setShowQuarterDropdown(false);
            }}
            className="w-full px-4 py-2 text-left border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] rounded-lg flex items-center justify-between hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <span className="text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">Professor: </span>
              <span className="font-medium">{selectedProfessor || "Select professor"}</span>
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {showProfessorDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg rounded-lg max-h-60 overflow-y-auto">
              {uniqueProfessors.map((professor) => (
                <button
                  key={professor}
                  onClick={() => handleProfessorChange(professor)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--secondary))] transition-colors ${
                    selectedProfessor === professor ? "bg-[hsl(var(--primary))]/10" : ""
                  }`}
                >
                  {professor}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quarter Selection */}
      {uniqueQuarters.length > 1 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowQuarterDropdown(!showQuarterDropdown);
              setShowProfessorDropdown(false);
            }}
            className="w-full px-4 py-2 text-left border border-[hsl(var(--border))] bg-[hsl(var(--secondary))] rounded-lg flex items-center justify-between hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <span className="text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">Quarter: </span>
              <span className="font-medium">{selectedQuarter || "Select quarter"}</span>
            </span>
            <ChevronDown className="h-4 w-4" />
          </button>
          {showQuarterDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[hsl(var(--card))] border border-[hsl(var(--border))] shadow-lg rounded-lg max-h-60 overflow-y-auto">
              {uniqueQuarters.map((quarter) => (
                <button
                  key={quarter}
                  onClick={() => handleQuarterChange(quarter)}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-[hsl(var(--secondary))] transition-colors ${
                    selectedQuarter === quarter ? "bg-[hsl(var(--primary))]/10" : ""
                  }`}
                >
                  {quarter}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
