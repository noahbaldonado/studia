-- Add interaction_score column to quiz table
-- This tracks overall engagement with the post (across all users)
-- Different from individual user interaction tracking

ALTER TABLE quiz ADD COLUMN IF NOT EXISTS interaction_score INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_interaction_score ON quiz(interaction_score DESC);

-- Add comment
COMMENT ON COLUMN quiz.interaction_score IS 'Overall engagement score based on views, flips, answers, votes, etc. Higher = more engaging';

-- Create RPC function to atomically increment interaction_score
CREATE OR REPLACE FUNCTION increment_quiz_interaction_score(p_quiz_id UUID, p_increment INTEGER)
RETURNS INTEGER AS $$
DECLARE
  new_score INTEGER;
BEGIN
  UPDATE quiz
  SET interaction_score = COALESCE(interaction_score, 0) + p_increment
  WHERE id = p_quiz_id
  RETURNING interaction_score INTO new_score;
  
  RETURN COALESCE(new_score, 0);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_quiz_interaction_score(UUID, INTEGER) TO authenticated;
