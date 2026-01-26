"use client";

import { useState } from "react";
import { CardFeed } from "@/components/card-feed";
import { FeedSortFilterControls, SortMode } from "@/components/feed-sort-filter-controls";

export function FeedPageClient() {
  const [sortMode, setSortMode] = useState<SortMode>("algorithm");
  const [courseFilter, setCourseFilter] = useState<string[] | null>(null);

  return (
    <>
      <div className="px-4 pt-4">
        <FeedSortFilterControls
          sortMode={sortMode}
          onSortChange={setSortMode}
          courseFilter={courseFilter}
          onCourseFilterChange={setCourseFilter}
          sortOptions={[
            { value: "algorithm", label: "Relevant" },
            { value: "chronological", label: "Recent" },
          ]}
        />
      </div>
      <CardFeed 
        courseFilter={courseFilter} 
        sortMode={sortMode}
      />
    </>
  );
}
