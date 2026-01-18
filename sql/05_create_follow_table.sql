-- Create follow table to track user relationships (who follows whom)
-- This allows users to follow each other without requiring approval

CREATE TABLE IF NOT EXISTS follow (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follow_no_self CHECK (follower_id != following_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_follow_follower_id ON follow(follower_id);
CREATE INDEX IF NOT EXISTS idx_follow_following_id ON follow(following_id);

-- Enable RLS
ALTER TABLE follow ENABLE ROW LEVEL SECURITY;

-- RLS Policies for follow table
-- Users can read all follow relationships (to see who follows whom)
CREATE POLICY "Anyone can read follow relationships" ON follow
  FOR SELECT USING (true);

-- Users can create their own follow relationships (follow others)
CREATE POLICY "Users can follow others" ON follow
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

-- Users can delete their own follow relationships (unfollow)
CREATE POLICY "Users can unfollow" ON follow
  FOR DELETE USING (auth.uid() = follower_id);
