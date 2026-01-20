"use client";

import { useState } from "react";
import { CardFeed } from "@/components/card-feed";
import { FeedSortFilterControls, SortMode } from "@/components/feed-sort-filter-controls";

interface CourseFeedClientProps {
  courseId: string;
}

export function CourseFeedClient({ courseId }: CourseFeedClientProps) {
  const [sortMode, setSortMode] = useState<SortMode>("algorithm");

  return (
    <>
      <div className="mb-4">
        <FeedSortFilterControls
          sortMode={sortMode}
          onSortChange={setSortMode}
          courseFilter={[courseId]}
          onCourseFilterChange={() => {}} // Filter is fixed to this course
          sortOptions={[
            { value: "algorithm", label: "Relevant" },
            { value: "chronological", label: "Recent" },
          ]}
          showCourseFilter={false} // Don't show course filter since it's fixed
        />
      </div>
      <CardFeed courseFilter={[courseId]} sortMode={sortMode} />
    </>
  );
}
