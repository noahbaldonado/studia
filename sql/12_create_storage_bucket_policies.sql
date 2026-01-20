-- Storage bucket policies for course-pdfs
-- This script sets up Row Level Security (RLS) policies for the 'course-pdfs' storage bucket
-- Run this after creating the 'course-pdfs' bucket in Supabase Storage

-- Enable RLS on storage.objects (if not already enabled)
-- Note: RLS is typically enabled by default on storage.objects

-- Drop existing policies if they exist (allows re-running this migration)
DROP POLICY IF EXISTS "Allow authenticated uploads to course-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from course-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to course-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from course-pdfs" ON storage.objects;

-- Policy 1: Allow authenticated users to upload files to course-pdfs bucket
CREATE POLICY "Allow authenticated uploads to course-pdfs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-pdfs' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow anyone (public) to read/download files from course-pdfs bucket
CREATE POLICY "Allow public reads from course-pdfs"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'course-pdfs');

-- Policy 3: Allow authenticated users to update files in course-pdfs bucket
CREATE POLICY "Allow authenticated updates to course-pdfs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-pdfs' AND
  auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'course-pdfs' AND
  auth.role() = 'authenticated'
);

-- Policy 4: Allow authenticated users to delete files from course-pdfs bucket
CREATE POLICY "Allow authenticated deletes from course-pdfs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-pdfs' AND
  auth.role() = 'authenticated'
);

-- Note: These policies allow any authenticated user to upload/delete files.
-- If you want to restrict deletions to file owners, you would need to track
-- ownership in the course_pdfs table and create more complex policies.
-- For now, this provides basic functionality while maintaining security
-- (only authenticated users can modify files).
