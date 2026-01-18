-- Create quiz_interaction table to track which quizzes users have liked/disliked
-- This allows us to filter out quizzes the user has already interacted with

CREATE TABLE IF NOT EXISTS quiz_interaction (
  quiz_id UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_like BOOLEAN NOT NULL, -- true for like, false for dislike
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quiz_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_interaction_user_id ON quiz_interaction(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_interaction_quiz_id ON quiz_interaction(quiz_id);

-- Enable RLS
ALTER TABLE quiz_interaction ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quiz_interaction table
-- Users can read their own interactions
CREATE POLICY "Users can read own interactions" ON quiz_interaction
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own interactions
CREATE POLICY "Users can create own interactions" ON quiz_interaction
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own interactions
CREATE POLICY "Users can update own interactions" ON quiz_interaction
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own interactions
CREATE POLICY "Users can delete own interactions" ON quiz_interaction
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_quiz_interaction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER quiz_interaction_updated_at
  BEFORE UPDATE ON quiz_interaction
  FOR EACH ROW
  EXECUTE FUNCTION update_quiz_interaction_updated_at();
