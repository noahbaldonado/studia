-- Seed script to add sample courses for testing
-- Run this in Supabase SQL Editor after running the base migrations
-- This script uses INSERT with explicit service role privileges (run as admin/service role)

-- Note: Since RLS only allows reading courses, this script should be run
-- in Supabase SQL Editor where service role privileges bypass RLS

-- Sample courses - Computer Science courses
-- Only insert courses that don't already exist (based on name)
INSERT INTO course (name, subject, course_link)
SELECT * FROM (VALUES
  ('Introduction to Computer Science', 'Computer Science', 'https://example.com/courses/cs101'),
  ('Data Structures and Algorithms', 'Computer Science', 'https://example.com/courses/cs161'),
  ('Database Systems', 'Computer Science', 'https://example.com/courses/cs122'),
  ('Operating Systems', 'Computer Science', 'https://example.com/courses/cs111'),
  ('Machine Learning Fundamentals', 'Computer Science', 'https://example.com/courses/cs142'),
  ('Web Development', 'Computer Science', 'https://example.com/courses/cs183'),
  ('Software Engineering', 'Computer Science', 'https://example.com/courses/cs130'),
  ('Computer Networks', 'Computer Science', 'https://example.com/courses/cs118'),
  ('Computer Architecture', 'Computer Science', 'https://example.com/courses/cs104'),
  ('Programming Languages', 'Computer Science', 'https://example.com/courses/cs162')
) AS v(name, subject, course_link)
WHERE NOT EXISTS (
  SELECT 1 FROM course WHERE course.name = v.name
);

-- Verify courses were inserted
SELECT id, name, subject, course_link, created_at 
FROM course 
ORDER BY created_at DESC 
LIMIT 10;
