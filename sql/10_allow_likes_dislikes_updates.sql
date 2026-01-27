-- Migration to allow authenticated users to update likes/dislikes on any quiz
-- This is needed for the like/dislike functionality to work

-- Drop existing policy if it exists (we'll recreate it)
DROP POLICY IF EXISTS "Users can update own quizzes" ON quiz;

-- Policy 1: Users can update their own quizzes (for all columns)
CREATE POLICY "Users can update own quizzes" ON quiz
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy 2: Authenticated users can update likes/dislikes on any quiz
-- This allows any authenticated user to like/dislike any post
CREATE POLICY "Authenticated users can update likes/dislikes" ON quiz
  FOR UPDATE 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
