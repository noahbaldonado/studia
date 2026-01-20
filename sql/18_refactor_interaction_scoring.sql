-- Refactor interaction tracking to use per-user interaction scores
-- Each user has an interaction score per post (0-10)
-- Total interaction score is sum of all user scores for that post

-- Step 1: Remove the total interaction_score column from quiz table
ALTER TABLE quiz DROP COLUMN IF EXISTS interaction_score;

-- Drop the old increment function
DROP FUNCTION IF EXISTS increment_quiz_interaction_score(UUID, INTEGER);

-- Step 2: Add interaction_score column to quiz_interaction table
-- This tracks the user's interaction score (0-10) for a specific post
ALTER TABLE quiz_interaction ADD COLUMN IF NOT EXISTS interaction_score INTEGER DEFAULT 0 CHECK (interaction_score >= 0 AND interaction_score <= 10);

-- Add comment
COMMENT ON COLUMN quiz_interaction.interaction_score IS 'User-specific interaction score (0-10). Like/dislike/quiz/poll interaction = 10, flashcard flip = +4, view time = +1 per 10s (capped at 10 total)';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_interaction_score ON quiz_interaction(interaction_score DESC);

-- Step 3: Update existing interactions to have scores
-- If is_like is not null, set score to 10 (they liked/disliked)
-- Otherwise, keep at 0 (view-time-only interaction)
UPDATE quiz_interaction
SET interaction_score = 10
WHERE is_like IS NOT NULL AND interaction_score = 0;

-- Step 4: Create RPC function to increment user interaction score with capping at 10
CREATE OR REPLACE FUNCTION increment_user_interaction_score(
  p_quiz_id UUID,
  p_user_id UUID,
  p_increment INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  current_score INTEGER;
  new_score INTEGER;
BEGIN
  -- Get current score or default to 0
  SELECT COALESCE(interaction_score, 0) INTO current_score
  FROM quiz_interaction
  WHERE quiz_id = p_quiz_id AND user_id = p_user_id;
  
  -- Calculate new score, capped at 10
  new_score := LEAST(COALESCE(current_score, 0) + p_increment, 10);
  
  -- Update or insert interaction
  INSERT INTO quiz_interaction (quiz_id, user_id, interaction_score, is_like)
  VALUES (p_quiz_id, p_user_id, new_score, NULL)
  ON CONFLICT (quiz_id, user_id)
  DO UPDATE SET interaction_score = new_score;
  
  RETURN new_score;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_user_interaction_score(UUID, UUID, INTEGER) TO authenticated;
