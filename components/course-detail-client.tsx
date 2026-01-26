"use client";

import { useState } from "react";
import { SubscribeButton } from "@/components/subscribe-button";
import { CourseFriendsSubscribed } from "@/components/course-friends-subscribed";
import { CourseActions } from "@/components/course-actions";
import { CourseFeedClient } from "@/components/course-feed-client";
import { CourseSyllabus } from "@/components/course-syllabus";
import { CourseSelector } from "@/components/course-selector";

interface CourseDetailClientProps {
  course: {
    id: string;
    name: string;
    subject: string;
    course_link?: string | null;
    professor: string | null;
    quarter: string | null;
  };
  userId: string;
}

export function CourseDetailClient({ course, userId }: CourseDetailClientProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(course.id);

  return (
    <div className="px-4 pt-12 pb-24" style={{ maxWidth: '390px', margin: '0 auto' }}>
      {/* Course Name */}
      <h1 className="text-3xl font-bold text-foreground mb-2">{course.name}</h1>
      
      {/* Course Selector (Professor/Quarter dropdowns) */}
      <CourseSelector
        courseName={course.name}
        initialCourseId={course.id}
        userId={userId}
        onCourseChange={setSelectedCourseId}
      />
      
      {/* Friends Subscribed */}
      <div className="mb-6">
        <CourseFriendsSubscribed courseId={selectedCourseId} />
      </div>
      
      {/* Subscribe Button */}
      <div className="mb-8">
        <SubscribeButton courseId={selectedCourseId} userId={userId} courseName={course.name} />
      </div>
      
      {/* Action Icons */}
      <CourseActions courseId={selectedCourseId} courseLink={course.course_link} />

      {/* Syllabus Section */}
      <div className="mt-12 border-t border-[hsl(var(--border))] pt-8">
        <CourseSyllabus courseId={selectedCourseId} userId={userId} />
      </div>

      {/* Course Feed */}
      <div className="mt-12 border-t border-[hsl(var(--border))] pt-8">
        <h2 className="text-xl font-bold text-foreground mb-4">Course Feed</h2>
        <CourseFeedClient courseId={selectedCourseId} />
      </div>
    </div>
  );
}
