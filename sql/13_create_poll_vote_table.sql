-- Poll vote table: Tracks votes on poll content
-- Run this after setting up the base tables

CREATE TABLE IF NOT EXISTS poll_vote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL CHECK (option_index >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quiz_id, user_id) -- One vote per user per poll
);

-- Enable RLS on poll_vote
ALTER TABLE poll_vote ENABLE ROW LEVEL SECURITY;

-- RLS Policies for poll_vote
-- Anyone can read votes (needed to show results)
CREATE POLICY "Anyone can read poll votes" ON poll_vote
  FOR SELECT USING (true);

-- Users can create their own votes
CREATE POLICY "Users can create own poll votes" ON poll_vote
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes (change their vote)
CREATE POLICY "Users can update own poll votes" ON poll_vote
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own votes (remove their vote)
CREATE POLICY "Users can delete own poll votes" ON poll_vote
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for poll_vote
CREATE INDEX IF NOT EXISTS idx_poll_vote_quiz_id ON poll_vote(quiz_id);
CREATE INDEX IF NOT EXISTS idx_poll_vote_user_id ON poll_vote(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_vote_option_index ON poll_vote(option_index);

-- Trigger to update updated_at on vote changes
CREATE OR REPLACE FUNCTION update_poll_vote_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER poll_vote_updated_at
  BEFORE UPDATE ON poll_vote
  FOR EACH ROW
  EXECUTE FUNCTION update_poll_vote_updated_at();
