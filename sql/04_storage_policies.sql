-- Storage bucket policies for Supabase Storage
-- Run this AFTER creating the storage buckets in Supabase Dashboard → Storage
-- Required buckets: 'profile-pictures' and 'course-syllabi'

-- Drop existing policies if they exist (allows re-running this migration)
DROP POLICY IF EXISTS "Anyone can view profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile picture" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to course-syllabi" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from course-syllabi" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to course-syllabi" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes to course-syllabi" ON storage.objects;

-- ============================================
-- PROFILE-PICTURES BUCKET POLICIES
-- ============================================

-- Policy: Anyone can view profile pictures
CREATE POLICY "Anyone can view profile pictures"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');

-- Policy: Users can upload their own profile picture
CREATE POLICY "Users can upload own profile picture"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own profile picture
CREATE POLICY "Users can update own profile picture"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own profile picture
CREATE POLICY "Users can delete own profile picture"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================
-- COURSE-SYLLABI BUCKET POLICIES
-- ============================================

-- Policy 1: Allow authenticated users to upload files to course-syllabi bucket
CREATE POLICY "Allow authenticated uploads to course-syllabi"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'course-syllabi' AND
  auth.role() = 'authenticated'
);

-- Policy 2: Allow anyone (public) to read/download files from course-syllabi bucket
CREATE POLICY "Allow public reads from course-syllabi"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'course-syllabi');

-- Policy 3: Allow authenticated users to update files in course-syllabi bucket
CREATE POLICY "Allow authenticated updates to course-syllabi"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'course-syllabi' AND
  auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'course-syllabi' AND
  auth.role() = 'authenticated'
);

-- Policy 4: Allow authenticated users to delete files from course-syllabi bucket
CREATE POLICY "Allow authenticated deletes to course-syllabi"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'course-syllabi' AND
  auth.role() = 'authenticated'
);
