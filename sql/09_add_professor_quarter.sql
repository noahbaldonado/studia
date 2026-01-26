-- Migration to add professor and quarter to courses
-- Run this after base tables migration

-- Add professor and quarter columns to course table
ALTER TABLE course 
ADD COLUMN IF NOT EXISTS professor TEXT,
ADD COLUMN IF NOT EXISTS quarter TEXT;

-- Add indexes for professor and quarter
CREATE INDEX IF NOT EXISTS idx_course_professor ON course(professor) WHERE professor IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_course_quarter ON course(quarter) WHERE quarter IS NOT NULL;

-- Add composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_course_professor_quarter ON course(professor, quarter) 
WHERE professor IS NOT NULL AND quarter IS NOT NULL;

-- Add unique constraint on (name, professor, quarter) to prevent duplicate courses
-- Note: This allows the same course name with different professors/quarters
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_unique_name_professor_quarter 
ON course(name, professor, quarter) 
WHERE professor IS NOT NULL AND quarter IS NOT NULL;

-- For courses without professor/quarter (legacy data), allow duplicates
-- But we'll add a partial unique index for courses WITH professor/quarter
COMMENT ON COLUMN course.professor IS 'Professor name for this course offering';
COMMENT ON COLUMN course.quarter IS 'Quarter/term for this course (e.g., "2026 Winter", "2025 Fall")';
