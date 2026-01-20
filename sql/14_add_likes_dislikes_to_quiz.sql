-- Add likes and dislikes columns to quiz table
-- Migrate existing data from quiz_interaction table

-- Add likes and dislikes columns
ALTER TABLE quiz
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS dislikes INTEGER DEFAULT 0;

-- Create indexes for potential future use
CREATE INDEX IF NOT EXISTS idx_quiz_likes ON quiz(likes DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_dislikes ON quiz(dislikes DESC);

-- Migrate existing data from quiz_interaction table
-- Update likes count
UPDATE quiz q
SET likes = (
  SELECT COUNT(*)
  FROM quiz_interaction qi
  WHERE qi.quiz_id = q.id AND qi.is_like = true
)
WHERE EXISTS (
  SELECT 1
  FROM quiz_interaction qi
  WHERE qi.quiz_id = q.id
);

-- Update dislikes count
UPDATE quiz q
SET dislikes = (
  SELECT COUNT(*)
  FROM quiz_interaction qi
  WHERE qi.quiz_id = q.id AND qi.is_like = false
)
WHERE EXISTS (
  SELECT 1
  FROM quiz_interaction qi
  WHERE qi.quiz_id = q.id
);

-- Note: The rating column is kept for backward compatibility but won't be used in new algorithm calculations
